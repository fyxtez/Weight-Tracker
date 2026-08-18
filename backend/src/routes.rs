use axum::{
    Json, Router,
    extract::{Path, Query, State},
    http::StatusCode,
    routing::get,
};
use chrono::NaiveDate;
use serde::Serialize;
use sqlx::PgPool;
use uuid::Uuid;

use crate::{
    AppState,
    error::ApiError,
    models::{DailyPayload, DailyRecordResponse, DailyRecordRow, ListDaysQuery},
};

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/health", get(health))
        .route("/api/v1/days", get(list_days))
        .route("/api/v1/days/{date}", get(get_day).put(put_day).delete(delete_day))
}

#[derive(Serialize)]
struct HealthResponse {
    status: &'static str,
    database: &'static str,
}

async fn health(State(state): State<AppState>) -> Result<Json<HealthResponse>, ApiError> {
    // Feature: Health verifies the database connection instead of reporting success for a half-started API.
    sqlx::query_scalar::<_, i32>("SELECT 1")
        .fetch_one(&state.pool)
        .await?;
    Ok(Json(HealthResponse { status: "ok", database: "connected" }))
}

async fn put_day(
    State(state): State<AppState>,
    Path(date): Path<NaiveDate>,
    Json(payload): Json<DailyPayload>,
) -> Result<(StatusCode, Json<DailyRecordResponse>), ApiError> {
    payload.validate().map_err(ApiError::Validation)?;
    let payload = serde_json::to_value(payload).expect("serializing DailyPayload cannot fail");
    // Feature: Upsert makes autosave idempotent and increments a revision usable by the later sync protocol.
    let row = sqlx::query_as::<_, DailyRecordRow>(
        r#"
        INSERT INTO daily_records (id, user_id, local_date, payload)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (user_id, local_date) DO UPDATE
        SET payload = EXCLUDED.payload,
            revision = daily_records.revision + 1,
            updated_at = NOW(),
            deleted_at = NULL
        RETURNING id, local_date, payload, revision, updated_at
        "#,
    )
    .bind(Uuid::new_v4())
    .bind(state.dev_user_id)
    .bind(date)
    .bind(payload)
    .fetch_one(&state.pool)
    .await?;

    Ok((StatusCode::OK, Json(row.into())))
}

async fn get_day(
    State(state): State<AppState>,
    Path(date): Path<NaiveDate>,
) -> Result<Json<DailyRecordResponse>, ApiError> {
    let row = sqlx::query_as::<_, DailyRecordRow>(
        r#"
        SELECT id, local_date, payload, revision, updated_at
        FROM daily_records
        WHERE user_id = $1 AND local_date = $2 AND deleted_at IS NULL
        "#,
    )
    .bind(state.dev_user_id)
    .bind(date)
    .fetch_optional(&state.pool)
    .await?
    .ok_or(ApiError::NotFound)?;

    Ok(Json(row.into()))
}

async fn list_days(
    State(state): State<AppState>,
    Query(query): Query<ListDaysQuery>,
) -> Result<Json<Vec<DailyRecordResponse>>, ApiError> {
    // Fix: A bounded limit prevents accidental unbounded history responses during curl and future mobile sync tests.
    let limit = query.limit.unwrap_or(30).clamp(1, 366);
    let rows = sqlx::query_as::<_, DailyRecordRow>(
        r#"
        SELECT id, local_date, payload, revision, updated_at
        FROM daily_records
        WHERE user_id = $1
          AND deleted_at IS NULL
          AND ($2::DATE IS NULL OR local_date >= $2)
          AND ($3::DATE IS NULL OR local_date <= $3)
        ORDER BY local_date DESC
        LIMIT $4
        "#,
    )
    .bind(state.dev_user_id)
    .bind(query.from)
    .bind(query.to)
    .bind(limit)
    .fetch_all(&state.pool)
    .await?;

    Ok(Json(rows.into_iter().map(Into::into).collect()))
}

async fn delete_day(
    State(state): State<AppState>,
    Path(date): Path<NaiveDate>,
) -> Result<StatusCode, ApiError> {
    // Feature: Soft deletion leaves a tombstone so another device cannot restore a record removed during synchronization.
    let result = sqlx::query(
        r#"
        UPDATE daily_records
        SET deleted_at = NOW(), revision = revision + 1, updated_at = NOW()
        WHERE user_id = $1 AND local_date = $2 AND deleted_at IS NULL
        "#,
    )
    .bind(state.dev_user_id)
    .bind(date)
    .execute(&state.pool)
    .await?;

    if result.rows_affected() == 0 {
        return Err(ApiError::NotFound);
    }
    Ok(StatusCode::NO_CONTENT)
}

pub async fn ensure_dev_user(pool: &PgPool, id: Uuid, email: &str) -> Result<(), sqlx::Error> {
    // Feature: A deterministic development account lets curl exercise user-scoped storage before Google OAuth exists.
    sqlx::query(
        r#"
        INSERT INTO users (id, email, display_name)
        VALUES ($1, $2, 'Local development user')
        ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email, updated_at = NOW()
        "#,
    )
    .bind(id)
    .bind(email)
    .execute(pool)
    .await?;
    Ok(())
}

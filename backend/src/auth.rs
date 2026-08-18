use crate::{AppState, error::ApiError};
use axum::{
    Json, Router,
    extract::State,
    http::{HeaderMap, StatusCode, header},
    routing::{get, post},
};
use chrono::{Duration, Utc};
use secrecy::ExposeSecret;
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;
use weight_tracker_auth::{
    constant_time_token_eq, generate_token, hash_password, hash_token, normalize_email,
    verify_password,
};

#[derive(Deserialize)]
struct Credentials {
    email: String,
    password: String,
}
#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct RefreshBody {
    refresh_token: String,
}
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct Tokens {
    access_token: String,
    refresh_token: String,
    token_type: &'static str,
    expires_in: i64,
}
#[derive(Serialize, FromRow)]
// Feature: Serde converts response keys to camelCase without weakening snake_case conventions inside Rust and SQLx.
#[serde(rename_all = "camelCase")]
pub struct UserResponse {
    id: Uuid,
    email: String,
    display_name: Option<String>,
}

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/api/v1/auth/setup", post(setup))
        .route("/api/v1/auth/register", post(register))
        .route("/api/v1/auth/login", post(login))
        .route("/api/v1/auth/refresh", post(refresh))
        .route("/api/v1/auth/logout", post(logout))
        .route("/api/v1/auth/me", get(me))
}

async fn register(
    State(s): State<AppState>,
    Json(b): Json<Credentials>,
) -> Result<(StatusCode, Json<Tokens>), ApiError> {
    let email = normalize_email(&b.email).map_err(|e| ApiError::Validation(e.to_string()))?;
    let password = b.password;
    // Security: Registration performs expensive Argon2 hashing off the async executor, exactly like owner setup.
    let hash = tokio::task::spawn_blocking(move || hash_password(&password))
        .await
        .map_err(|_| ApiError::Internal)?
        .map_err(|e| ApiError::Validation(e.to_string()))?;
    let display_name = email.split('@').next().map(str::to_owned);
    // Feature: ON CONFLICT makes concurrent registration attempts deterministic without exposing a database error.
    let id = sqlx::query_scalar::<_, Uuid>("INSERT INTO users(id,email,password_hash,display_name) VALUES($1,$2,$3,$4) ON CONFLICT(email) DO NOTHING RETURNING id")
        .bind(Uuid::new_v4())
        .bind(email)
        .bind(hash)
        .bind(display_name)
        .fetch_optional(&s.pool)
        .await?
        .ok_or(ApiError::EmailTaken)?;
    Ok((StatusCode::CREATED, Json(issue(&s, id).await?)))
}

async fn setup(
    State(s): State<AppState>,
    h: HeaderMap,
    Json(b): Json<Credentials>,
) -> Result<(StatusCode, Json<Tokens>), ApiError> {
    let supplied = h
        .get("x-setup-token")
        .and_then(|v| v.to_str().ok())
        .ok_or(ApiError::Forbidden)?;
    if !constant_time_token_eq(supplied, s.setup_token.expose_secret()) {
        return Err(ApiError::Forbidden);
    }
    if sqlx::query_scalar::<_, i64>("SELECT COUNT(*) FROM users WHERE password_hash IS NOT NULL")
        .fetch_one(&s.pool)
        .await?
        > 0
    {
        return Err(ApiError::SetupComplete);
    }
    let email = normalize_email(&b.email).map_err(|e| ApiError::Validation(e.to_string()))?;
    let password = b.password;
    // Security: Expensive Argon2 work is isolated from asynchronous request workers.
    let hash = tokio::task::spawn_blocking(move || hash_password(&password))
        .await
        .map_err(|_| ApiError::Internal)?
        .map_err(|e| ApiError::Validation(e.to_string()))?;
    // Fix: Reuse an earlier password-less development user with the same email instead of failing its unique constraint.
    let id=sqlx::query_scalar::<_,Uuid>("INSERT INTO users(id,email,password_hash,display_name) VALUES($1,$2,$3,'Nikola') ON CONFLICT(email) DO UPDATE SET password_hash=EXCLUDED.password_hash,display_name=EXCLUDED.display_name,updated_at=NOW() RETURNING id").bind(Uuid::new_v4()).bind(email).bind(hash).fetch_one(&s.pool).await?;
    Ok((StatusCode::CREATED, Json(issue(&s, id).await?)))
}
async fn login(
    State(s): State<AppState>,
    Json(b): Json<Credentials>,
) -> Result<Json<Tokens>, ApiError> {
    let email = normalize_email(&b.email).map_err(|_| ApiError::Unauthorized)?;
    let row = sqlx::query_as::<_, (Uuid, String)>(
        "SELECT id,password_hash FROM users WHERE email=$1 AND password_hash IS NOT NULL",
    )
    .bind(email)
    .fetch_optional(&s.pool)
    .await?;
    let password = b.password;
    let ok = if let Some((_, hash)) = &row {
        let hash = hash.clone();
        tokio::task::spawn_blocking(move || verify_password(&password, &hash))
            .await
            .map_err(|_| ApiError::Internal)?
    } else {
        tokio::task::spawn_blocking(move || hash_password(&password).is_ok())
            .await
            .map_err(|_| ApiError::Internal)?;
        false
    };
    let id = row
        .filter(|_| ok)
        .map(|r| r.0)
        .ok_or(ApiError::Unauthorized)?;
    Ok(Json(issue(&s, id).await?))
}
async fn refresh(
    State(s): State<AppState>,
    Json(b): Json<RefreshBody>,
) -> Result<Json<Tokens>, ApiError> {
    let hash = hash_token(&b.refresh_token);
    let id=sqlx::query_scalar::<_,Uuid>("SELECT user_id FROM auth_sessions WHERE refresh_token_hash=$1 AND revoked_at IS NULL AND refresh_expires_at>NOW()").bind(&hash).fetch_optional(&s.pool).await?.ok_or(ApiError::Unauthorized)?;
    sqlx::query("UPDATE auth_sessions SET revoked_at=NOW() WHERE refresh_token_hash=$1")
        .bind(hash)
        .execute(&s.pool)
        .await?;
    Ok(Json(issue(&s, id).await?))
}
async fn logout(State(s): State<AppState>, h: HeaderMap) -> Result<StatusCode, ApiError> {
    sqlx::query("UPDATE auth_sessions SET revoked_at=NOW() WHERE access_token_hash=$1")
        .bind(hash_token(bearer(&h)?))
        .execute(&s.pool)
        .await?;
    Ok(StatusCode::NO_CONTENT)
}
async fn me(State(s): State<AppState>, h: HeaderMap) -> Result<Json<UserResponse>, ApiError> {
    let id = authenticate(&s, &h).await?;
    Ok(Json(
        sqlx::query_as("SELECT id,email,display_name FROM users WHERE id=$1")
            .bind(id)
            .fetch_one(&s.pool)
            .await?,
    ))
}
pub async fn authenticate(s: &AppState, h: &HeaderMap) -> Result<Uuid, ApiError> {
    sqlx::query_scalar("SELECT user_id FROM auth_sessions WHERE access_token_hash=$1 AND revoked_at IS NULL AND access_expires_at>NOW()").bind(hash_token(bearer(h)?)).fetch_optional(&s.pool).await?.ok_or(ApiError::Unauthorized)
}
fn bearer(h: &HeaderMap) -> Result<&str, ApiError> {
    h.get(header::AUTHORIZATION)
        .and_then(|v| v.to_str().ok())
        .and_then(|v| v.strip_prefix("Bearer "))
        .filter(|v| !v.is_empty())
        .ok_or(ApiError::Unauthorized)
}
async fn issue(s: &AppState, id: Uuid) -> Result<Tokens, ApiError> {
    let access = generate_token();
    let refresh = generate_token();
    sqlx::query("INSERT INTO auth_sessions(id,user_id,access_token_hash,refresh_token_hash,access_expires_at,refresh_expires_at) VALUES($1,$2,$3,$4,$5,$6)").bind(Uuid::new_v4()).bind(id).bind(hash_token(&access)).bind(hash_token(&refresh)).bind(Utc::now()+Duration::minutes(s.access_token_minutes)).bind(Utc::now()+Duration::days(s.refresh_token_days)).execute(&s.pool).await?;
    Ok(Tokens {
        access_token: access,
        refresh_token: refresh,
        token_type: "Bearer",
        expires_in: s.access_token_minutes * 60,
    })
}

use axum::{Json, http::StatusCode, response::{IntoResponse, Response}};
use serde::Serialize;

#[derive(Debug, thiserror::Error)]
pub enum ApiError {
    #[error("{0}")]
    Validation(String),
    #[error("record not found")]
    NotFound,
    #[error("database request failed")]
    Database(#[from] sqlx::Error),
}

#[derive(Serialize)]
struct ErrorBody {
    error: &'static str,
    message: String,
}

impl IntoResponse for ApiError {
    fn into_response(self) -> Response {
        let (status, code) = match &self {
            Self::Validation(_) => (StatusCode::UNPROCESSABLE_ENTITY, "validation_error"),
            Self::NotFound => (StatusCode::NOT_FOUND, "not_found"),
            Self::Database(error) => {
                // Fix: Full database errors stay in structured logs instead of leaking credentials or SQL details to clients.
                tracing::error!(%error, "database request failed");
                (StatusCode::INTERNAL_SERVER_ERROR, "database_error")
            }
        };
        (status, Json(ErrorBody { error: code, message: self.to_string() })).into_response()
    }
}

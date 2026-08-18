use axum::{Json, http::StatusCode, response::{IntoResponse, Response}};
use serde::Serialize;

#[derive(Debug, thiserror::Error)]
pub enum ApiError {
    #[error("{0}")]
    Validation(String),
    #[error("record not found")]
    NotFound,
    #[error("invalid email or password")]
    Unauthorized,
    #[error("access denied")]
    Forbidden,
    #[error("account setup has already been completed")]
    SetupComplete,
    #[error("an account with this email already exists")]
    EmailTaken,
    #[error("request could not be completed")]
    Internal,
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
            Self::Unauthorized => (StatusCode::UNAUTHORIZED, "unauthorized"),
            Self::Forbidden => (StatusCode::FORBIDDEN, "forbidden"),
            Self::SetupComplete => (StatusCode::CONFLICT, "setup_complete"),
            Self::EmailTaken => (StatusCode::CONFLICT, "email_taken"),
            Self::Internal => (StatusCode::INTERNAL_SERVER_ERROR, "internal_error"),
            Self::Database(error) => {
                // Fix: Full database errors stay in structured logs instead of leaking credentials or SQL details to clients.
                tracing::error!(%error, "database request failed");
                (StatusCode::INTERNAL_SERVER_ERROR, "database_error")
            }
        };
        (status, Json(ErrorBody { error: code, message: self.to_string() })).into_response()
    }
}

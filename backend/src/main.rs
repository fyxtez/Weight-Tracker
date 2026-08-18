mod config;
mod error;
mod models;
mod routes;

use std::net::SocketAddr;

use anyhow::{Context, Result};
use config::Config;
use sqlx::{PgPool, postgres::PgPoolOptions};
use tower_http::{cors::CorsLayer, trace::TraceLayer};
use tracing::info;
use tracing_subscriber::{EnvFilter, layer::SubscriberExt, util::SubscriberInitExt};
use uuid::Uuid;

#[derive(Clone)]
struct AppState {
    pool: PgPool,
    // Feature: Route state isolates temporary development identity so Google auth can later replace it with a request extractor.
    dev_user_id: Uuid,
}

#[tokio::main]
async fn main() -> Result<()> {
    dotenvy::dotenv().ok();
    init_tracing();
    let config = Config::from_env()?;

    let pool = PgPoolOptions::new()
        .max_connections(10)
        .connect(&config.database_url)
        .await
        .context("failed to connect to PostgreSQL")?;

    // Feature: Embedded migrations make a fresh development database ready on the first backend start.
    sqlx::migrate!()
        .run(&pool)
        .await
        .context("failed to run database migrations")?;
    routes::ensure_dev_user(&pool, config.dev_user_id, &config.dev_user_email).await?;

    let state = AppState { pool, dev_user_id: config.dev_user_id };
    let app = routes::router()
        .with_state(state)
        // Security: Permissive CORS exists only while Config rejects every non-development environment.
        .layer(CorsLayer::permissive())
        .layer(TraceLayer::new_for_http());

    let address = SocketAddr::new(config.host, config.port);
    let listener = tokio::net::TcpListener::bind(address)
        .await
        .with_context(|| format!("failed to bind backend to {address}"))?;
    info!(%address, "Weight Tracker API listening");

    axum::serve(listener, app)
        .with_graceful_shutdown(shutdown_signal())
        .await
        .context("Axum server stopped unexpectedly")?;
    Ok(())
}

fn init_tracing() {
    // Feature: RUST_LOG controls concise structured diagnostics without recompiling the service.
    tracing_subscriber::registry()
        .with(EnvFilter::try_from_default_env().unwrap_or_else(|_| "weight_tracker_backend=debug,tower_http=debug".into()))
        .with(tracing_subscriber::fmt::layer())
        .init();
}

async fn shutdown_signal() {
    // Feature: Graceful Ctrl+C shutdown lets in-flight writes finish cleanly during local development.
    let _ = tokio::signal::ctrl_c().await;
    info!("shutdown signal received");
}

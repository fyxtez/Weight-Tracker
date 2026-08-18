use std::{env, net::IpAddr};

use anyhow::{Context, Result};
use secrecy::SecretString;

#[derive(Clone, Debug)]
pub struct Config {
    pub host: IpAddr,
    pub port: u16,
    pub database_url: String,
    pub setup_token: SecretString,
    pub access_token_minutes: i64,
    pub refresh_token_days: i64,
}

impl Config {
    pub fn from_env() -> Result<Self> {
        Ok(Self {
            host: env::var("APP_HOST")
                .unwrap_or_else(|_| "127.0.0.1".to_owned())
                .parse()
                .context("APP_HOST must be a valid IP address")?,
            port: env::var("APP_PORT")
                .unwrap_or_else(|_| "8585".to_owned())
                .parse()
                .context("APP_PORT must be a valid port")?,
            database_url: env::var("DATABASE_URL").context("DATABASE_URL is required")?,
            setup_token: SecretString::from(env::var("SETUP_TOKEN").context("SETUP_TOKEN is required")?),
            access_token_minutes: read_positive("ACCESS_TOKEN_MINUTES", 15)?,
            refresh_token_days: read_positive("REFRESH_TOKEN_DAYS", 30)?,
        })
    }
}

fn read_positive(name: &str, default: i64) -> Result<i64> {
    let value = env::var(name).ok().map_or(Ok(default), |raw| raw.parse().with_context(|| format!("{name} must be an integer")))?;
    anyhow::ensure!(value > 0, "{name} must be positive");
    Ok(value)
}

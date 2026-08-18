use std::{env, net::IpAddr};

use anyhow::{Context, Result, bail};
use uuid::Uuid;

#[derive(Clone, Debug)]
pub struct Config {
    pub host: IpAddr,
    pub port: u16,
    pub database_url: String,
    pub dev_user_id: Uuid,
    pub dev_user_email: String,
}

impl Config {
    pub fn from_env() -> Result<Self> {
        let app_env = env::var("APP_ENV").unwrap_or_else(|_| "development".to_owned());
        // Security: The temporary identity must never silently become production authentication.
        if app_env != "development" {
            bail!("APP_ENV must remain 'development' until Google authentication is implemented");
        }

        Ok(Self {
            host: env::var("APP_HOST")
                .unwrap_or_else(|_| "127.0.0.1".to_owned())
                .parse()
                .context("APP_HOST must be a valid IP address")?,
            port: env::var("APP_PORT")
                .unwrap_or_else(|_| "3001".to_owned())
                .parse()
                .context("APP_PORT must be a valid port")?,
            database_url: env::var("DATABASE_URL").context("DATABASE_URL is required")?,
            dev_user_id: env::var("DEV_USER_ID")
                .unwrap_or_else(|_| "00000000-0000-0000-0000-000000000001".to_owned())
                .parse()
                .context("DEV_USER_ID must be a UUID")?,
            dev_user_email: env::var("DEV_USER_EMAIL")
                .unwrap_or_else(|_| "nikola@example.com".to_owned()),
        })
    }
}

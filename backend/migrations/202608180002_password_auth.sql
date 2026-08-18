-- Feature: Password hashes use PHC strings while Google-specific identity remains optional for future providers.
ALTER TABLE users ADD COLUMN password_hash TEXT;

-- Feature: Opaque access and refresh tokens are stored only as hashes and can be revoked per device.
CREATE TABLE auth_sessions (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    access_token_hash BYTEA NOT NULL UNIQUE,
    refresh_token_hash BYTEA NOT NULL UNIQUE,
    access_expires_at TIMESTAMPTZ NOT NULL,
    refresh_expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_used_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    revoked_at TIMESTAMPTZ
);

CREATE INDEX auth_sessions_active_access_idx ON auth_sessions (access_token_hash) WHERE revoked_at IS NULL;
CREATE INDEX auth_sessions_active_refresh_idx ON auth_sessions (refresh_token_hash) WHERE revoked_at IS NULL;

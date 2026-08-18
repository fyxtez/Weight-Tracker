-- Feature: Users are keyed by an internal UUID while google_sub remains the stable external identity for future OAuth.
CREATE TABLE users (
    id UUID PRIMARY KEY,
    google_sub TEXT UNIQUE,
    email TEXT NOT NULL UNIQUE,
    display_name TEXT,
    avatar_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Feature: One JSONB document per local calendar day mirrors the app model and makes device synchronization atomic.
CREATE TABLE daily_records (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    local_date DATE NOT NULL,
    payload JSONB NOT NULL,
    revision BIGINT NOT NULL DEFAULT 1 CHECK (revision > 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    UNIQUE (user_id, local_date)
);

-- Feature: Date-ordered user history is the main report and synchronization access path.
CREATE INDEX daily_records_user_date_idx
    ON daily_records (user_id, local_date DESC);

-- Feature: Preferences will initially synchronize Common-food choices without mixing them into daily history.
CREATE TABLE user_preferences (
    user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    common_food_ids JSONB NOT NULL DEFAULT '[]'::JSONB,
    revision BIGINT NOT NULL DEFAULT 1 CHECK (revision > 0),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

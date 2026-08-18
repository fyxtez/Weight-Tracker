# Weight Tracker backend

Axum + PostgreSQL development API for user-scoped daily weight-tracker records.

## Start

From the repository root:

```bash
docker compose up -d postgres
cp backend/.env.example backend/.env
cd backend
cargo run
```

The server runs at `http://127.0.0.1:8585`. Migrations run automatically.

## First account and authentication

Generate a one-time setup secret and put it in `backend/.env` as `SETUP_TOKEN`:

```bash
openssl rand -base64 32
```

Create the only initial account (setup permanently closes after this succeeds):

```bash
curl -s -X POST http://127.0.0.1:8585/api/v1/auth/setup \
  -H 'content-type: application/json' \
  -H 'x-setup-token: VALUE_FROM_BACKEND_ENV' \
  -d '{"email":"YOUR_EMAIL","password":"A_LONG_UNIQUE_PASSWORD"}' | jq
```

Login:

```bash
curl -s -X POST http://127.0.0.1:8585/api/v1/auth/login \
  -H 'content-type: application/json' \
  -d '{"email":"YOUR_EMAIL","password":"A_LONG_UNIQUE_PASSWORD"}' | jq
```

Copy `accessToken` from the response:

```bash
export ACCESS_TOKEN='PASTE_ACCESS_TOKEN'
curl -s http://127.0.0.1:8585/api/v1/auth/me -H "authorization: Bearer $ACCESS_TOKEN" | jq
```

## Curl smoke test

Health and database connectivity:

```bash
curl -s http://127.0.0.1:8585/health | jq
```

Create or replace one day:

```bash
curl -s -X PUT http://127.0.0.1:8585/api/v1/days/2026-08-18 \
  -H 'content-type: application/json' \
  -H "authorization: Bearer $ACCESS_TOKEN" \
  -d '{
    "weight": 101.2,
    "sleep": "7h",
    "workout": ["Šetnja", "Biceps", "Triceps"],
    "foods": [
      {"foodId": "pork", "amount": 200},
      {"foodId": "eggs", "amount": 4},
      {"foodId": "anabolic-shake", "amount": 1}
    ]
  }' | jq
```

Read one day:

```bash
curl -s http://127.0.0.1:8585/api/v1/days/2026-08-18 -H "authorization: Bearer $ACCESS_TOKEN" | jq
```

List a date range:

```bash
curl -s 'http://127.0.0.1:8585/api/v1/days?from=2026-08-01&to=2026-08-31&limit=31' -H "authorization: Bearer $ACCESS_TOKEN" | jq
```

Soft-delete one day:

```bash
curl -i -X DELETE http://127.0.0.1:8585/api/v1/days/2026-08-18 -H "authorization: Bearer $ACCESS_TOKEN"
```

Refresh and logout use `/api/v1/auth/refresh` and `/api/v1/auth/logout`. Access tokens last 15 minutes by default; refresh tokens last 30 days and rotate on every refresh.

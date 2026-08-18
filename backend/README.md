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

The server runs at `http://127.0.0.1:3001`. Migrations and the local development user are created automatically.

## Curl smoke test

Health and database connectivity:

```bash
curl -s http://127.0.0.1:3001/health | jq
```

Create or replace one day:

```bash
curl -s -X PUT http://127.0.0.1:3001/api/v1/days/2026-08-18 \
  -H 'content-type: application/json' \
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
curl -s http://127.0.0.1:3001/api/v1/days/2026-08-18 | jq
```

List a date range:

```bash
curl -s 'http://127.0.0.1:3001/api/v1/days?from=2026-08-01&to=2026-08-31&limit=31' | jq
```

Soft-delete one day:

```bash
curl -i -X DELETE http://127.0.0.1:3001/api/v1/days/2026-08-18
```

## Development-auth boundary

The current API intentionally starts only with `APP_ENV=development`. Every request is scoped to the fixed `DEV_USER_ID`; this exists solely so the storage contract can be tested before Google OAuth is implemented. The server refuses non-development mode until real authentication replaces this bridge.

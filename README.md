# Weight Tracker

A cross-platform personal weight-cut tracker built with **React, TypeScript, Tauri, Rust, Axum and PostgreSQL**. It keeps daily weight, sleep, training and nutrition entry fast on mobile while synchronizing authenticated data through a small Rust API.

## Highlights

- One-tap food portions with derived calories and macros
- Daily weight, sleep and multi-select training tracking
- Local cache with remote autosave and offline-tolerant behavior
- Rotating access/refresh-token authentication
- Seven-day weight and calorie reporting
- CSV export through native Tauri file handling and Android sharing
- Android and desktop targets from the same frontend

## Development

### Backend

Copy the example environment file and start PostgreSQL/API:

```bash
cp backend/.env.example backend/.env
./run.sh
```

See [`backend/README.md`](backend/README.md) for backend configuration and API smoke tests.

### Tauri app

```bash
cd app
npm install
npm run tauri dev
```

For a browser-only frontend preview:

```bash
cd app
npm run dev
```

The frontend uses `VITE_API_URL` when supplied and otherwise targets `http://127.0.0.1:8585`.

## Architecture

The frontend deliberately separates rendering from behavior: `App.tsx` composes screens, `useTrackerController` owns persistence/synchronization/timers, and the `domain` layer owns deterministic food and nutrition logic. The backend is a small authenticated Axum service backed by PostgreSQL.

See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for the full data flow and trust boundaries.

## Security

Do **not** commit `.env` files, Android signing keystores, `keystore.properties`, private keys, access tokens or database credentials. This repository ignores those files by default. If a signing key was ever committed previously, remove it from Git history and rotate it before publishing.

See [`SECURITY.md`](SECURITY.md) for reporting and deployment guidance.

## License

MIT — see [`LICENSE`](LICENSE).

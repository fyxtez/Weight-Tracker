# Architecture

## Client

`app/src/App.tsx` is a composition root only. Authentication restoration lives in `hooks/useSession.ts`; daily tracker state, timers, persistence and synchronization live in `hooks/useTrackerController.ts`. Reusable visual pieces live in `components/`, each with a colocated stylesheet. Deterministic types, food presets and nutrition/date helpers live in `domain/`.

The client writes immediately to a local cache for responsiveness, then mirrors meaningful day records to the API. Empty days are removed remotely. A serialized mutation queue in `api.ts` preserves rapid tap order while refresh-token rotation is deduplicated across concurrent requests.

## Backend

The backend is an Axum service using SQLx/PostgreSQL. Authentication is separated into the `auth` crate for password and token primitives, while HTTP middleware is shared through its own crate. Day endpoints store the client payload with a local date and revision metadata.

## Native layer

The Tauri Rust layer stays intentionally thin. Platform-specific filesystem/export behavior belongs there; tracker business rules remain in TypeScript so Android and desktop share the same behavior.

## Trust boundaries

The client is untrusted from the API's perspective. Authentication and ownership checks are enforced server-side. Production deployments should terminate TLS before the API and keep PostgreSQL private. Local client storage should never be treated as a secure secret store.

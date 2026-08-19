# Security Policy

## Reporting

Please report security issues privately to the repository owner rather than opening a public issue. Include reproduction steps, affected versions and the expected impact when possible.

## Deployment notes

- Keep `backend/.env`, signing keystores, `keystore.properties`, database credentials and private keys out of Git.
- Serve the API over HTTPS outside local development. The bearer access token is sent in the `Authorization` header and must not cross an unencrypted network.
- PostgreSQL should not be publicly exposed; restrict it to the application host/private network.
- Refresh tokens are persisted by the client so sessions survive restarts. Treat device access and local application storage as security-sensitive.
- The backend stores password hashes with Argon2 and stores session tokens as hashes rather than plaintext.
- Rotate any credential or signing key that has previously been committed, even if the file is later deleted.

## Supported version

Security fixes are applied to the current `main` branch.

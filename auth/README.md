# Axiom Auth - Standalone Service

A minimal, deployable Auth microservice for AxiomHub. Provides registration, login, availability checks, and a simple login UI.

## Features
- Express server with CORS + Helmet
- Dynamic port fallback (writes `runtime-port.txt`)
- MongoDB via Mongoose
- JWT-based auth with configurable TTL
- Public login/register page at `/login.html`
- Health endpoint at `/health`
- REST API mounted at `/api/auth`
 - Shared logger (`utils/logger.js`) and centralized error handling

## Quick Start (Windows PowerShell)
```powershell
cd "d:\HDD\test1\Company_App\template-WEBSITE\Axiom_App\systems\marketplace\auth"
# REQUIRED for JWT issuance in dev
$env:JWT_SECRET='dev-secret'   # use a strong secret in production
# Optional: pick port, otherwise service will pick next available
$env:PORT='3003'
npm install
node .\server.js
```
- Health: `GET http://localhost:4100/health`
- UI: `http://localhost:4100/login.html`

## Password Management (CLI)
Use the built-in password tool for checks/resets:

```powershell
# Check password
node .\scripts\password-tool.js check --login user@example.com --password Secret123!

# Set password via model (respects hooks)
node .\scripts\password-tool.js set --login user@example.com --password NewSecret123!

# Set password directly (bypasses hooks)
node .\scripts\password-tool.js set --login user@example.com --password NewSecret123! --direct

# Or via npm scripts
npm run password:check -- --login user@example.com --password Secret123!
npm run password:set -- --login user@example.com --password NewSecret123!
```

## Env Vars
- `PORT`: Base port (default 4100)
- `PORT_SCAN_LIMIT`: Ports to scan upward (default 50)
- `MONGO_URI`: Mongo connection string (default `mongodb://localhost:27017/axiomAuth`)
- `JWT_SECRET`: Secret for signing tokens
- `TOKEN_EXPIRES_IN`: e.g., `7d`
- `CORS_ORIGINS`: Comma-separated list or `*`
 - `ENABLE_CSP`: Set `1` (default) to enforce CSP
 - `FORCE_HTTPS`: Redirect HTTP→HTTPS when behind a proxy

## Endpoints
- `GET /api/auth/health`
- `GET /api/auth/check-availability?email=..&username=..`
- `POST /api/auth/register` { email, username, fullName, userType, password [, companyId, role] }
- `POST /api/auth/login` { emailOrUsername, password }

## Token Payload
The issued JWT contains `user` with: `{ id, username, fullName, role, companyId }`.

## Notes
- Passwords are hashed with bcryptjs before saving.
- For production, enforce HTTPS and set strict CORS origins.
 - This service uses shared auth middleware and logger. See `docs/SHARED_LOGGING_AND_AUTH.md`.

## Frontend UI behavior
- The static UI (`login.html`, `register.html`) loads `js/config.js` which auto-detects the correct API base by probing `/api/auth/health` on common ports (current, 3003, 3004, 4100).
- To control redirect after login without inline scripts, set either of the following in the browser console/localStorage:
	- `localStorage.AFTER_LOGIN_URL = '/';`
	- `localStorage.APP_HOME = '/';` (fallback)
	You can also pass a query parameter `?next=/some/path` to `login.html` to override for a single use.

Troubleshooting 500 on login/register:
- Ensure MongoDB is running and reachable at `MONGO_URI`.
- Ensure one of `JWT_SECRET` or RS256 keys is configured, otherwise the service cannot sign tokens.

# Marketplace System Overview

This document provides a concise, high-level overview of the marketplace system under `systems/marketplace/`: core components, how they integrate, key environment variables, and quick local run steps.

## 1) Quick Summary
- Express server serves `pages/` and exposes REST/JSON for products, cart, orders, and search.
- Standalone `auth/` service handles login and JWT/roles.
- Two AI assistants: a general (portable) one integrated with the market server (SSE enabled), and a fully isolated personal assistant running on a separate port.
- Domain services for Products/Orders/Search/Payments/Media under `services/market/`.
- Monitoring, tests, and infra via Docker Compose and Prometheus/Grafana/Alertmanager.

## 2) Key Folders
- Server & App:
  - `server.js` — main market server (Express). Runs in-memory or with Mongo.
  - `market-server.js` — extended variant (vendors/media/messaging/ranking).
  - `src/` — server-side organization (controllers/models/db/utils/cache).
- Front-End:
  - `pages/` — HTML pages (marketplace, seller/admin, checkout, AI).
  - `css/`, `js/`, `ui-system/`, `vendor/` — styles/assets/browser scripts.
- Authentication:
  - `auth/` — standalone Express service with `public/login.html`, middlewares, routes, and user model.
- AI Assistants:
  - `agent-core/` — general portable agent integrated with the market server.
  - `agent-personal/` — isolated personal agent (JSONL sessions, optional encryption).
  - `server-personal.js` — personal assistant server (default port 5600).
- Domain Services:
  - `services/market/` — products, cart, orders, search (synonyms/facets/cache/fallback/fuzzy), payments (stub/Stripe), media.
  - `models/marketplace/` — Mongo schemas (Product/Order/Cart/Vendor/…).
- Infra & Monitoring:
  - `docker-compose*.yml`, `Dockerfile`, `infra/`, `ecosystem.config.js`, `logs/`.
- Docs & Automation:
  - `docs/`, `ARCHITECTURE.md`, `README*.md`, `scripts/`, `tests/`, `__tests__/`.

## 3) Integration
- Market server serves `pages/` and exposes APIs:
  - Products/Cart/Orders via `services/market/*`.
  - Advanced search with facets and first-page caching (optional fuzzy).
  - Payments: dev stub or real provider (Stripe) with webhook and event ledger.
- Auth via `auth/` service or public key/JWKS, with role guards.
- General AI integrates within `server.js` (SSE with hardened headers). Personal AI is fully isolated on its own port with optional encrypted session memory.
- Monitoring via `/metrics` and full Docker Compose stack for Prometheus/Grafana/Alertmanager.

## 4) Key Environment Variables
- Market:
  - `MARKET_PORT`, `MARKET_MONGO_URL`, `MARKET_ALLOW_DB_FAIL`, `MARKET_SEED_DEMO`, `METRICS_ENABLED`.
  - Search: `MARKET_ENABLE_FUZZY`, `MARKET_FUZZY_*`; search cache: `MARKET_SEARCH_CACHE_*`; first page cache: `MARKET_CACHE_*`.
  - Payments: `MARKET_ENABLE_PAYMENT_STUB` or `PAYMENT_PROVIDER="stripe"`, `STRIPE_*`, and `LEDGER_ENABLED=1` for the event ledger.
- Auth:
  - `MARKET_REQUIRE_JWT`, `AUTH_JWKS_URL`, `JWT_PUBLIC_KEY`, `JWT_SECRET` (HS256 for dev only).
- Personal Assistant:
  - `PERSONAL_PORT` (default 5600), `PERSONAL_API_KEY` (optional), `PERSONAL_MEM_KEY` (AES-256-GCM), `AI_MODEL`, `OPENAI_API_KEY` (optional).

## 5) Quick Local Run
- Market server (in-memory):
```powershell
$env:MARKET_ALLOW_DB_FAIL='1'
$env:MARKET_SEED_DEMO='1'
$env:MARKET_PORT='3002'
node server.js
```
- Personal assistant (with optional API key and encryption):
```powershell
$env:PERSONAL_PORT='5600'
$env:PERSONAL_API_KEY='dev-key-123'
$env:PERSONAL_MEM_KEY='0123456789abcdef0123456789abcdef'
node server-personal.js
```
- Chat UIs:
  - General: `http://localhost:3002/pages/ai-chat.html`
  - Personal: `http://localhost:5600/pages/personal-chat.html`

## 6) Key APIs (Brief)
- Market: under `/api/market/*` (products/cart/orders).
- Search: `GET /api/market/search` with `q, page, limit, sort, include, mode=facets` and caching.
- Payments:
  - Stub: `POST /api/market/payments/intents`, `POST /api/market/payments/:id/confirm`.
  - Stripe: `POST /api/market/payments/intents`, `POST /api/market/payments/webhook` (raw body for signature verification).
- Personal Assistant:
  - `POST /api/personal/chat` — non-streaming (`{ ok, reply }`).
  - `POST /api/personal/chat/stream` — SSE (headers: `text/event-stream`, `no-transform`, `X-Accel-Buffering: no`).
  - `GET /healthz` — health check.

## 7) Monitoring & Infra
- Basic run:
```powershell
docker compose build
docker compose up -d
```
- Full stack with monitoring:
```powershell
docker compose -f docker-compose.full.yml build
docker compose -f docker-compose.full.yml up -d
```
- Common endpoints:
  - App: `http://localhost:3002`
  - Prometheus: `http://localhost:9090`
  - Grafana: `http://localhost:3000`

## 8) Related Links
- Main README: [`../README.md`](../README.md)
- Architecture Guides: `docs/AI_ARCHITECTURE_GUIDE*.md`
- Privacy & Retention: [`docs/PRIVACY_RETENTION_POLICY.md`](./PRIVACY_RETENTION_POLICY.md)
- Monitoring (Prometheus/Grafana): [`docs/MONITORING_PROMETHEUS_GRAFANA.md`](./MONITORING_PROMETHEUS_GRAFANA.md)

# Changelog

All notable changes to this project will be documented here.

## v0.1.1 - 2025-12-01

### Feat
- feat(ai): add /pages/ai-chat-healthz.html and periodic health polling + link from chat (da37159)
- feat(server,ai): serve /pages as static for same-origin UI; harden SSE headers (X-Accel-Buffering no, no-transform) (caf966a)
- feat(ai-chat): add manual API base selector with localStorage and override in getBase() (ba0b209)
- feat(ai): add stream toggle in web client; docs: document SSE endpoint and usage (ba75235)
- feat(ai): add SSE streaming for /api/ai/chat; update web client to stream (f61f241)
- feat(ai): add portable personal assistant (core + API + docs) (abe2a56)

### Fix
- fix(ai-chat): robust API base resolution (same-origin -> Market.Common -> localhost:3002) (a696317)

### Docs
- docs(ai): add bilingual guide + pdf generation scripts (51e70e0)
- docs(ai): add English guide + Mermaid source + PNG + combined PDF build scripts (3a8697a)
- docs(ai): add AI_ARCHITECTURE_GUIDE.md (Arabic) with Mermaid diagram and run/playbooks (8d6f2e0)
- docs(deploy): add AI chat deploy notes (Nginx/Ingress SSE config, env vars, local health page) (d34afa9)
- docs: add git workflow guide (push & updates) (d167a4b)
- docs: add push summary (2025-12-01) (34b7d46)

### Chore
- chore(scripts): add dev:5500 to run server on port 5500 (memory mode) (deccd22)

### Test
- test(ci): add Jest config and SSE smoke script; wire npm scripts (2c1c2f7)
- test: add jest.config.js and SSE smoke script; wire test:ci to config (949243c)
- test(ci): add agent-core and AI endpoint tests; scope CI to __tests__ (c2a95b4)

### Infra
- infra(k8s): add Deployment + Service for market-app with probes and env defaults (3c32734)
- infra: add Nginx example.conf and K8s Ingress manifest with SSE-safe settings (aba7286)

### Ci
- ci: start service and run SSE smoke automatically (1404f8c)
- ci: replace workflow with main-only build job (baed7be)
- ci(smoke): use path.join for cross-platform requires (94b485b)
- ci: broaden triggers to all branches; add workflow_dispatch (31421c2)
- ci: restore build-test job with test:ci; guard docker build/scan (8c067a1)
- ci: simplify workflow to smoke-only; add CI/CD docs (f02e018)

### Other
- docs+env: add MARKET_MONGO_URL to env.example; add Atlas run guide; add dev:5500:db script (dad8bc1)
- ai(sessions): add export filters (sinceHours, from/to); UI export defaults to last 24h (5a0f61d)
- ai(sessions): add /sessions/:id/export endpoint and UI export button (8191203)
- ui(ai): add session history viewer (last 10 entries) in sessions panel (efb8bb8)
- ui(ai): add sessions panel to list, activate, create, and delete sessions (c537fe8)
- ai(metrics): add token usage counters and output length tracking (13ff342)
- ai(metrics): instrument chat/stream with Prometheus and audit logs; ai(core): provider adapters (OpenAI + stub); tools: add minimal echo/math and /api/ai/tools/call (791afac)
- ui(ai): render Markdown replies, add copy button, and stop streaming control (46f66d2)
- ai(memory): extract file-backed MemoryStore; refactor agent-core to use it (6327fd7)
- ai(sessions): add session listing, history retrieval, delete endpoints; file-backed memory helpers (e40e9b4)
- ui(ai): add typing indicator with animated dots; toggle during send/stream (e4cf100)


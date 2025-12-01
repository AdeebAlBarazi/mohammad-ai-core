# Runbook: Blue/Green Rollback

## Objective
Safely roll forward to a new version and revert instantly if needed.

## Prerequisites
- Container images tagged: `market:<tag>`, `auth:<tag>`.
- Staging/tests passing; health `/readyz` green; metrics available.
- Load balancer/CDN supports weighted or route-based switch.

## Steps
1. Deploy `vNext` to Green (no public traffic).
2. Verify `/readyz`, `/metrics`, smoke E2E against Green.
3. Shift 10% of traffic to Green via LB/CDN.
4. Monitor 5xx and p95 for 10 minutes.
5. Increase to 50%, then 100% if stable.
6. If issues arise, revert traffic to Blue immediately.
7. Investigate with logs/metrics and roll forward a fix.

## Rollback Command Examples
- CDN/LB: reduce Green weight to 0; increase Blue to 100.
- Kubernetes (if applicable): scale down Green deployment; scale up Blue.

## Validation
- Confirm error rate normalized and latencies back to baseline.
- Confirm order creation and product listing happy paths.

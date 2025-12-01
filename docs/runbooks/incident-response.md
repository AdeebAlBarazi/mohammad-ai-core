# Incident Response Overview

## Purpose
Unified guide for triaging production issues surfaced by Prometheus / Alertmanager.

## Severity Levels
| Level | Description | Target Response |
|-------|-------------|-----------------|
| info | Optimization opportunity (cache ratio, minor latency drift) | 24h |
| warning | Degraded performance / partial feature impact (search relevance drop, elevated latency) | 2h |
| critical | User-facing outage / revenue impact (payments failing, 5xx spike) | 15m |

## Initial Triage Checklist (≤5 min)
1. Identify alert name & group (search, payments, core HTTP).
2. Check Grafana dashboard panels relevant to alert.
3. Confirm scope (one route vs global, one region vs all countries).
4. Review last deployment timestamp & diff summary.
5. Gather top 3 metrics snapshots (error rate, latency p95, request volume).

## Decision Tree
- Payments failing? → Prioritize rollback / secret validation → Webhook logs → Retry queue.
- Search zero-results spike? → Synonyms / index health → Data ingestion recency.
- Latency high & CPU saturated? → Identify heavy aggregation or `$lookup`, consider temporary feature flag reduction.
- Cache ratio low? → Adjust TTL, reduce invalidations from write burst.

## Communication
| Channel | Use |
|---------|-----|
| On-call chat | Real-time coordination |
| Incident doc (this runbook / external system) | Chronological actions |
| Stakeholder update (email/slack) | Service impact & ETA |

## Containment Actions
| Issue | Action | Risk |
|-------|--------|------|
| High search latency | Disable media expansion by default | Reduced result richness |
| Payment failures (Stripe) | Switch to test key for verification | No real charges processed |
| Elevated 5xx | Roll back last deployment | Potential reintroduce old bugs |
| Cache ineffective | Increase TTL to 120s | Slightly stale product list |

## Data Collection Commands (PowerShell)
```powershell
# 5xx error rate
curl http://localhost:9090/api/v1/query?query=sum(rate(http_errors_total{class="5xx",job="market"}[5m]))
# Search zero-result ratio
curl http://localhost:9090/api/v1/query?query=(sum(rate(market_search_zero_results_total[5m]))%20/%20sum(rate(market_search_requests_total[5m])))
# Payment provider failure ratio
curl http://localhost:9090/api/v1/query?query=(sum(rate(market_payment_provider_fail_total[5m]))%20/%20(sum(rate(market_payment_provider_fail_total[5m]))+sum(rate(market_payment_provider_success_total[5m]))))
# p95 search latency
curl "http://localhost:9090/api/v1/query?query=histogram_quantile(0.95,sum(rate(market_search_duration_seconds_bucket[5m]))%20by%20(le))"
```

## Post-Incident Review
1. Timeline: detection → triage start → containment → resolution.
2. Root cause analysis (code change, infra, external provider).
3. Preventive actions (index addition, circuit breaker, retry policy).
4. Update thresholds if chronic false positives.
5. Add missing metrics / logs required during investigation.

## Arabic Summary (ملخص عربي)
هذا المستند يلخص إدارة الحوادث: تحديد الشدة، خطوات أولية، إجراءات احتواء، أوامر جمع بيانات، ومراجعة لاحقة. الهدف تقليل زمن التعافي وزيادة وضوح السبب الجذري.

## References
- Runbooks directory
- Prometheus rules files
- Grafana dashboards

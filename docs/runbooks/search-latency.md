# Runbook: Search Latency (p95) High

## Symptom
Alert: `MarketSearchLatencyP95High` p95 >1.2s for sustained period.

## Impact
- Slower product discovery; potential timeouts on low bandwidth clients.
- Increased backend CPU & memory (aggregation queues).

## Immediate Checklist
1. Verify Mongo health: `db.serverStatus().wiredTiger.cache` (look for eviction pressure).
2. Inspect current aggregate pipeline complexity (recent changes?).
3. Check host resource usage (Grafana Node CPU / Memory panels).
4. Confirm cache hit ratio is acceptable (>50% for eligible queries).

## Profiling Steps
| Step | Command / Action | Reason |
|------|------------------|--------|
|1|Enable slow query log threshold (e.g. 400ms) in Mongo|Collect slow pipeline examples|
|2|Export an example aggregation (from code) and run `explain("executionStats")`|Identify stages with high `docsExamined`|
|3|Check index coverage for `$match` predicates (countryCode, active, material)|Reduce full collection scans|
|4|Measure network latency to DB (`ping` / `traceroute` if remote Atlas)|Rule out connectivity|
|5|Compare p50 vs p95 vs p99 using ad-hoc PromQL|Determine tail pattern cause|

## Common Bottlenecks
- Missing compound index for frequent filters (countryCode+active+material).
- `$lookup` on large collections without selective `$match` first.
- Facet returning huge intermediate sets (no early filtering).
- Over-expansion (media + variants + vendor) for majority of queries.

## Mitigations
- Add selective projection early (remove unused fields).
- Introduce per-feature expansion gating (only expand media when explicitly requested).
- Precompute vendor rating summary snapshot to avoid repeated lookups.
- Consider separate search microservice with ES / Atlas Search for advanced scoring.

## Longer Term
- Implement adaptive caching keyed by query tokens.
- Add circuit breaker: if latency > threshold revert to simplified pipeline.
- Store daily material/thickness facets in a small collection for quick retrieval.

## Verification
p95 drops <800ms over next 1h; error rate unchanged; zero-result ratio stable.

## Arabic Summary (ملخص عربي)
ارتفاع زمن بحث p95. افحص مؤشرات Mongo، راجع مراحل التجميع `$lookup` والفلاتر، قلل التوسعات، أضف كاش تكيفي.

## References
- Metrics: `market_search_duration_seconds_bucket`
- Code: `productRepo.js` aggregation pipeline.
- Indexes: Product model indexes.

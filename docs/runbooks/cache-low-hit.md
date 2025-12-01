# Runbook: Low Products Cache Hit Ratio

## Symptom
Alert: `MarketSearchCacheIneffective` hit ratio <20% for 30m.

## Impact
- Increased DB / aggregation load for first-page product queries.
- Higher average latency and infrastructure cost.

## Quick Checks
1. Confirm metric values:
   - Hits: `sum(rate(market_products_cache_hits_total[5m]))`
   - Misses: `sum(rate(market_products_cache_misses_total[5m]))`
2. Validate cache conditions: only first page, no search/category filters.
3. Review recent invalidations (product CRUD frequency).
4. Check TTL: env `MARKET_CACHE_TTL_MS` (default 30000ms).

## Diagnosis Steps
| Step | Action | Purpose |
|------|--------|---------|
|1|List last 50 product mutation events|Assess churn causing invalidation|
|2|Increase TTL temporarily to 60s|Observe hit ratio change|
|3|Add instrumentation for cache key computed values|Detect key skew|
|4|Compare product list query variety (countryCode differences)|Potential multi-country fragmentation|

## Common Causes
- TTL too short relative to request rate.
- Excessive cache invalidations due to frequent writes (seller testing / bulk ingest).
- Key includes a varying field unexpectedly (e.g. locale header leaking in key).
- Low traffic (ratio unstable on small denominator).

## Mitigations
- Raise TTL: `MARKET_CACHE_TTL_MS=60000`.
- Batch product updates to reduce invalidations.
- Add secondary layer: per-country precomputed snapshot warmed by cron.
- Skip invalidation for updates not affecting first-page ordering (e.g., non-price metadata).

## Verification
Hit ratio >50% over next 1h while latency stable or improved.

## Arabic Summary (ملخص عربي)
معدل ضرب الكاش منخفض. زِد قيمة TTL، قلّل تحديثات المنتج المتفرقة، تأكد من صحة مفتاح الكاش وعدم إدخال حقول متغيرة.

## References
- Code: `src/cache/productsCache.js`
- Env: `MARKET_CACHE_TTL_MS`, `MARKET_CACHE_LIMIT`
- Metrics: `market_products_cache_*`

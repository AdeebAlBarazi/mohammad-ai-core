# Runbook: High Zero-Result Search Rate

## Symptom
Alert fires: `MarketSearchZeroResultSpike` or `MarketSearchZeroResultCritical`.
Zero-result ratio exceeds threshold for sustained period.

## Impact
- Users fail to find products -> lower conversion.
- Fallback usage may rise (partial matches) reducing relevance quality.

## Quick Checks (5 min)
1. Grafana Panel: "Zero Result Rate (%)" confirm sustained elevation.
2. Compare query volume: `rate(market_search_requests_total[5m])`.
3. Inspect recent deployments or synonym file changes (`services/market/search/synonyms.json`).
4. Check Mongo connectivity: `/readyz` endpoint (`dbConnected: true`).

## Diagnosis Steps
| Step | Action | Goal |
|------|--------|------|
|1|Sample queries causing zero results (enable debug logging temporarily)|Identify patterns (short queries, typos, new materials)|
|2|Run manual regex test in Mongo shell using same pattern (synonym expansion)|Confirm whether data truly absent|
|3|Check product indexing status: `db.products.getIndexes()` ensure text index present|Verify index drift|
|4|Assess recent product ingestion volume|Ensure data exists for expected categories|
|5|Review synonyms for missing Arabic/English mapping|Expand coverage|

## Common Causes & Fixes
- Missing synonyms for new material names -> Add entries and reload.
- Products not yet ingested in target `countryCode` -> Seed or ingest.
- Text index dropped (migration) -> Run ensure indexes script.
- Query too short (<3 chars) -> Educate UI or enforce minimum length.
- Category filter overly restrictive -> Validate query params from client.

## Mitigation
- Add temporary UI hint guiding broader search.
- Implement real-time logging for top failing queries.
- If index missing: run
```powershell
node scripts/ensure-indexes.js
```

## Longer Term Improvements
- Add fuzzy (Levenshtein) pass for >4 char queries.
- Add popularity boosting + fallback synonyms for brand names.
- Offline job to learn new synonym pairs from successful sessions.

## Verification
Zero-result ratio returns < 20% sustained over 30m.

## Arabic Summary (ملخص عربي)
معدل نتائج البحث الفارغة مرتفع.
الخطوات: التأكد من المؤشرات، فحص المرادفات، مراجعة الاستعلامات، إضافة مواد مفقودة.
حل سريع: تحديث `synonyms.json` أو إعادة بناء الفهارس ثم مراقبة النسبة.

## References
- File: `services/market/search/synonyms.json`
- Index: Product text index (name/material)
- Metrics: `market_search_zero_results_total`, `market_search_requests_total`

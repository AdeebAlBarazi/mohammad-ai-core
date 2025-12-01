# Runbook: High Search Fallback Usage

## Symptom
Alert: `MarketSearchFallbackHigh` (>50% of zero-result queries rescued by fallback).
Indicates primary matching (original query) often fails; truncated fallback works.

## Impact
- Relevance degraded.
- Users see less precise matches (prefix only) -> potential dissatisfaction.

## Quick Checks
1. Confirm fallback success % panel in Grafana.
2. Review top original vs fallback strings (enable temporary debug log around search handler).
3. Validate synonym coverage for full tokens.

## Diagnosis Steps
| Step | Action | Goal |
|------|--------|------|
|1|Collect 20 sample original queries producing fallback|Detect pattern (typos, plural forms, transliteration)|
|2|Check if products contain full token (Mongo find with regex)|Confirm missing data vs matching issue|
|3|Inspect text index health (`db.products.getIndexes()`) |Ensure index intact|
|4|Compare fallback prefix length to product naming conventions|Adjust fallback strategy|
|5|Check category/material filters presence|Over-filtering may cause zero primary results|

## Common Causes
- Missing synonyms for full word (only prefix matches).
- Over-aggressive regex due to special characters escaping incorrectly.
- Products recently ingested but not yet indexed (latency).
- User entering composite terms not stored (e.g., "marblepolished").

## Mitigations
- Add synonyms for composite or transliterated terms.
- Introduce tokenization step splitting camel/prefix combos.
- Add minimal length requirement (e.g. reject q <3 chars with hint).
- Consider secondary fuzzy layer instead of naive truncation.

## Improvements Roadmap
- Implement Levenshtein distance scoring for full word attempts.
- Add alias table for plural/singular normalization.
- Track top fallback conversions (orders after fallback) to justify synonym additions.

## Arabic Summary (ملخص عربي)
الاستخدام العالي للانحدار يعني فشل المطابقة الأولية. راجع المرادفات، تأكد من صحة الفهارس، أضف معالجة تهجئة أو تقسيم للكلمات المركبة.

## Verification
Fallback success ratio <30% for zero-result queries over next 24h.

## References
- Metrics: `market_search_fallback_total`, `market_search_zero_results_total`
- Code: `server.js` search handler fallback logic.
- Synonyms file.

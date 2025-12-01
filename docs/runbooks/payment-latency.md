# Runbook: Payment Intent Creation Latency High

## Symptom
Alert: `MarketPaymentIntentCreationLatencyHigh` p95 >2s for 10m.

## Impact
- Checkout flow feels sluggish; potential client timeouts.
- Increased abandonment before payment confirmation.

## Quick Checks
1. Grafana panel for provider creation p95 vs normal request latency.
2. Stripe dashboard API request log (filter by `payment_intents.create`).
3. Check container/node CPU saturation and network RTT to Stripe endpoints.

## Diagnosis Steps
| Step | Action | Purpose |
|------|--------|---------|
|1|Enable debug log around intent creation capturing timestamps|Measure internal vs external latency|
|2|Run `curl` direct to Stripe from host to compare baseline|Rule out app overhead|
|3|Check if automatic payment methods causing extra network negotiation|Simplify parameters temporarily|
|4|Inspect DNS resolution time (dig api.stripe.com)|DNS latency|
|5|Validate no blocking synchronous code before API call|Reduce internal delay|

## Common Causes
- Network congestion or degraded route to Stripe region.
- Excessive synchronous preprocessing (price formatting, metadata building loops).
- Transient Stripe performance issues (check status page).
- Container resource starvation (CPU throttling).

## Mitigations
- Implement async precomputation of metadata outside request path.
- Add local retry with jitter for intermittent slowness (do NOT duplicate charge creation).
- Cache currency minor unit conversion logic.
- Consider regional edge (Stripe global) or enabling alternative payment method separation.

## Verification
p95 <1s for next 1h while failure rate unchanged.

## Arabic Summary (ملخص عربي)
زمن إنشاء نية الدفع مرتفع. افحص أداء الشبكة، سجل طلبات Stripe، عوامل CPU، ثم قلل العمليات المتزامنة قبل الاستدعاء.

## References
- Metrics: `market_payment_provider_duration_seconds_bucket`
- Code: `paymentProviders/stripe.js` and creation endpoint in `server.js`

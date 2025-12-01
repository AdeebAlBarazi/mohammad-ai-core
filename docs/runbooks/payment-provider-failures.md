# Runbook: Payment Provider Failure Rate High

## Symptom
Alerts: `MarketPaymentProviderFailureRate` (warning) or `MarketPaymentProviderFailureCritical` (critical).
Failure ratio = fails / (fails + successes) exceeds defined threshold.

## Impact
- Users cannot complete checkout -> direct revenue loss.
- Orders stuck in `paymentStatus=pending`.

## Quick Triage (5 min)
1. Grafana panel: failure % and success rate trend.
2. Check Stripe status page (https://status.stripe.com/).
3. Confirm recent deployment touching payment code.
4. Verify env vars: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` correct (no whitespace).

## Diagnosis Steps
| Step | Action | Purpose |
|------|--------|---------|
|1|Inspect application logs for `payment_intent_provider_created` events|Separate creation vs webhook failures|
|2|List webhook deliveries in Stripe Dashboard (Developers -> Webhooks)|Identify signature errors or 500 responses|
|3|Run test intent via curl (server) to verify API key|Confirm credentials active|
|4|Check network egress (firewall / proxy) if self-hosted|Rule out connectivity issues|
|5|Validate time drift (<5s) if signature mismatch persists|Prevent HMAC timestamp invalidation|

## Common Causes
- Incorrect `STRIPE_WEBHOOK_SECRET` after rotating endpoint secret.
- Expired or restricted API key (permission changes).
- Webhook route not using raw body (double JSON parse breaks signature).
- High latency causing client confirmations to timeout.
- Rate limit / 429 responses due to spiky test traffic.

## Mitigations
- Re-enter correct webhook signing secret, redeploy.
- Roll back recent payment code change introducing parsing modifications.
- Add exponential retry for transient provider errors (HTTP 5xx, 429).
- Temporarily disable new high-volume test script.

## Verification
Failure ratio <5% over next 1h; successful intents increasing.

## Arabic Summary (ملخص عربي)
ارتفاع معدل فشل مزود الدفع. تحقق من سر التوقيع، صحة المفتاح، سجل الويب هوك، حالة Stripe. أصلح الأخطاء ثم راقب انخفاض النسبة.

## References
- Metrics: `market_payment_provider_fail_total`, `market_payment_provider_success_total`
- Audit events: `payment_intent_provider_created`, `payment_webhook_received`
- Code: `server.js` payment provider integration, `paymentProviders/stripe.js`

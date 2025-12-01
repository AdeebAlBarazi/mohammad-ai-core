# WAF/CDN Blueprint (Cloudflare + AWS)

Purpose: put frontend and API behind a robust edge (CDN + WAF) with baseline protections against XSS, injection attempts, and basic DDoS, while preserving HTTPS and origin security.

## Cloudflare (DNS + CDN + WAF)

- DNS/Proxy:
  - Orange-cloud the frontend and API hostnames to proxy through Cloudflare.
  - SSL/TLS mode: Full (strict). Upload a valid certificate to your origin (or ACM on ALB) and use Cloudflare Origin CA if needed.
- HTTPS/HSTS:
  - Always Use HTTPS: On.
  - HSTS: enable with max-age >= 15552000 (180d), include subdomains as needed.
- WAF Managed Rules:
  - Enable Cloudflare Managed Rules (OWASP CRS-based protections).
  - Turn on Bot Fight Mode if acceptable; otherwise use Super Bot Fight (paid) for finer control.
- Rate Limiting Rules (recommend):
  - Create rules targeting API paths with thresholds aligned to your app limits:
    - /api/v1/auth/login and /api/v1/auth/register — low threshold (e.g., 10 req/min per IP).
    - /api/v1/market/cart — moderate (e.g., 60 req/min per IP).
    - /api/v1/market/orders — stricter (e.g., 30 req/min per IP).
    - /api/v1/market/media/upload — stricter (e.g., 30 req/min per IP).
  - Action: Block or Challenge for a short TTL (e.g., 10–30 minutes).
- Firewall Rules (optional extras):
  - Restrict admin endpoints to specific IP/Country if feasible.
  - Challenge requests with suspicious user-agents.
- Cache rules:
  - Bypass cache for API routes (Cache Level: Bypass).
  - Cache static assets for the frontend aggressively with versioned filenames.
- Headers:
  - Ensure Cloudflare sends `X-Forwarded-Proto: https` so Express trust proxy flags cookies Secure.

## AWS WAF (with CloudFront or ALB)

- Where to attach:
  - CloudFront (recommended for global CDN): associate Web ACL ARN with the distribution.
  - Or attach to an ALB/API Gateway if not using CloudFront yet.
- Managed Rule Groups (enable):
  - AWSManagedRulesCommonRuleSet (includes XSS patterns and generic attacks)
  - AWSManagedRulesKnownBadInputsRuleSet
  - AWSManagedRulesSQLiRuleSet
  - AWSManagedRulesAmazonIpReputationList
  - Optional: AWSManagedRulesBotControlRuleSet (paid)
- Rate-based Rules (basic DDoS throttling):
  - Add IP-based rate limits with scope-down statements to API paths like /api/.
- Logging/Monitoring:
  - Enable WAF logs to S3/CloudWatch; set CloudWatch metrics alarms on high block counts or elevated rate-limit triggers.

### Terraform Example (CloudFront scope)

See `infra/waf/terraform/aws-waf-web-acl.tf`:
- Creates a Web ACL in `us-east-1` (required for CloudFront scope)
- Adds managed rule groups (Common, SQLi, KnownBadInputs, IPReputation)
- Optional BotControl via variable
- Adds rate-based rules for auth/cart/orders/upload paths (scope-down by URI prefix)
- Output: Web ACL ARN for association

Associate with CloudFront distribution (example):

```hcl
resource "aws_cloudfront_distribution" "site" {
  # ... your distribution config ...
  web_acl_id = aws_wafv2_web_acl.market.arn
}
```

For ALB association:

```hcl
resource "aws_wafv2_web_acl_association" "alb_assoc" {
  resource_arn = aws_lb.api.arn
  web_acl_arn  = aws_wafv2_web_acl.market.arn
}
```

Apply with Terraform:

```powershell
# Ensure AWS credentials are set for us-east-1
cd .\infra\waf\terraform
terraform init
terraform plan -var "waf_name=axiom-market-waf" -var "rate_limit_auth=200" -var "rate_limit_cart=600" -var "rate_limit_orders=300" -var "rate_limit_upload=180"
terraform apply
```

## App Integration (already done in code)

- HTTPS/HSTS: app supports HTTPS redirect (`FORCE_HTTPS=1`) and HSTS (`HSTS_MAX_AGE_SECONDS`). Behind CloudFront/ALB/Cloudflare, set `TRUST_PROXY_HOPS` correctly so cookies get `Secure`.
- Rate limiting at origin: we enforce additional route-specific limits; edge WAF limits add an earlier layer.
- CSP/CORS: configured to only allow your frontend/admin origins and storage/CDN domains.

## Quick Validation

- Injection probes (should be blocked by WAF):
  - Append `?q=%3Cscript%3Ealert(1)%3C%2Fscript%3E` to a GET endpoint.
  - Try `q=' OR '1'='1` on read-only endpoints.
- DDoS throttle: hit /api/v1/auth/login rapidly from a single IP and observe rate-limit block at the edge before origin.
- Check WAF logs/Cloudflare Security Events for blocks and throttles.

## Notes

- Cloudflare vs AWS WAF: you can run Cloudflare in front of AWS (CloudFront optional). If you keep both, prefer most coarse throttling at Cloudflare, keep AWS WAF as second line.
- For advanced bot protection, enable Cloudflare Bot Management or AWS Shield Advanced + WAF Bot Control.

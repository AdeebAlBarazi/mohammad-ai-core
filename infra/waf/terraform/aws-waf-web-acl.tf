# AWS WAF v2 Web ACL for CloudFront (CLOUDFRONT scope)
# Region must be us-east-1 for CloudFront-scoped WAF

terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = ">= 5.0"
    }
  }
}

provider "aws" {
  region = var.aws_region
}

variable "aws_region" {
  description = "AWS region. For CLOUDFRONT scope, must be us-east-1"
  type        = string
  default     = "us-east-1"
}

variable "waf_name" {
  description = "Name for the Web ACL"
  type        = string
  default     = "axiom-market-waf"
}

variable "enable_bot_control" {
  description = "Enable AWS Bot Control managed rule (requires paid tier)"
  type        = bool
  default     = false
}

# Optional: Customize per-endpoint rate limits (requests per 5 minutes per IP)
variable "rate_limit_cart" { type = number, default = 600 }
variable "rate_limit_orders" { type = number, default = 300 }
variable "rate_limit_auth" { type = number, default = 200 }
variable "rate_limit_upload" { type = number, default = 180 }

locals {
  scope = "CLOUDFRONT"
}

resource "aws_wafv2_web_acl" "market" {
  name        = var.waf_name
  description = "WAF for marketplace and API"
  scope       = local.scope

  default_action { allow {} }

  visibility_config {
    sampled_requests_enabled   = true
    cloudwatch_metrics_enabled = true
    metric_name                = "market-waf"
  }

  # Managed rule groups (XSS/SQLi/Bad Inputs/IP Reputation)
  rule {
    name     = "AWSCommonRuleSet"
    priority = 10
    statement {
      managed_rule_group_statement {
        name        = "AWSManagedRulesCommonRuleSet"
        vendor_name = "AWS"
      }
    }
    override_action { none {} }
    visibility_config {
      sampled_requests_enabled   = true
      cloudwatch_metrics_enabled = true
      metric_name                = "AWSCommonRuleSet"
    }
  }

  rule {
    name     = "KnownBadInputs"
    priority = 20
    statement {
      managed_rule_group_statement {
        name        = "AWSManagedRulesKnownBadInputsRuleSet"
        vendor_name = "AWS"
      }
    }
    override_action { none {} }
    visibility_config {
      sampled_requests_enabled   = true
      cloudwatch_metrics_enabled = true
      metric_name                = "KnownBadInputs"
    }
  }

  rule {
    name     = "SQLi"
    priority = 30
    statement {
      managed_rule_group_statement {
        name        = "AWSManagedRulesSQLiRuleSet"
        vendor_name = "AWS"
      }
    }
    override_action { none {} }
    visibility_config {
      sampled_requests_enabled   = true
      cloudwatch_metrics_enabled = true
      metric_name                = "SQLi"
    }
  }

  rule {
    name     = "IpReputation"
    priority = 40
    statement {
      managed_rule_group_statement {
        name        = "AWSManagedRulesAmazonIpReputationList"
        vendor_name = "AWS"
      }
    }
    override_action { none {} }
    visibility_config {
      sampled_requests_enabled   = true
      cloudwatch_metrics_enabled = true
      metric_name                = "IpReputation"
    }
  }

  dynamic "rule" {
    for_each = var.enable_bot_control ? [1] : []
    content {
      name     = "BotControl"
      priority = 45
      statement {
        managed_rule_group_statement {
          name        = "AWSManagedRulesBotControlRuleSet"
          vendor_name = "AWS"
        }
      }
      override_action { none {} }
      visibility_config {
        sampled_requests_enabled   = true
        cloudwatch_metrics_enabled = true
        metric_name                = "BotControl"
      }
    }
  }

  # Simple DDoS mitigation via rate-based rules (scoped to API paths)
  rule {
    name     = "RateLimitAuth"
    priority = 100
    statement {
      rate_based_statement {
        limit              = var.rate_limit_auth
        aggregate_key_type = "IP"
        scope_down_statement {
          byte_match_statement {
            field_to_match { uri_path {} }
            positional_constraint = "STARTS_WITH"
            search_string         = "/api/"
            text_transformations { priority = 0, type = "NONE" }
          }
        }
      }
    }
    action { block {} }
    visibility_config { sampled_requests_enabled = true, cloudwatch_metrics_enabled = true, metric_name = "RateLimitAuth" }
  }

  rule {
    name     = "RateLimitCart"
    priority = 110
    statement {
      rate_based_statement {
        limit              = var.rate_limit_cart
        aggregate_key_type = "IP"
        scope_down_statement {
          byte_match_statement {
            field_to_match { uri_path {} }
            positional_constraint = "STARTS_WITH"
            search_string         = "/api/"
            text_transformations { priority = 0, type = "NONE" }
          }
        }
      }
    }
    action { block {} }
    visibility_config { sampled_requests_enabled = true, cloudwatch_metrics_enabled = true, metric_name = "RateLimitCart" }
  }

  rule {
    name     = "RateLimitOrders"
    priority = 120
    statement {
      rate_based_statement {
        limit              = var.rate_limit_orders
        aggregate_key_type = "IP"
        scope_down_statement {
          byte_match_statement {
            field_to_match { uri_path {} }
            positional_constraint = "STARTS_WITH"
            search_string         = "/api/"
            text_transformations { priority = 0, type = "NONE" }
          }
        }
      }
    }
    action { block {} }
    visibility_config { sampled_requests_enabled = true, cloudwatch_metrics_enabled = true, metric_name = "RateLimitOrders" }
  }

  rule {
    name     = "RateLimitUpload"
    priority = 130
    statement {
      rate_based_statement {
        limit              = var.rate_limit_upload
        aggregate_key_type = "IP"
        scope_down_statement {
          byte_match_statement {
            field_to_match { uri_path {} }
            positional_constraint = "STARTS_WITH"
            search_string         = "/api/"
            text_transformations { priority = 0, type = "NONE" }
          }
        }
      }
    }
    action { block {} }
    visibility_config { sampled_requests_enabled = true, cloudwatch_metrics_enabled = true, metric_name = "RateLimitUpload" }
  }
}

output "web_acl_arn" {
  value = aws_wafv2_web_acl.market.arn
}

# Associate the WAF with CloudFront or ALB:
# - For CloudFront, set distribution.web_acl_id = aws_wafv2_web_acl.market.arn
# - For ALB, create aws_wafv2_web_acl_association with resource_arn = alb_arn

output "dns_setup_instructions" {
  value = <<-EOT

=================================================================
DNS SETUP REQUIRED
=================================================================

Create these DNS records at your DNS provider:

1. ACM Certificate Validation for JMAP API (temporary):
   Name:  ${try(tolist(aws_acm_certificate.api.domain_validation_options)[0].resource_record_name, "See AWS Console")}
   Type:  CNAME
   Value: ${try(tolist(aws_acm_certificate.api.domain_validation_options)[0].resource_record_value, "See AWS Console")}
   TTL:   300

2. ACM Certificate Validation for Root Domain (temporary):
   Name:  ${try(tolist(aws_acm_certificate.root_autodiscovery.domain_validation_options)[0].resource_record_name, "See AWS Console")}
   Type:  CNAME
   Value: ${try(tolist(aws_acm_certificate.root_autodiscovery.domain_validation_options)[0].resource_record_value, "See AWS Console")}
   TTL:   300

3. JMAP API Subdomain:
   Name:  jmap.${var.root_domain_name}
   Type:  CNAME
   Value: ${aws_apigatewayv2_domain_name.jmap.domain_name_configuration[0].target_domain_name}
   TTL:   300

4. Root Domain Autodiscovery:
   Name:  ${var.root_domain_name}
   Type:  A or CNAME
   Value: ${aws_cloudfront_distribution.autodiscovery.domain_name}
   TTL:   300
   
   Note: This handles ONLY /.well-known/jmap (RFC 8620 autodiscovery).
         Deploy web client separately (can be at subdomain or different domain).

5. SRV Record for JMAP Autodiscovery:
   Name:  _jmap._tcp.${var.root_domain_name}
   Type:  SRV
   Value: 0 1 443 jmap.${var.root_domain_name}.
   TTL:   3600

Wait 10-15 minutes for DNS propagation and certificate validation.

=================================================================
EOT
}

output "jmap_api_url" {
  description = "JMAP API base URL"
  value       = "https://jmap.${var.root_domain_name}"
}

output "jmap_session_endpoint" {
  description = "JMAP session endpoint"
  value       = "https://jmap.${var.root_domain_name}/.well-known/jmap"
}

output "autodiscovery_test" {
  description = "Test autodiscovery redirect"
  value       = "curl -I https://${var.root_domain_name}/.well-known/jmap"
}

output "api_gateway_target" {
  description = "Target domain for jmap.domain.com CNAME"
  value       = aws_apigatewayv2_domain_name.jmap.domain_name_configuration[0].target_domain_name
}

output "cloudfront_autodiscovery_target" {
  description = "Target domain for root domain CNAME or A record"
  value       = aws_cloudfront_distribution.autodiscovery.domain_name
}

output "cert_validation_records" {
  description = "Certificate validation CNAME records"
  value = {
    api_cert = try({
      name  = tolist(aws_acm_certificate.api.domain_validation_options)[0].resource_record_name
      value = tolist(aws_acm_certificate.api.domain_validation_options)[0].resource_record_value
    }, {})
    root_cert = try({
      name  = tolist(aws_acm_certificate.root_autodiscovery.domain_validation_options)[0].resource_record_name
      value = tolist(aws_acm_certificate.root_autodiscovery.domain_validation_options)[0].resource_record_value
    }, {})
  }
}

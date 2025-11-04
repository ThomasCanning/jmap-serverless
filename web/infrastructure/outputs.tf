output "dns_setup_instructions" {
  value = <<-EOT

=================================================================
DNS SETUP REQUIRED
=================================================================

Create these DNS records at your DNS provider:

1. ACM Certificate Validation (temporary):
   Name:  ${try(tolist(aws_acm_certificate.root_cf.domain_validation_options)[0].resource_record_name, "See AWS Console")}
   Type:  CNAME
   Value: ${try(tolist(aws_acm_certificate.root_cf.domain_validation_options)[0].resource_record_value, "See AWS Console")}
   TTL:   300
   
   Note: Wait for certificate to validate (5-10 minutes) before creating A record.

2. Web Client Domain (after cert validates):
   Name:  ${var.deployment_domain}
   Type:  A or CNAME
   Value: ${aws_cloudfront_distribution.root.domain_name}
   TTL:   300
   
   Note: Some DNS providers require ALIAS record for root domains.

3. (Optional) AAAA Record for IPv6:
   Name:  ${var.deployment_domain}
   Type:  AAAA or CNAME
   Value: ${aws_cloudfront_distribution.root.domain_name}
   TTL:   300

Wait 10-15 minutes for DNS propagation.

Test: curl https://${var.deployment_domain}

=================================================================
EOT
}

output "website_url" {
  description = "Website URL"
  value       = "https://${var.deployment_domain}"
}

output "cloudfront_domain" {
  description = "CloudFront distribution domain (target for DNS)"
  value       = aws_cloudfront_distribution.root.domain_name
}

output "cloudfront_distribution_id" {
  description = "CloudFront distribution ID"
  value       = aws_cloudfront_distribution.root.id
}

output "s3_bucket_name" {
  description = "S3 bucket name"
  value       = aws_s3_bucket.site.id
}

output "cert_validation_record" {
  description = "Certificate validation CNAME record"
  value = try({
    name  = tolist(aws_acm_certificate.root_cf.domain_validation_options)[0].resource_record_name
    value = tolist(aws_acm_certificate.root_cf.domain_validation_options)[0].resource_record_value
  }, {})
}


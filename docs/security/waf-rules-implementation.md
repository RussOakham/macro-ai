# 🚨 WAF Rules Implementation

This document outlines the comprehensive Web Application Firewall (WAF) implementation for the Macro AI infrastructure, providing enterprise-grade protection against common web attacks and security threats.

## 📋 Security Architecture Overview

### Layered Security Approach

The security implementation follows a defense-in-depth strategy with multiple protection layers:

```
┌─────────────────┐
│   AWS Shield    │ ← DDoS Protection (Always-on)
├─────────────────┤
│  AWS WAF        │ ← Application Layer Protection
├─────────────────┤
│ Security Headers│ ← Response Header Protection
├─────────────────┤
│   Application   │ ← Application-Level Security
└─────────────────┘
```

### WAF Protection Coverage

The WAF implementation provides comprehensive protection against:

- **SQL Injection Attacks**: Database query manipulation attempts
- **Cross-Site Scripting (XSS)**: JavaScript injection attacks
- **Common Web Attacks**: Directory traversal, command injection
- **Rate Limiting**: Brute force and DoS attack prevention
- **Geo-blocking**: Geographic access control
- **Bot Protection**: Automated attack pattern detection

## 🛡️ AWS WAF Implementation

### WebACL Configuration

The WAF WebACL includes the following rule groups and custom rules:

#### AWS Managed Rules (Priority 1-5)

```typescript
// Core Protection Rules
1. AWSManagedRulesCommonRuleSet
   - Cross-site scripting (XSS) protection
   - SQL injection protection
   - Known bad inputs
   - HTTP protocol violations

2. AWSManagedRulesKnownBadInputsRuleSet
   - Log4j vulnerability protection
   - Java deserialization exploits
   - Command injection attempts

3. AWSManagedRulesSQLiRuleSet
   - SQL injection attack patterns
   - Blind SQL injection detection
   - Time-based SQL injection

4. AWSManagedRulesXSSRuleSet
   - Cross-site scripting patterns
   - DOM-based XSS protection
   - Reflected XSS detection

5. AWSManagedRulesLinuxRuleSet
   - Linux-specific attack patterns
   - Path traversal attempts
   - Local file inclusion
```

#### Custom Rules (Priority 6+)

```typescript
6. GeoBlockRule
   - Blocks requests from specified countries
   - Default blocked: China, Russia, North Korea
   - Configurable via environment variables

7. RateLimitRule
   - Rate limiting based on IP address
   - Default: 2000 requests per 5 minutes
   - Configurable per environment

8. BlockCommonAttacks
   - Directory traversal attempts (/../)
   - Suspicious query parameters
   - Known attack signatures
   - SQL injection patterns in headers
```

### Environment-Specific Configuration

#### Production Environment

```json
{
	"enableGeoBlocking": true,
	"blockedCountries": ["CN", "RU", "KP"],
	"rateLimitThreshold": 2000,
	"enableDetailedMonitoring": true,
	"enableAllManagedRules": true
}
```

#### Staging Environment

```json
{
	"enableGeoBlocking": false,
	"blockedCountries": [],
	"rateLimitThreshold": 5000,
	"enableDetailedMonitoring": true,
	"enableAllManagedRules": true
}
```

#### Development Environment

```json
{
	"enableGeoBlocking": false,
	"blockedCountries": [],
	"rateLimitThreshold": 10000,
	"enableDetailedMonitoring": false,
	"enableAllManagedRules": false
}
```

## 🔒 Security Headers Implementation

### HTTP Security Headers

The security headers Lambda@Edge function adds the following security headers:

#### Content Security Policy (CSP)

```http
Content-Security-Policy:
  default-src 'self';
  script-src 'self' 'unsafe-inline' 'unsafe-eval' https://*.macro-ai.com;
  style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
  font-src 'self' https://fonts.gstatic.com;
  img-src 'self' data: https: blob:;
  connect-src 'self' https://api.macro-ai.com wss://*.macro-ai.com;
  frame-ancestors 'none';
  base-uri 'self';
  form-action 'self';
```

#### Core Security Headers

```http
Strict-Transport-Security: max-age=31536000; includeSubDomains; preload
X-Frame-Options: DENY
X-Content-Type-Options: nosniff
X-XSS-Protection: 1; mode=block
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=()
```

#### CORS Headers (when applicable)

```http
Access-Control-Allow-Origin: https://macro-ai.com
Access-Control-Allow-Credentials: true
Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS, PATCH
Access-Control-Allow-Headers: Content-Type, Authorization, X-API-Key, X-Requested-With
Access-Control-Max-Age: 86400
```

### Environment-Specific Headers

#### Production

- Strict CSP with specific allowed domains
- HSTS with preload directive
- CORS restricted to production domains

#### Staging

- Relaxed CSP for testing
- HSTS without preload
- CORS for staging domains

#### Development

- Permissive CSP for localhost development
- No HSTS enforcement
- CORS for localhost origins

## 📊 Monitoring & Alerting

### WAF Metrics & Alarms

#### Blocked Requests Monitoring

```typescript
// High blocked requests alarm
const highBlockedRequestsAlarm = new cloudwatch.Alarm(
	this,
	'HighBlockedRequestsAlarm',
	{
		alarmName: `${environmentName}-waf-high-blocked-requests`,
		alarmDescription: 'High number of blocked requests detected by WAF',
		metric: blockedRequestsMetric,
		threshold: 100,
		evaluationPeriods: 5,
		comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
	},
)
```

#### Rate Limiting Alerts

```typescript
// Rate limit triggered alarm
const rateLimitAlarm = new cloudwatch.Alarm(this, 'RateLimitAlarm', {
	alarmName: `${environmentName}-waf-rate-limit-triggered`,
	alarmDescription: 'Rate limiting has been triggered',
	metric: rateLimitMetric,
	threshold: 50,
	evaluationPeriods: 3,
})
```

#### SQL Injection Detection

```typescript
// SQL injection attempts alarm
const sqlInjectionAlarm = new cloudwatch.Alarm(this, 'SqlInjectionAlarm', {
	alarmName: `${environmentName}-waf-sql-injection-attempts`,
	alarmDescription: 'SQL injection attempts detected',
	metric: sqlInjectionMetric,
	threshold: 10,
	evaluationPeriods: 5,
})
```

### CloudWatch Dashboard

The security dashboard includes:

1. **WAF Blocked vs Allowed Requests**
   - Real-time traffic analysis
   - Blocked request trends
   - Geographic distribution

2. **Rule Performance Metrics**
   - Individual rule effectiveness
   - False positive rates
   - Processing latency

3. **Security Threat Analysis**
   - Attack pattern identification
   - Top blocked IPs/countries
   - Time-based attack trends

## 🚀 Deployment & Configuration

### CDK Integration

The security components are integrated into the main production stack:

```typescript
// Add security stack to production environment
this.securityStack = new SecurityStack(this, 'Security', {
	environmentName,
	vpc: this.networking.vpc,
	loadBalancer: this.loadBalancer.loadBalancer,
	enableWaf: true,
	enableSecurityHeaders: true,
	enableSslEnforcement: true,
	rateLimitThreshold: 2000,
	enableGeoBlocking: true,
	blockedCountries: ['CN', 'RU', 'KP'],
})
```

### WAF Association

The WAF WebACL is automatically associated with the Application Load Balancer:

```typescript
// Associate WAF with ALB
this.wafConstruct.associateWithResource(loadBalancer.loadBalancerArn)
```

## 🔧 Maintenance & Updates

### Rule Updates

#### AWS Managed Rules

- Automatically updated by AWS
- No manual intervention required
- Version changes logged in CloudWatch

#### Custom Rules

- Updated via CDK deployments
- Configuration changes tracked in git
- Rollback capability via CloudFormation

### Monitoring Updates

#### Log Retention

```typescript
// WAF logs retention (default: 7 days)
logRetention: logs.RetentionDays.ONE_WEEK
```

#### Metric Collection

- Continuous metric collection
- Configurable retention periods
- Automated cleanup of old data

## 📈 Performance Considerations

### WAF Performance Impact

#### Latency Impact

- Typical latency increase: 5-15ms per request
- Managed rules processing: Minimal overhead
- Custom rules: Additional processing time

#### Cost Optimization

- Regional WAF: Lower cost than CloudFront WAF
- Rule evaluation: Pay per request
- Log storage: Configurable retention

### Scaling Considerations

#### Auto Scaling Integration

- WAF metrics feed into auto-scaling decisions
- Rate limiting triggers scale-out events
- Blocked request patterns inform capacity planning

#### Global Distribution

- Regional WAF for ALB protection
- CloudFront integration for global edge protection
- Geographic load balancing considerations

## 🛠️ Troubleshooting

### Common Issues

#### False Positives

```bash
# Check WAF logs for blocked legitimate requests
aws logs filter-log-events \
  --log-group-name /aws/waf/production \
  --filter-pattern '{ $.action = "BLOCK" }'
```

#### Rate Limiting Issues

```bash
# Monitor rate limiting metrics
aws cloudwatch get-metric-statistics \
  --namespace AWS/WAFV2 \
  --metric-name CountedRequests \
  --dimensions Name=Rule,Value=RateLimitRule
```

#### Configuration Validation

```bash
# Validate WAF WebACL configuration
aws wafv2 get-web-acl \
  --name production-web-acl \
  --scope REGIONAL \
  --region us-east-1
```

## 📚 Additional Resources

### AWS Documentation

- [AWS WAF Developer Guide](https://docs.aws.amazon.com/waf/latest/developerguide/)
- [AWS Managed Rules](https://docs.aws.amazon.com/waf/latest/developerguide/aws-managed-rule-groups.html)
- [Security Headers Best Practices](https://owasp.org/www-project-secure-headers/)

### Monitoring & Alerting

- [CloudWatch WAF Metrics](https://docs.aws.amazon.com/waf/latest/developerguide/monitoring-cloudwatch.html)
- [WAF Logging](https://docs.aws.amazon.com/waf/latest/developerguide/logging.html)

### Security Best Practices

- [OWASP Security Headers](https://owasp.org/www-project-secure-headers/)
- [Content Security Policy](https://content-security-policy.com/)

---

This implementation provides enterprise-grade security protection while maintaining performance and scalability. The layered approach ensures comprehensive coverage against modern web threats and attack vectors.

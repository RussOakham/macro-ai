# 🔐 SSL/TLS Certificates Implementation

This document outlines the comprehensive SSL/TLS certificate implementation for the Macro AI infrastructure, providing
enterprise-grade HTTPS encryption and certificate management.

## 📋 SSL/TLS Implementation Overview

### Security Architecture

The SSL/TLS implementation follows a layered security approach:

```text
┌─────────────────┐
│   AWS Shield    │ ← DDoS Protection (Always-on)
├─────────────────┤
│  AWS WAF        │ ← Application Layer Protection
├─────────────────┤
│ SSL/TLS         │ ← Transport Layer Encryption
├─────────────────┤
│ HTTPS Redirect  │ ← Protocol Enforcement
└─────────────────┘
```

### Implementation Components

#### 1. SSL Certificate Management

- AWS Certificate Manager (ACM) for certificate provisioning
- DNS validation for domain ownership verification
- Automated certificate renewal and rotation

#### 2. HTTPS Enforcement

- Application Load Balancer SSL termination
- HTTP to HTTPS automatic redirects
- SSL policy configuration for modern encryption

#### 3. Certificate Monitoring

- Expiration alerts and notifications
- Certificate health monitoring
- Automated renewal tracking

## 🛡️ AWS Certificate Manager (ACM) Implementation

### Certificate Configuration

#### Production Environment

```typescript
const certificate = new acm.Certificate(this, 'Certificate', {
	domainName: 'api.macro-ai.com',
	subjectAlternativeNames: [
		'*.macro-ai.com',
		'www.macro-ai.com',
		'staging.macro-ai.com',
	],
	validationMethod: acm.ValidationMethod.DNS,
	keyAlgorithm: acm.KeyAlgorithm.RSA_2048,
})
```

#### Certificate Properties

- **Algorithm**: RSA 2048-bit (recommended for compatibility)
- **Validation**: DNS validation (automated)
- **Renewal**: Automatic renewal 60 days before expiration
- **Transparency**: Certificate Transparency logging enabled

### DNS Validation

#### Route 53 Integration

```typescript
// Create DNS validation records
const validationRecords = this.certificate.domainValidationOptions.map(
	(validation, index) =>
		new route53.CnameRecord(this, `ValidationRecord${index}`, {
			zone: hostedZone,
			recordName: validation.resourceRecordName,
			recordValue: validation.resourceRecordValue,
			ttl: cdk.Duration.seconds(300),
		}),
)
```

#### Validation Process

1. ACM generates CNAME records for domain validation
2. CDK creates Route 53 records automatically
3. ACM validates domain ownership
4. Certificate is issued and becomes active

## 🔒 HTTPS Enforcement Implementation

### Application Load Balancer Configuration

#### HTTPS Listener Configuration

```typescript
const httpsListener = new elbv2.ApplicationListener(this, 'HttpsListener', {
	loadBalancer,
	port: 443,
	protocol: elbv2.ApplicationProtocol.HTTPS,
	certificates: [certificate],
	sslPolicy: 'ELBSecurityPolicy-TLS13-1-2-2021-06',
	defaultAction: elbv2.ListenerAction.forward([targetGroup]),
})
```

#### HTTP to HTTPS Redirect

```typescript
const httpListener = new elbv2.ApplicationListener(this, 'HttpListener', {
	loadBalancer,
	port: 80,
	protocol: elbv2.ApplicationProtocol.HTTP,
	defaultAction: elbv2.ListenerAction.redirect({
		protocol: 'HTTPS',
		port: '443',
		permanent: true, // 301 redirect
	}),
})
```

### SSL Policies

#### Modern SSL Policy Configuration

```typescript
sslPolicy: 'ELBSecurityPolicy-TLS13-1-2-2021-06'
```

**Supported Protocols:**

- TLS 1.3 (preferred)
- TLS 1.2 (fallback)

**Supported Cipher Suites:**

- ECDHE-RSA-AES128-GCM-SHA256
- ECDHE-RSA-AES256-GCM-SHA384
- ECDHE-RSA-CHACHA20-POLY1305

### Target Group Configuration

#### HTTPS Target Group

```typescript
const httpsTargetGroup = new elbv2.ApplicationTargetGroup(
	this,
	'HttpsTargetGroup',
	{
		targetGroupName: `${environmentName}-https-targets`,
		protocol: elbv2.ApplicationProtocol.HTTP, // ALB terminates SSL
		port: 3040, // Application port
		vpc,
		healthCheck: {
			path: '/api/health',
			interval: cdk.Duration.seconds(30),
			timeout: cdk.Duration.seconds(5),
			healthyThresholdCount: 3,
			unhealthyThresholdCount: 2,
		},
		targetType: elbv2.TargetType.IP, // For Fargate
	},
)
```

## 📊 Certificate Monitoring & Alerting

### Expiration Monitoring

#### CloudWatch Alarms

```typescript
// Certificate expiration alarm
const expirationAlarm = new cloudwatch.Alarm(
	this,
	'CertificateExpirationAlarm',
	{
		alarmName: `${environmentName}-ssl-certificate-expiration`,
		alarmDescription: `SSL certificate is expiring soon`,
		metric: new cloudwatch.Metric({
			namespace: 'AWS/CertificateManager',
			metricName: 'DaysToExpiry',
			dimensionsMap: {
				CertificateArn: certificateArn,
			},
			statistic: 'Minimum',
		}),
		threshold: 30, // Alert 30 days before expiration
		evaluationPeriods: 1,
		comparisonOperator:
			cloudwatch.ComparisonOperator.LESS_THAN_OR_EQUAL_TO_THRESHOLD,
		treatMissingData: cloudwatch.TreatMissingData.MISSING,
	},
)
```

#### Multi-Level Alerting

- **Warning**: 30 days before expiration
- **Critical**: 7 days before expiration
- **Emergency**: 1 day before expiration

### Certificate Health Monitoring

#### Lambda Function Monitoring

```typescript
const sslMonitoringLambda = new lambda.Function(this, 'SslMonitoring', {
	runtime: lambda.Runtime.NODEJS_18_X,
	code: lambda.Code.fromAsset('src/lambda/ssl-monitoring'),
	handler: 'index.handler',
	timeout: cdk.Duration.seconds(300), // 5 minutes for cross-region monitoring
	environment: {
		ENVIRONMENT: environmentName,
		ALERT_TOPIC_ARN: alertTopicArn,
		WARNING_DAYS: '30',
		CRITICAL_DAYS: '7',
		MONITOR_REGIONS: 'us-east-1,eu-west-1',
	},
})
```

#### Monitoring Metrics

- Certificate status (ISSUED, EXPIRED, FAILED)
- Days to expiration
- Validation status
- Renewal eligibility

## 🚀 Deployment & Configuration

### CDK Integration

#### Certificate Construct Usage

```typescript
const certificateConstruct = new SslCertificateConstruct(
	this,
	'SslCertificate',
	{
		environmentName: 'production',
		domainName: 'api.macro-ai.com',
		subjectAlternativeNames: ['*.macro-ai.com'],
		hostedZone,
		enableDnsValidation: true,
		alertDaysBeforeExpiration: 30,
	},
)
```

#### HTTPS Enforcement Usage

```typescript
const httpsEnforcement = new HttpsEnforcementConstruct(
	this,
	'HttpsEnforcement',
	{
		environmentName: 'production',
		loadBalancer,
		certificate: certificateConstruct.getCertificate(),
		enableHttpRedirect: true,
		sslPolicy: 'ELBSecurityPolicy-TLS13-1-2-2021-06',
		enableDetailedMonitoring: true,
	},
)
```

### Environment-Specific Configuration

#### Production Environment

```json
{
	"sslPolicy": "ELBSecurityPolicy-TLS13-1-2-2021-06",
	"enableHttpRedirect": true,
	"alertDaysBeforeExpiration": 30,
	"enableDetailedMonitoring": true,
	"subjectAlternativeNames": ["*.macro-ai.com", "www.macro-ai.com"]
}
```

#### Staging Environment

```json
{
	"sslPolicy": "ELBSecurityPolicy-TLS13-1-2-2021-06",
	"enableHttpRedirect": true,
	"alertDaysBeforeExpiration": 14,
	"enableDetailedMonitoring": true,
	"subjectAlternativeNames": ["staging.macro-ai.com"]
}
```

#### Development Environment

```json
{
	"sslPolicy": "ELBSecurityPolicy-TLS-1-2-2017-01",
	"enableHttpRedirect": false,
	"alertDaysBeforeExpiration": 7,
	"enableDetailedMonitoring": false,
	"subjectAlternativeNames": []
}
```

## 🔧 Certificate Lifecycle Management

### Automated Renewal

#### ACM Automatic Renewal

- Certificates are automatically renewed 60 days before expiration
- No manual intervention required
- DNS validation records remain the same

#### Renewal Process

1. ACM detects certificate approaching expiration
2. Automatic renewal process starts
3. DNS validation (if required) is performed
4. New certificate is issued
5. Old certificate remains valid until replacement

### Manual Certificate Operations

#### Certificate Replacement

```bash
# List certificates
aws acm list-certificates

# Describe specific certificate
aws acm describe-certificate --certificate-arn $CERT_ARN

# Delete expired certificate
aws acm delete-certificate --certificate-arn $CERT_ARN
```

#### Emergency Certificate Replacement

```typescript
// Create new certificate for immediate replacement
const emergencyCertificate = new acm.Certificate(this, 'EmergencyCertificate', {
	domainName: 'api.macro-ai.com',
	validationMethod: acm.ValidationMethod.DNS,
	// Use EMAIL validation for faster issuance if needed
})
```

## 📈 Performance Considerations

### SSL/TLS Performance Impact

#### Latency Impact

- **SSL Handshake**: ~100-200ms initial connection
- **Subsequent Requests**: Minimal impact (< 5ms)
- **Session Resumption**: Reduces handshake overhead

#### Throughput Optimization

- **ALB SSL Termination**: Offloads SSL processing from application
- **Connection Reuse**: Keep-alive connections reduce handshake frequency
- **OCSP Stapling**: Certificate validation optimization

### Cost Optimization

#### Certificate Costs

- **ACM Certificates**: Free for AWS resources
- **DNS Validation**: Free with Route 53
- **Certificate Monitoring**: Minimal Lambda execution costs

#### Load Balancer Costs

- **HTTPS Listeners**: No additional cost
- **SSL Termination**: Included in ALB pricing
- **Data Transfer**: Standard AWS data transfer rates

## 🧪 Testing & Validation

### SSL/TLS Testing

#### SSL Labs Testing

```bash
# Test SSL configuration using SSL Labs
curl -I https://api.macro-ai.com

# Check certificate details
openssl s_client -connect api.macro-ai.com:443 -servername api.macro-ai.com
```

#### Certificate Validation Testing

```bash
# Test certificate chain
openssl verify -CAfile ca-bundle.crt certificate.crt

# Check certificate expiration
openssl x509 -in certificate.crt -text -noout | grep "Not After"
```

### Load Testing

#### HTTPS Load Testing

```bash
# Test HTTPS performance under load
ab -n 1000 -c 10 https://api.macro-ai.com/api/health

# Test HTTP to HTTPS redirect
curl -I http://api.macro-ai.com/api/health
# Expected: 301 Moved Permanently, Location: https://...
```

## 🚨 Troubleshooting

### Common Issues

#### Certificate Not Issuing

```bash
# Check DNS validation records
aws acm describe-certificate --certificate-arn $CERT_ARN --query 'DomainValidationOptions'

# Verify DNS records
dig _acme-challenge.api.macro-ai.com CNAME
```

#### SSL Handshake Errors

```bash
# Check SSL policy compatibility
aws elbv2 describe-listeners --listener-arns $LISTENER_ARN

# Test SSL connection
openssl s_client -connect api.macro-ai.com:443 -tls1_3
```

#### Certificate Expiration Alerts

```bash
# Check certificate status
aws acm describe-certificate --certificate-arn $CERT_ARN --query 'Certificate.Status'

# Check days to expiry
aws cloudwatch get-metric-statistics \
  --namespace AWS/CertificateManager \
  --metric-name DaysToExpiry \
  --dimensions Name=CertificateArn,Value=$CERT_ARN \
  --start-time $(date -u -d '1 hour ago' +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 3600 \
  --statistics Minimum
```

### Certificate Renewal Issues

#### DNS Validation Failures

```bash
# Check Route 53 records
aws route53 list-resource-record-sets --hosted-zone-id $ZONE_ID --query 'ResourceRecordSets[?Type==`CNAME`]'

# Verify ACM validation records
aws acm describe-certificate --certificate-arn $CERT_ARN --query 'Certificate.DomainValidationOptions'
```

#### Load Balancer Association

```bash
# Check listener certificates
aws elbv2 describe-listeners --listener-arns $LISTENER_ARN --query 'Listeners[].Certificates'

# Update listener certificates if needed
aws elbv2 modify-listener \
  --listener-arn $LISTENER_ARN \
  --certificates CertificateArn=$NEW_CERT_ARN
```

## 📚 Additional Resources

### AWS Documentation

- [AWS Certificate Manager User Guide](https://docs.aws.amazon.com/acm/latest/userguide/)
- [Application Load Balancer SSL](https://docs.aws.amazon.com/elasticloadbalancing/latest/application/load-balancer-listeners.html)
- [SSL/TLS Best Practices](https://docs.aws.amazon.com/elasticloadbalancing/latest/application/load-balancer-ssl-security-policy.html)

### Security Standards

- [SSL Labs SSL Test](https://www.ssllabs.com/ssltest/)
- [Mozilla SSL Configuration Generator](https://ssl-config.mozilla.org/)
- [OWASP TLS Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/TLS_Cheat_Sheet.html)

### Monitoring & Alerting

- [CloudWatch Certificate Metrics](https://docs.aws.amazon.com/acm/latest/userguide/cloudwatch-metrics.html)
- [Certificate Transparency](https://certificate.transparency.dev/)

---

This SSL/TLS implementation provides enterprise-grade encryption and certificate management while maintaining optimal
performance and security. The automated monitoring and alerting ensure proactive certificate lifecycle management.

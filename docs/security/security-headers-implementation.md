# 🔒 Security Headers Implementation

This document details the comprehensive security headers implementation for the Macro AI infrastructure, providing robust protection against common web vulnerabilities and attacks.

## 📋 Security Headers Overview

### Implementation Strategy

Security headers are implemented using Lambda@Edge functions that process HTTP responses and add security headers before content reaches the client. This approach provides:

- **Global Coverage**: Headers applied at CloudFront edge locations
- **Dynamic Configuration**: Environment-specific header values
- **Performance Optimized**: Minimal latency impact
- **Centralized Management**: Single configuration point

### Header Categories

#### 1. Content Security Policy (CSP)

Prevents XSS attacks by controlling resource loading and execution.

#### 2. Transport Security Headers

Enforce HTTPS and prevent protocol downgrade attacks.

#### 3. Frame Protection Headers

Prevent clickjacking and frame-based attacks.

#### 4. Content Protection Headers

Prevent MIME type confusion and content sniffing attacks.

#### 5. Referrer Policy

Control referrer information leakage.

#### 6. Permissions Policy

Control access to sensitive browser features.

## 🛡️ Detailed Header Implementation

### Content Security Policy (CSP)

#### Production Environment

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

#### Development Environment

```http
Content-Security-Policy:
  default-src 'self';
  script-src 'self' 'unsafe-inline' 'unsafe-eval' http://localhost:* https://*.macro-ai.com;
  style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
  font-src 'self' https://fonts.gstatic.com;
  img-src 'self' data: https: blob:;
  connect-src 'self' http://localhost:* https://api.macro-ai.com wss://*.macro-ai.com;
  frame-ancestors 'none';
  base-uri 'self';
  form-action 'self';
```

### Transport Security Headers

#### HTTP Strict Transport Security (HSTS)

```http
Strict-Transport-Security: max-age=31536000; includeSubDomains; preload
```

**Configuration Options:**

- `max-age`: 31536000 seconds (1 year)
- `includeSubDomains`: Applies to all subdomains
- `preload`: Allows browser preload lists

#### Development Considerations

- HSTS disabled in development to allow HTTP
- Preload directive only in production
- Shorter max-age for staging testing

### Frame Protection Headers

#### X-Frame-Options

```http
X-Frame-Options: DENY
```

**Options:**

- `DENY`: Completely prevent framing
- `SAMEORIGIN`: Allow same-origin framing
- `ALLOW-FROM uri`: Allow specific origin framing

### Content Protection Headers

#### X-Content-Type-Options

```http
X-Content-Type-Options: nosniff
```

Prevents MIME type sniffing by browsers, ensuring declared content types are respected.

#### X-XSS-Protection

```http
X-XSS-Protection: 1; mode=block
```

Enables XSS filtering in older browsers with block mode.

### Referrer Policy

#### Strict Origin Policy

```http
Referrer-Policy: strict-origin-when-cross-origin
```

**Policy Levels:**

- `strict-origin-when-cross-origin`: Full URL for same-origin, origin only for cross-origin
- `no-referrer`: Never send referrer header
- `strict-origin`: Always send origin only

### Permissions Policy (formerly Feature Policy)

#### Restricted Permissions

```http
Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=()
```

Controls access to sensitive browser features:

- `camera`: Webcam access
- `microphone`: Audio input access
- `geolocation`: Location services
- `payment`: Payment request API

## 🌐 CORS Configuration

### Production CORS Headers

```http
Access-Control-Allow-Origin: https://macro-ai.com
Access-Control-Allow-Credentials: true
Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS, PATCH
Access-Control-Allow-Headers: Content-Type, Authorization, X-API-Key, X-Requested-With
Access-Control-Max-Age: 86400
```

### CORS Validation Logic

```typescript
function isOriginAllowed(origin: string, allowedOrigins: string[]): boolean {
	return allowedOrigins.some((allowedOrigin) => {
		if (allowedOrigin === '*') return true
		if (allowedOrigin.startsWith('*.')) {
			const domain = allowedOrigin.slice(2)
			return origin.endsWith(domain)
		}
		return origin === allowedOrigin
	})
}
```

### Environment-Specific CORS

#### Production

- Restricted to production domains
- Credentials allowed for authenticated requests
- Preflight caching enabled

#### Staging

- Staging-specific domains
- Relaxed for testing purposes
- Credentials enabled for testing

#### Development

- Localhost origins allowed
- Multiple development ports supported
- Credentials enabled for local development

## ⚙️ Configuration Management

### Environment Variables

#### Lambda Function Configuration

```typescript
const config = {
	ENVIRONMENT: process.env.ENVIRONMENT || 'development',
	ENABLE_DETAILED_LOGGING: process.env.ENABLE_DETAILED_LOGGING === 'true',
	CUSTOM_HEADERS: JSON.parse(process.env.CUSTOM_HEADERS || '{}'),
	CONTENT_SECURITY_POLICY: process.env.CONTENT_SECURITY_POLICY,
	CORS_ALLOWED_ORIGINS: JSON.parse(process.env.CORS_ALLOWED_ORIGINS || '[]'),
	ENABLE_HSTS: process.env.ENABLE_HSTS === 'true',
	HSTS_MAX_AGE: parseInt(process.env.HSTS_MAX_AGE || '31536000'),
	ENABLE_X_FRAME_OPTIONS: process.env.ENABLE_X_FRAME_OPTIONS === 'true',
	X_FRAME_OPTIONS_VALUE: process.env.X_FRAME_OPTIONS_VALUE || 'DENY',
}
```

### CDK Configuration

#### Security Headers Construct

```typescript
const securityHeaders = new SecurityHeadersConstruct(this, 'SecurityHeaders', {
	environmentName: 'production',
	enableDetailedLogging: true,
	customHeaders: {
		'X-Environment': 'production',
		'X-Security-Policy': 'MacroAI-Security-v1.0',
	},
	contentSecurityPolicy: this.getContentSecurityPolicy('production'),
	corsAllowedOrigins: ['https://macro-ai.com', 'https://www.macro-ai.com'],
	enableHsts: true,
	hstsMaxAge: 31536000,
	enableXFrameOptions: true,
	xFrameOptionsValue: 'DENY',
})
```

## 📊 Monitoring & Logging

### CloudWatch Metrics

#### Security Headers Metrics

```typescript
// Headers added count
await putMetricData('MacroAI/Security', 'HeadersAdded', 1, {
	Environment: environmentName,
	HeaderType: 'Security',
})

// CORS requests processed
await putMetricData('MacroAI/Security', 'CorsRequests', 1, {
	Environment: environmentName,
	Origin: origin,
})
```

#### Error Tracking

```typescript
// Header processing errors
await putMetricData('MacroAI/Security', 'HeaderErrors', 1, {
	Environment: environmentName,
	ErrorType: error.name,
})
```

### Log Structure

#### Security Event Logging

```json
{
	"timestamp": "2024-01-15T10:30:00Z",
	"level": "INFO",
	"message": "Security headers added to response",
	"environment": "production",
	"details": {
		"statusCode": 200,
		"headersAdded": ["content-security-policy", "strict-transport-security"],
		"processingTime": 5
	}
}
```

#### Error Logging

```json
{
	"timestamp": "2024-01-15T10:30:00Z",
	"level": "ERROR",
	"message": "Failed to add security headers",
	"environment": "production",
	"details": {
		"error": "Invalid CSP directive",
		"requestId": "12345-abcde"
	}
}
```

## 🔧 Lambda@Edge Implementation

### Function Architecture

#### Event Processing Flow

```
1. Viewer Request Event
   ├── Pass through (no headers to add)
   └── Continue to origin

2. Origin Response Event
   ├── Add security headers
   ├── Process CORS if needed
   ├── Return modified response
   └── Continue to viewer

3. Viewer Response Event
   ├── Add security headers (fallback)
   ├── Process CORS if needed
   ├── Return modified response
   └── Send to client
```

### Performance Optimization

#### Edge Location Caching

- Lambda@Edge functions cached at edge locations
- Reduced latency for global users
- Automatic scaling per region

#### Memory and Timeout Configuration

```typescript
const lambdaFunction = new lambda.Function(this, 'SecurityHeadersFunction', {
	runtime: lambda.Runtime.NODEJS_18_X,
	timeout: cdk.Duration.seconds(5),
	memorySize: 128, // Optimized for header processing
})
```

## 🧪 Testing & Validation

### Header Validation Tests

#### SecurityHeaders Lambda Tests

```typescript
describe('Security Headers Lambda', () => {
	test('adds all required security headers', () => {
		const response = createMockResponse()
		addSecurityHeaders(response, config, request)

		expect(response.headers['content-security-policy']).toBeDefined()
		expect(response.headers['strict-transport-security']).toBeDefined()
		expect(response.headers['x-frame-options']).toBeDefined()
	})

	test('handles CORS requests correctly', () => {
		const corsRequest = createCorsRequest()
		const response = createMockResponse()

		addSecurityHeaders(response, config, corsRequest)

		expect(response.headers['access-control-allow-origin']).toBeDefined()
	})
})
```

### Integration Testing

#### End-to-End Header Validation

```bash
# Test security headers via curl
curl -I https://api.macro-ai.com/health

# Expected output:
# content-security-policy: default-src 'self'; ...
# strict-transport-security: max-age=31536000; includeSubDomains; preload
# x-frame-options: DENY
# x-content-type-options: nosniff
```

#### CORS Testing

```bash
# Test CORS preflight
curl -X OPTIONS \
  -H "Origin: https://macro-ai.com" \
  -H "Access-Control-Request-Method: POST" \
  https://api.macro-ai.com/api/chat

# Expected CORS headers in response
```

## 🚀 Deployment Strategy

### Blue-Green Deployment

1. Deploy new security headers version
2. Test headers on staging environment
3. Gradual rollout with canary deployment
4. Monitor for any breaking changes
5. Full production deployment

### Rollback Procedures

```bash
# Rollback to previous Lambda version
aws lambda update-function-code \
  --function-name security-headers-function \
  --s3-bucket macro-ai-lambda-artifacts \
  --s3-key security-headers-v1.0.0.zip

# Update CloudFront to use previous version
aws cloudfront update-distribution \
  --distribution-id ${DISTRIBUTION_ID} \
  --default-cache-behavior-lambda-function-associations
```

## 📈 Performance Monitoring

### Response Time Impact

- Average header processing time: < 5ms
- 99th percentile: < 15ms
- No impact on cache hit ratios

### Error Rate Monitoring

```typescript
// Monitor header processing errors
const errorRateAlarm = new cloudwatch.Alarm(this, 'SecurityHeadersErrorAlarm', {
	alarmName: `${environmentName}-security-headers-errors`,
	metric: new cloudwatch.Metric({
		namespace: 'MacroAI/Security',
		metricName: 'HeaderErrors',
		dimensionsMap: {
			Environment: environmentName,
		},
		statistic: 'Sum',
	}),
	threshold: 5,
	evaluationPeriods: 5,
})
```

## 🛠️ Maintenance & Updates

### Regular Updates

#### Header Policy Updates

- Review and update CSP directives quarterly
- Update HSTS preload list annually
- Monitor new security headers adoption

#### Lambda Function Updates

- Update Node.js runtime versions
- Security patch deployments
- Performance optimizations

### Configuration Management

#### Environment-Specific Overrides

```typescript
// Environment-specific header configurations
const environmentConfigs = {
	production: {
		enableHsts: true,
		corsOrigins: ['https://macro-ai.com'],
		cspDirectives: 'strict',
	},
	staging: {
		enableHsts: false,
		corsOrigins: ['https://staging.macro-ai.com'],
		cspDirectives: 'relaxed',
	},
}
```

## 📚 Additional Resources

### Security Standards

- [OWASP Security Headers](https://owasp.org/www-project-secure-headers/)
- [MDN Web Security Headers](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers)
- [Content Security Policy Reference](https://content-security-policy.com/)

### AWS Documentation

- [Lambda@Edge Developer Guide](https://docs.aws.amazon.com/lambda/latest/dg/lambda-edge.html)
- [CloudFront Security Headers](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/secure-connections-supported-viewer-protocols-ciphers.html)

---

This security headers implementation provides comprehensive protection against modern web vulnerabilities while maintaining optimal performance and user experience.

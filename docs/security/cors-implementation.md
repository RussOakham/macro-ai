# 🌐 CORS Implementation Guide

This document outlines the comprehensive Cross-Origin Resource Sharing (CORS) implementation for the Macro AI infrastructure, providing secure and flexible cross-origin request handling.

## 📋 CORS Overview

### What is CORS?

Cross-Origin Resource Sharing (CORS) is a security feature implemented by web browsers that controls how web pages can make requests to domains other than the one that served the original web page. CORS is crucial for modern web applications that need to communicate with APIs hosted on different domains.

### Security Architecture

The CORS implementation follows a layered security approach:

```
┌─────────────────┐
│   Browser CORS  │ ← Origin validation and preflight handling
├─────────────────┤
│ Lambda@Edge     │ ← CORS headers and policy enforcement
├─────────────────┤
│   Application   │ ← Application-level CORS handling
└─────────────────┘
```

## 🏗️ Implementation Components

### 1. CORS Construct

The CORS construct provides centralized CORS configuration and Lambda function management:

#### Core Features

- **Origin Validation**: Configurable allowed origins with wildcard support
- **Preflight Handling**: Automatic OPTIONS request processing
- **Header Management**: Flexible allowed headers and exposed headers
- **Credential Support**: Configurable credentials handling
- **Rate Limiting**: Protection against CORS scanning attacks

#### Configuration Options

```typescript
interface CorsConstructProps {
	environmentName: string
	allowedOrigins: string[]
	allowedMethods?: string[]
	allowedHeaders?: string[]
	exposedHeaders?: string[]
	maxAge?: number
	allowCredentials?: boolean
	enableLogging?: boolean
	enableDetailedMonitoring?: boolean
	rateLimitThreshold?: number
}
```

### 2. CORS Lambda Handler

The Lambda@Edge function processes CORS requests and adds appropriate headers:

#### Request Flow

```
Client Request → CloudFront → Lambda@Edge → Origin Server
       ↓              ↓             ↓            ↓
   CORS Check → Header Injection → Response → Header Addition
```

#### Handler Functions

- **Preflight Processing**: Handles OPTIONS requests for complex CORS scenarios
- **Origin Validation**: Checks request origins against allowed origins
- **Header Injection**: Adds CORS headers to responses
- **Monitoring**: Logs CORS events for security analysis

## ⚙️ Configuration Examples

### Production Environment

```json
{
	"cors": {
		"allowedOrigins": [
			"https://macro-ai.com",
			"https://www.macro-ai.com",
			"https://app.macro-ai.com"
		],
		"allowedMethods": ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
		"allowedHeaders": [
			"Content-Type",
			"Authorization",
			"X-API-Key",
			"X-Requested-With",
			"Accept",
			"Origin"
		],
		"maxAge": 86400,
		"allowCredentials": true,
		"enableLogging": true,
		"enableDetailedMonitoring": true,
		"rateLimitThreshold": 1000
	}
}
```

### Staging Environment

```json
{
	"cors": {
		"allowedOrigins": [
			"https://staging.macro-ai.com",
			"https://*.macro-ai.com"
		],
		"allowedMethods": ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
		"allowedHeaders": ["Content-Type", "Authorization", "X-Requested-With"],
		"maxAge": 3600,
		"allowCredentials": false,
		"enableLogging": true,
		"enableDetailedMonitoring": false
	}
}
```

### Development Environment

```json
{
	"cors": {
		"allowedOrigins": [
			"http://localhost:3000",
			"http://localhost:5173",
			"https://dev.macro-ai.com",
			"http://127.0.0.1:*"
		],
		"allowedMethods": ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
		"allowedHeaders": [
			"Content-Type",
			"Authorization",
			"X-Requested-With",
			"Accept",
			"Origin",
			"X-API-Key"
		],
		"maxAge": 86400,
		"allowCredentials": true,
		"enableLogging": false,
		"enableDetailedMonitoring": false
	}
}
```

## 🔒 Security Features

### Origin Validation

#### Exact Matching

```typescript
const allowedOrigins = ['https://macro-ai.com']
// ✅ https://macro-ai.com (exact match)
// ❌ https://api.macro-ai.com (no match)
// ❌ http://macro-ai.com (protocol mismatch)
```

#### Wildcard Support

```typescript
const allowedOrigins = ['https://*.macro-ai.com']
// ✅ https://api.macro-ai.com
// ✅ https://www.macro-ai.com
// ✅ https://staging.macro-ai.com
// ❌ https://macro-ai.org
// ❌ http://api.macro-ai.com
```

#### Localhost Support

```typescript
const allowedOrigins = ['http://localhost:*']
// ✅ http://localhost:3000
// ✅ http://localhost:5173
// ❌ https://localhost:3000
// ❌ http://127.0.0.1:3000
```

### Pre-flight Request Handling

#### OPTIONS Request Processing

```typescript
// Browser sends preflight request
OPTIONS /api/data HTTP/1.1
Origin: https://macro-ai.com
Access-Control-Request-Method: POST
Access-Control-Request-Headers: Authorization, Content-Type

// Lambda responds with CORS headers
HTTP/1.1 200 OK
Access-Control-Allow-Origin: https://macro-ai.com
Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS
Access-Control-Allow-Headers: Authorization, Content-Type
Access-Control-Max-Age: 86400
```

### Credential Handling

#### With Credentials

```typescript
// Configuration
allowCredentials: true

// Response headers
Access-Control-Allow-Origin: https://macro-ai.com
Access-Control-Allow-Credentials: true
Vary: Origin
```

#### Without Credentials

```typescript
// Configuration
allowCredentials: false

// Response headers
Access-Control-Allow-Origin: https://macro-ai.com
// No Access-Control-Allow-Credentials header
Vary: Origin
```

## 📊 Monitoring & Alerting

### CloudWatch Metrics

#### CORS Violation Metrics

```typescript
// Metric: CorsViolationCount
// Namespace: MacroAI/CORS
// Dimensions: Environment
// Tracks blocked CORS requests
```

#### Preflight Request Metrics

```typescript
// Metric: PreflightRequestCount
// Namespace: MacroAI/CORS
// Dimensions: Environment
// Tracks OPTIONS request frequency
```

#### Origin Mismatch Metrics

```typescript
// Metric: OriginMismatchCount
// Namespace: MacroAI/CORS
// Dimensions: Environment
// Tracks requests from unauthorized origins
```

### CloudWatch Alarms

#### CORS Violation Alarm

```typescript
const corsViolationAlarm = new cloudwatch.Alarm(this, 'CorsViolationAlarm', {
	alarmName: `${environmentName}-cors-violations`,
	alarmDescription: 'High number of CORS violations detected',
	metric: new cloudwatch.Metric({
		namespace: 'MacroAI/CORS',
		metricName: 'CorsViolationCount',
		dimensionsMap: { Environment: environmentName },
		statistic: 'Sum',
	}),
	threshold: 50,
	evaluationPeriods: 5,
	comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
})
```

#### Preflight Rate Alarm

```typescript
const preflightRateAlarm = new cloudwatch.Alarm(this, 'PreflightRateAlarm', {
	alarmName: `${environmentName}-cors-preflight-rate`,
	alarmDescription: 'High rate of CORS preflight requests',
	metric: new cloudwatch.Metric({
		namespace: 'MacroAI/CORS',
		metricName: 'PreflightRequestCount',
		dimensionsMap: { Environment: environmentName },
		statistic: 'Sum',
	}),
	threshold: 1000,
	evaluationPeriods: 5,
	comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
})
```

## 🔧 Integration Examples

### CDK Integration

#### Security Stack Configuration

```typescript
const securityStack = new SecurityStack(this, 'Security', {
	environmentName: 'production',
	cors: {
		allowedOrigins: ['https://macro-ai.com', 'https://app.macro-ai.com'],
		allowedMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
		allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key'],
		maxAge: 86400,
		allowCredentials: true,
		enableLogging: true,
		enableDetailedMonitoring: true,
		rateLimitThreshold: 1000,
	},
})
```

#### CloudFront Integration

```typescript
// Add CORS Lambda to CloudFront behavior
const corsFunction = new cloudfront.Function(this, 'CorsFunction', {
	code: cloudfront.FunctionCode.fromInline(corsHandlerCode),
})

// Add to CloudFront distribution
new cloudfront.Distribution(this, 'Distribution', {
	defaultBehavior: {
		origin: new origins.HttpOrigin('api.macro-ai.com'),
		edgeLambdas: [
			{
				functionVersion: corsFunction.currentVersion,
				eventType: cloudfront.LambdaEdgeEventType.ORIGIN_REQUEST,
			},
		],
	},
})
```

### Application Integration

#### Express.js Integration

```typescript
// CORS middleware (complementary to Lambda@Edge)
app.use(
	cors({
		origin:
			process.env.NODE_ENV === 'production'
				? ['https://macro-ai.com']
				: ['http://localhost:3000', 'https://dev.macro-ai.com'],
		credentials: true,
		methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
		allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key'],
	}),
)
```

#### Client-Side Integration

```typescript
// Fetch with credentials
fetch('https://api.macro-ai.com/data', {
	method: 'POST',
	credentials: 'include', // Required for cookies/auth headers
	headers: {
		'Content-Type': 'application/json',
		Authorization: `Bearer ${token}`,
	},
	body: JSON.stringify(data),
})
```

## 🧪 Testing & Validation

### CORS Testing

#### Browser Developer Tools

```javascript
// Check Network tab for CORS headers
// Look for Access-Control-Allow-Origin header
// Verify preflight OPTIONS requests
```

#### curl Testing

```bash
# Test simple CORS request
curl -H "Origin: https://macro-ai.com" \
     -H "Access-Control-Request-Method: POST" \
     -X OPTIONS https://api.macro-ai.com/data

# Check response headers
curl -I -H "Origin: https://macro-ai.com" \
        https://api.macro-ai.com/data
```

#### CORS Testing Tools

- **Browser DevTools**: Network tab for CORS headers
- **curl**: Command-line testing of CORS responses
- **Postman**: CORS preflight request testing
- **CORS Test Websites**: Online CORS validation tools

### Automated Testing

#### Preflight Request Test

```typescript
test('handles CORS preflight request', async () => {
	const response = await request(app)
		.options('/api/data')
		.set('Origin', 'https://macro-ai.com')
		.set('Access-Control-Request-Method', 'POST')
		.expect(200)

	expect(response.headers['access-control-allow-origin']).toBe(
		'https://macro-ai.com',
	)
	expect(response.headers['access-control-allow-methods']).toContain('POST')
})
```

#### Origin Validation Test

```typescript
test('blocks unauthorized origin', async () => {
	const response = await request(app)
		.get('/api/data')
		.set('Origin', 'https://malicious-site.com')
		.expect(200)

	// Should not include CORS headers for unauthorized origin
	expect(response.headers['access-control-allow-origin']).toBeUndefined()
})
```

## 🚨 Troubleshooting

### Common Issues

#### CORS Errors in Browser

```javascript
// Browser console error
Access to XMLHttpRequest at 'https://api.macro-ai.com/data'
from origin 'https://macro-ai.com' has been blocked by CORS policy:
No 'Access-Control-Allow-Origin' header is present on the requested resource.
```

**Solutions:**

1. Check if origin is in allowedOrigins list
2. Verify Lambda@Edge function is deployed
3. Check CloudWatch logs for CORS events
4. Validate Lambda environment variables

#### Preflight Request Failures

```javascript
// Browser console error
Access to XMLHttpRequest at 'https://api.macro-ai.com/data'
from origin 'https://macro-ai.com' has been blocked by CORS policy:
Response to preflight request doesn't pass access control check.
```

**Solutions:**

1. Verify OPTIONS method is allowed
2. Check allowed headers configuration
3. Validate preflight response headers
4. Check Lambda function logs

#### Credential Issues

```javascript
// Browser console error
Access to XMLHttpRequest at 'https://api.macro-ai.com/data'
from origin 'https://macro-ai.com' has been blocked by CORS policy:
The value of the 'Access-Control-Allow-Credentials' header in the response is ''
which must be 'true' when the request's credentials mode is 'include'.
```

**Solutions:**

1. Ensure `allowCredentials: true` in configuration
2. Verify origin is not wildcard when using credentials
3. Check that credentials are properly set in client request

### Debugging Steps

#### 1. Check Lambda Logs

```bash
# View recent Lambda logs
aws logs tail /aws/lambda/production-cors-handler --follow

# Filter for specific origin
aws logs filter-log-events \
  --log-group-name /aws/lambda/production-cors-handler \
  --filter-pattern "CORS allowed for origin"
```

#### 2. Validate Configuration

```bash
# Check Lambda environment variables
aws lambda get-function-configuration \
  --function-name production-cors-handler \
  --query 'Environment.Variables'
```

#### 3. Test Direct Lambda Invocation

```bash
# Test Lambda function directly
aws lambda invoke \
  --function-name production-cors-handler \
  --payload '{"test": "data"}' \
  output.json
```

## 📈 Performance Optimization

### Caching Strategies

#### Browser Caching

- **Preflight Caching**: Use `Access-Control-Max-Age` header
- **Response Caching**: Cache CORS headers with responses
- **DNS Caching**: Cache DNS lookups for origins

#### CloudFront Optimization

```typescript
// Optimize CloudFront behavior for CORS
const behavior: cloudfront.BehaviorOptions = {
	origin: apiOrigin,
	edgeLambdas: [corsLambda],
	cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
	originRequestPolicy: cloudfront.OriginRequestPolicy.CORS_S3_ORIGIN,
	responseHeadersPolicy:
		cloudfront.ResponseHeadersPolicy.CORS_ALLOW_ALL_ORIGINS,
}
```

### Lambda Performance

#### Memory Optimization

```typescript
const corsLambda = new lambda.Function(this, 'CorsHandler', {
	memorySize: 128, // Minimal memory for simple CORS processing
	timeout: cdk.Duration.seconds(5), // Quick timeout for CORS checks
})
```

#### Cold Start Optimization

- **Provisioned Concurrency**: For consistent performance
- **Keep Warm**: Regular ping requests to maintain warm state
- **Minimal Dependencies**: Small Lambda package size

## 💰 Cost Optimization

### Lambda Costs

- **Request Pricing**: $0.20 per 1M requests
- **Duration Pricing**: $0.00001667 per GB-second
- **Memory Optimization**: Use minimal memory allocation

### CloudWatch Costs

- **Metrics**: $0.30 per metric per month
- **Logs**: $0.50 per GB ingested
- **Alarms**: $0.10 per alarm per month

### Optimization Strategies

```typescript
// Minimize Lambda invocations
const corsLambda = new lambda.Function(this, 'CorsHandler', {
	reservedConcurrentExecutions: 10, // Control concurrent executions
	provisionedConcurrentExecutions: 2, // Keep warm for consistent performance
})
```

## 🔗 Additional Resources

### AWS Documentation

- [AWS Lambda@Edge CORS](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/lambda-at-the-edge.html)
- [CloudFront CORS Headers](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/adding-response-headers.html)
- [Lambda@Edge Best Practices](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/lambda-at-the-edge.html)

### Security Resources

- [OWASP CORS Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Cross_Origin_Resource_Sharing_Cheat_Sheet.html)
- [MDN CORS Documentation](https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS)
- [CORS in Depth](https://web.dev/cross-origin-resource-sharing/)

### Tools & Testing

- [CORS Test Website](https://test-cors.org/)
- [Postman CORS Testing](https://learning.postman.com/docs/sending-requests/cors/)
- [Browser CORS Debugging](https://developer.chrome.com/docs/devtools/network/reference/#cors)

---

This CORS implementation provides enterprise-grade cross-origin request handling while maintaining security and performance. The Lambda@Edge approach ensures global coverage with minimal latency impact.

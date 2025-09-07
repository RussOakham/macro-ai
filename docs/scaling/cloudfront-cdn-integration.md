# CloudFront CDN Integration for Global Performance

## Overview

This document outlines a comprehensive CloudFront CDN integration strategy for the Macro AI application to improve global
performance, reduce latency, and optimize content delivery. It covers CDN configuration, caching strategies, and performance
optimization techniques.

## Integration Triggers

### When to Consider CloudFront Integration

1. **Global User Base**: Users accessing the application from multiple geographic regions
2. **Performance Requirements**: Need to reduce latency for international users
3. **Static Content**: Significant amount of static assets (images, CSS, JS, fonts)
4. **API Performance**: Need to cache API responses for better performance
5. **Cost Optimization**: Reduce bandwidth costs and origin server load
6. **Security Requirements**: Need DDoS protection and security features
7. **Compliance Requirements**: Need to meet specific compliance standards

### Performance Benefits

```yaml
# Performance improvements with CloudFront
performance_benefits:
  latency_reduction:
    us_east: 0ms (origin region)
    us_west: 20-30ms
    europe: 50-80ms
    asia: 100-150ms
    australia: 150-200ms

  bandwidth_savings:
    static_content: 80-90%
    api_responses: 30-50%
    overall: 40-60%

  origin_load_reduction:
    static_requests: 90%
    api_requests: 20-30%
    overall: 50-70%
```

## CloudFront Architecture Design

### Multi-Environment Setup

```yaml
# CloudFront distributions for different environments
environments:
  development:
    distribution_type: 'simple'
    origin: 'development-alb.elb.amazonaws.com'
    caching_behavior: 'minimal'
    ssl_certificate: 'self-signed'
    custom_domain: false

  staging:
    distribution_type: 'standard'
    origin: 'staging-alb.elb.amazonaws.com'
    caching_behavior: 'moderate'
    ssl_certificate: 'staging.macro-ai.com'
    custom_domain: true

  production:
    distribution_type: 'advanced'
    origin: 'production-alb.elb.amazonaws.com'
    caching_behavior: 'aggressive'
    ssl_certificate: 'macro-ai.com'
    custom_domain: true
    waf_enabled: true
    security_headers: true
```

### Distribution Configuration

#### Basic Distribution

```yaml
# Basic CloudFront distribution
basic_distribution:
  enabled: true
  comment: "Macro AI CDN Distribution"

  origins:
    - id: "macro-ai-alb"
      domain_name: "macro-ai-alb.elb.amazonaws.com"
      origin_path: ""
      custom_origin_config:
        http_port: 80
        https_port: 443
        origin_protocol_policy: "https-only"
        origin_ssl_protocols: ["TLSv1.2"]
        origin_keepalive_timeout: 5
        origin_read_timeout: 30

  default_cache_behavior:
    target_origin_id: "macro-ai-alb"
    viewer_protocol_policy: "redirect-to-https"
    allowed_methods: ["GET", "HEAD", "OPTIONS", "PUT", "POST", "PATCH", "DELETE"]
    cached_methods: ["GET", "HEAD"]
    compress: true
    cache_policy_id: "4135ea2d-6f65-46d0-8c37-8e63fd03c6b0" # Managed-CachingOptimized
    origin_request_policy_id: "88a5eaf4-2fd4-4709-b370-b4c650ea3fcf" # Managed-CORS-S3Origin
    response_headers_policy_id: "67f7725c-6f97-4210-82d7-5512b31e9d03" # Managed-SecurityHeadersPolicy

  price_class: "PriceClass_100" # US, Canada, Europe
  enabled: true
  is_ipv6_enabled: true
  default_root_object: "index.html"

  custom_error_responses:
    - error_code: 404
      response_code: 200
      response_page_path: "/index.html"
      error_caching_min_ttl: 300
    - error_code: 403
      response_code: 200
      response_page_path: "/index.html"
      error_caching_min_ttl: 300
```

#### Advanced Distribution

```yaml
# Advanced CloudFront distribution with multiple origins
advanced_distribution:
  enabled: true
  comment: "Macro AI Advanced CDN Distribution"

  origins:
    # API Origin
    - id: "macro-ai-api"
      domain_name: "api.macro-ai.com"
      origin_path: ""
      custom_origin_config:
        http_port: 80
        https_port: 443
        origin_protocol_policy: "https-only"
        origin_ssl_protocols: ["TLSv1.2"]
        origin_keepalive_timeout: 5
        origin_read_timeout: 30

    # Static Assets Origin
    - id: "macro-ai-static"
      domain_name: "static.macro-ai.com"
      origin_path: ""
      custom_origin_config:
        http_port: 80
        https_port: 443
        origin_protocol_policy: "https-only"
        origin_ssl_protocols: ["TLSv1.2"]
        origin_keepalive_timeout: 5
        origin_read_timeout: 30

    # S3 Origin for large files
    - id: "macro-ai-s3"
      domain_name: "macro-ai-assets.s3.amazonaws.com"
      origin_path: "/static"
      s3_origin_config:
        origin_access_identity: "E1234567890ABCD"

  cache_behaviors:
    # API Caching
    - path_pattern: "/api/*"
      target_origin_id: "macro-ai-api"
      viewer_protocol_policy: "redirect-to-https"
      allowed_methods: ["GET", "HEAD", "OPTIONS", "PUT", "POST", "PATCH", "DELETE"]
      cached_methods: ["GET", "HEAD"]
      compress: true
      cache_policy_id: "4135ea2d-6f65-46d0-8c37-8e63fd03c6b0"
      origin_request_policy_id: "88a5eaf4-2fd4-4709-b370-b4c650ea3fcf"
      response_headers_policy_id: "67f7725c-6f97-4210-82d7-5512b31e9d03"
      ttl:
        default_ttl: 0
        max_ttl: 31536000
        min_ttl: 0

    # Static Assets Caching
    - path_pattern: "/static/*"
      target_origin_id: "macro-ai-static"
      viewer_protocol_policy: "redirect-to-https"
      allowed_methods: ["GET", "HEAD", "OPTIONS"]
      cached_methods: ["GET", "HEAD"]
      compress: true
      cache_policy_id: "4135ea2d-6f65-46d0-8c37-8e63fd03c6b0"
      origin_request_policy_id: "88a5eaf4-2fd4-4709-b370-b4c650ea3fcf"
      response_headers_policy_id: "67f7725c-6f97-4210-82d7-5512b31e9d03"
      ttl:
        default_ttl: 86400
        max_ttl: 31536000
        min_ttl: 0

    # S3 Assets Caching
    - path_pattern: "/assets/*"
      target_origin_id: "macro-ai-s3"
      viewer_protocol_policy: "redirect-to-https"
      allowed_methods: ["GET", "HEAD", "OPTIONS"]
      cached_methods: ["GET", "HEAD"]
      compress: true
      cache_policy_id: "4135ea2d-6f65-46d0-8c37-8e63fd03c6b0"
      origin_request_policy_id: "88a5eaf4-2fd4-4709-b370-b4c650ea3fcf"
      response_headers_policy_id: "67f7725c-6f97-4210-82d7-5512b31e9d03"
      ttl:
        default_ttl: 31536000
        max_ttl: 31536000
        min_ttl: 0

  price_class: "PriceClass_All" # All edge locations
  enabled: true
  is_ipv6_enabled: true
  default_root_object: "index.html"

  # WAF Integration
  web_acl_id: "arn:aws:wafv2:us-east-1:123456789012:global/webacl/macro-ai-waf/12345678-1234-1234-1234-123456789012"

  # Custom Error Responses
  custom_error_responses:
    - error_code: 404
      response_code: 200
      response_page_path: "/index.html"
      error_caching_min_ttl: 300
    - error_code: 403
      response_code: 200
      response_page_path: "/index.html"
      error_caching_min_ttl: 300
    - error_code: 500
      response_code: 200
      response_page_path: "/error.html"
      error_caching_min_ttl: 300
```

## CDK Implementation

### CloudFront Construct

```typescript
// CloudFront distribution construct
export class CloudFrontDistributionConstruct extends Construct {
	public readonly distribution: cloudfront.Distribution
	public readonly distributionId: string
	public readonly distributionDomainName: string

	constructor(
		scope: Construct,
		id: string,
		props: CloudFrontDistributionConstructProps,
	) {
		super(scope, id)

		const {
			environmentName,
			originDomainName,
			certificateArn,
			customDomainName,
			wafWebAclArn,
			enableLogging = true,
			logBucket,
			logPrefix = 'cloudfront-logs',
		} = props

		// Create origin access identity for S3
		const originAccessIdentity = new cloudfront.OriginAccessIdentity(
			this,
			'OriginAccessIdentity',
			{
				comment: `OAI for ${environmentName} CloudFront distribution`,
			},
		)

		// Create S3 bucket for static assets
		const staticAssetsBucket = new s3.Bucket(this, 'StaticAssetsBucket', {
			bucketName: `macro-ai-${environmentName}-static-assets`,
			versioned: true,
			encryption: s3.BucketEncryption.S3_MANAGED,
			blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
			removalPolicy: cdk.RemovalPolicy.RETAIN,
		})

		// Grant CloudFront access to S3 bucket
		staticAssetsBucket.addToResourcePolicy(
			new iam.PolicyStatement({
				effect: iam.Effect.ALLOW,
				principals: [originAccessIdentity.grantPrincipal],
				actions: ['s3:GetObject'],
				resources: [staticAssetsBucket.arnForObjects('*')],
			}),
		)

		// Create CloudFront distribution
		this.distribution = new cloudfront.Distribution(
			this,
			'CloudFrontDistribution',
			{
				comment: `Macro AI CDN Distribution for ${environmentName}`,

				// Default behavior
				defaultBehavior: {
					origin: new cloudfront.Origins.HttpOrigin(originDomainName, {
						protocolPolicy: cloudfront.OriginProtocolPolicy.HTTPS_ONLY,
						originSslProtocols: [cloudfront.OriginSslPolicy.TLS_V1_2],
						originKeepaliveTimeout: cdk.Duration.seconds(5),
						originReadTimeout: cdk.Duration.seconds(30),
					}),
					viewerProtocolPolicy:
						cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
					allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
					cachedMethods: cloudfront.CachedMethods.CACHE_GET_HEAD,
					compress: true,
					cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
					originRequestPolicy: cloudfront.OriginRequestPolicy.CORS_S3_ORIGIN,
					responseHeadersPolicy:
						cloudfront.ResponseHeadersPolicy.SECURITY_HEADERS,
				},

				// Additional behaviors
				additionalBehaviors: {
					'/api/*': {
						origin: new cloudfront.Origins.HttpOrigin(originDomainName, {
							protocolPolicy: cloudfront.OriginProtocolPolicy.HTTPS_ONLY,
							originSslProtocols: [cloudfront.OriginSslPolicy.TLS_V1_2],
						}),
						viewerProtocolPolicy:
							cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
						allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
						cachedMethods: cloudfront.CachedMethods.CACHE_GET_HEAD,
						compress: true,
						cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
						originRequestPolicy: cloudfront.OriginRequestPolicy.CORS_S3_ORIGIN,
						responseHeadersPolicy:
							cloudfront.ResponseHeadersPolicy.SECURITY_HEADERS,
						ttl: cdk.Duration.seconds(0), // No caching for API
					},
					'/static/*': {
						origin: new cloudfront.Origins.S3Origin(staticAssetsBucket, {
							originAccessIdentity,
						}),
						viewerProtocolPolicy:
							cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
						allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD_OPTIONS,
						cachedMethods: cloudfront.CachedMethods.CACHE_GET_HEAD,
						compress: true,
						cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
						originRequestPolicy: cloudfront.OriginRequestPolicy.CORS_S3_ORIGIN,
						responseHeadersPolicy:
							cloudfront.ResponseHeadersPolicy.SECURITY_HEADERS,
						ttl: cdk.Duration.days(1), // 1 day caching for static assets
					},
				},

				// Price class
				priceClass: cloudfront.PriceClass.PRICE_CLASS_100, // US, Canada, Europe

				// IPv6
				enableIpv6: true,

				// Default root object
				defaultRootObject: 'index.html',

				// Custom error responses
				errorResponses: [
					{
						httpStatus: 404,
						responseHttpStatus: 200,
						responsePagePath: '/index.html',
						ttl: cdk.Duration.minutes(5),
					},
					{
						httpStatus: 403,
						responseHttpStatus: 200,
						responsePagePath: '/index.html',
						ttl: cdk.Duration.minutes(5),
					},
				],

				// WAF integration
				webAclId: wafWebAclArn,

				// Logging
				enableLogging: enableLogging,
				logBucket: logBucket,
				logFilePrefix: logPrefix,

				// Custom domain
				domainNames: customDomainName ? [customDomainName] : undefined,
				certificate: certificateArn
					? acm.Certificate.fromCertificateArn(
							this,
							'Certificate',
							certificateArn,
						)
					: undefined,
			},
		)

		this.distributionId = this.distribution.distributionId
		this.distributionDomainName = this.distribution.distributionDomainName

		// Output distribution details
		new cdk.CfnOutput(this, 'DistributionId', {
			value: this.distributionId,
			description: 'CloudFront distribution ID',
			exportName: `${environmentName}-cloudfront-distribution-id`,
		})

		new cdk.CfnOutput(this, 'DistributionDomainName', {
			value: this.distributionDomainName,
			description: 'CloudFront distribution domain name',
			exportName: `${environmentName}-cloudfront-domain-name`,
		})
	}
}
```

### Integration with Application

```typescript
// CloudFront integration with Express API
class CloudFrontIntegration {
	private distribution: cloudfront.Distribution
	private s3Client: S3Client

	constructor(distribution: cloudfront.Distribution) {
		this.distribution = distribution
		this.s3Client = new S3Client({ region: 'us-east-1' })
	}

	// Upload static assets to S3
	async uploadStaticAsset(
		key: string,
		content: Buffer,
		contentType: string,
	): Promise<void> {
		await this.s3Client.send(
			new PutObjectCommand({
				Bucket: 'macro-ai-static-assets',
				Key: key,
				Body: content,
				ContentType: contentType,
				CacheControl: 'public, max-age=31536000', // 1 year
			}),
		)
	}

	// Invalidate CloudFront cache
	async invalidateCache(paths: string[]): Promise<void> {
		const invalidation = await this.distribution.createInvalidation({
			paths: paths,
		})

		console.log(`CloudFront invalidation created: ${invalidation.id}`)
	}

	// Get CloudFront URL for static asset
	getStaticAssetUrl(key: string): string {
		return `https://${this.distribution.distributionDomainName}/${key}`
	}

	// Check if request should be cached
	shouldCacheRequest(path: string, method: string): boolean {
		// Don't cache API requests
		if (path.startsWith('/api/')) {
			return false
		}

		// Don't cache non-GET requests
		if (method !== 'GET') {
			return false
		}

		// Cache static assets
		if (path.startsWith('/static/') || path.startsWith('/assets/')) {
			return true
		}

		// Cache HTML pages
		if (path.endsWith('.html') || path === '/') {
			return true
		}

		return false
	}
}
```

## Caching Strategies

### 1. Static Content Caching

```typescript
// Static content caching configuration
class StaticContentCaching {
	private distribution: cloudfront.Distribution

	constructor(distribution: cloudfront.Distribution) {
		this.distribution = distribution
	}

	// Configure caching for different content types
	getCachingConfig(contentType: string): CachingConfig {
		switch (contentType) {
			case 'text/css':
			case 'application/javascript':
			case 'application/json':
				return {
					ttl: 86400, // 1 day
					cacheControl: 'public, max-age=86400',
				}

			case 'image/png':
			case 'image/jpeg':
			case 'image/gif':
			case 'image/webp':
				return {
					ttl: 31536000, // 1 year
					cacheControl: 'public, max-age=31536000',
				}

			case 'font/woff':
			case 'font/woff2':
			case 'application/font-woff':
			case 'application/font-woff2':
				return {
					ttl: 31536000, // 1 year
					cacheControl: 'public, max-age=31536000',
				}

			case 'text/html':
				return {
					ttl: 3600, // 1 hour
					cacheControl: 'public, max-age=3600',
				}

			default:
				return {
					ttl: 86400, // 1 day
					cacheControl: 'public, max-age=86400',
				}
		}
	}
}
```

### 2. API Response Caching

```typescript
// API response caching strategy
class ApiResponseCaching {
	private distribution: cloudfront.Distribution

	constructor(distribution: cloudfront.Distribution) {
		this.distribution = distribution
	}

	// Determine if API response should be cached
	shouldCacheApiResponse(
		path: string,
		method: string,
		statusCode: number,
	): boolean {
		// Only cache GET requests
		if (method !== 'GET') {
			return false
		}

		// Only cache successful responses
		if (statusCode < 200 || statusCode >= 300) {
			return false
		}

		// Cache specific API endpoints
		const cacheableEndpoints = [
			'/api/public/config',
			'/api/public/features',
			'/api/public/announcements',
			'/api/public/health',
		]

		return cacheableEndpoints.some((endpoint) => path.startsWith(endpoint))
	}

	// Get TTL for API response
	getApiResponseTtl(path: string): number {
		if (path.startsWith('/api/public/config')) {
			return 3600 // 1 hour
		}

		if (path.startsWith('/api/public/features')) {
			return 1800 // 30 minutes
		}

		if (path.startsWith('/api/public/announcements')) {
			return 7200 // 2 hours
		}

		if (path.startsWith('/api/public/health')) {
			return 60 // 1 minute
		}

		return 0 // No caching
	}
}
```

### 3. Dynamic Content Caching

```typescript
// Dynamic content caching strategy
class DynamicContentCaching {
	private distribution: cloudfront.Distribution

	constructor(distribution: cloudfront.Distribution) {
		this.distribution = distribution
	}

	// Configure caching for dynamic content
	getDynamicContentConfig(
		path: string,
		userAgent: string,
	): DynamicContentConfig {
		// Don't cache for authenticated users
		if (this.isAuthenticatedUser(userAgent)) {
			return {
				ttl: 0,
				cacheControl: 'private, no-cache, no-store, must-revalidate',
			}
		}

		// Cache public dynamic content
		if (path.startsWith('/public/')) {
			return {
				ttl: 300, // 5 minutes
				cacheControl: 'public, max-age=300',
			}
		}

		// Don't cache private content
		return {
			ttl: 0,
			cacheControl: 'private, no-cache, no-store, must-revalidate',
		}
	}

	private isAuthenticatedUser(userAgent: string): boolean {
		// Check for authentication headers or cookies
		// This is a simplified example
		return (
			userAgent.includes('authenticated') || userAgent.includes('logged-in')
		)
	}
}
```

## Performance Optimization

### 1. Compression

```typescript
// CloudFront compression configuration
class CloudFrontCompression {
	private distribution: cloudfront.Distribution

	constructor(distribution: cloudfront.Distribution) {
		this.distribution = distribution
	}

	// Configure compression for different content types
	getCompressionConfig(contentType: string): CompressionConfig {
		const compressibleTypes = [
			'text/html',
			'text/css',
			'text/javascript',
			'application/javascript',
			'application/json',
			'application/xml',
			'text/xml',
			'text/plain',
			'image/svg+xml',
		]

		return {
			enabled: compressibleTypes.includes(contentType),
			gzipLevel: 6,
			brotliLevel: 6,
		}
	}
}
```

### 2. HTTP/2 and HTTP/3

```typescript
// HTTP/2 and HTTP/3 configuration
class HttpProtocolOptimization {
	private distribution: cloudfront.Distribution

	constructor(distribution: cloudfront.Distribution) {
		this.distribution = distribution
	}

	// Configure HTTP protocols
	getProtocolConfig(): ProtocolConfig {
		return {
			http2: true,
			http3: true,
			minTlsVersion: 'TLSv1.2',
			cipherSuites: [
				'TLS_AES_128_GCM_SHA256',
				'TLS_AES_256_GCM_SHA384',
				'TLS_CHACHA20_POLY1305_SHA256',
			],
		}
	}
}
```

### 3. Edge Locations

```typescript
// Edge location optimization
class EdgeLocationOptimization {
	private distribution: cloudfront.Distribution

	constructor(distribution: cloudfront.Distribution) {
		this.distribution = distribution
	}

	// Get optimal edge location for user
	getOptimalEdgeLocation(userCountry: string): string {
		const edgeLocationMap: Record<string, string> = {
			US: 'us-east-1',
			CA: 'us-east-1',
			GB: 'eu-west-1',
			DE: 'eu-central-1',
			FR: 'eu-west-3',
			JP: 'ap-northeast-1',
			AU: 'ap-southeast-2',
			BR: 'sa-east-1',
		}

		return edgeLocationMap[userCountry] || 'us-east-1'
	}

	// Get edge location performance metrics
	async getEdgeLocationMetrics(): Promise<EdgeLocationMetrics> {
		// This would typically call CloudWatch APIs
		return {
			hitRate: 0.95,
			missRate: 0.05,
			errorRate: 0.01,
			averageLatency: 50,
		}
	}
}
```

## Security Configuration

### 1. WAF Integration

```typescript
// WAF integration with CloudFront
class CloudFrontWAFIntegration {
	private distribution: cloudfront.Distribution
	private wafWebAcl: wafv2.CfnWebACL

	constructor(
		distribution: cloudfront.Distribution,
		wafWebAcl: wafv2.CfnWebACL,
	) {
		this.distribution = distribution
		this.wafWebAcl = wafWebAcl
	}

	// Configure WAF rules for CloudFront
	configureWAFRules(): void {
		// Rate limiting rules
		this.wafWebAcl.addPropertyOverride('Rules', [
			{
				Name: 'RateLimitRule',
				Priority: 1,
				Statement: {
					RateBasedStatement: {
						Limit: 2000,
						AggregateKeyType: 'IP',
					},
				},
				Action: {
					Block: {},
				},
				VisibilityConfig: {
					SampledRequestsEnabled: true,
					CloudWatchMetricsEnabled: true,
					MetricName: 'RateLimitRule',
				},
			},
			{
				Name: 'GeoBlockingRule',
				Priority: 2,
				Statement: {
					GeoMatchStatement: {
						CountryCodes: ['CN', 'RU', 'KP', 'IR'],
					},
				},
				Action: {
					Block: {},
				},
				VisibilityConfig: {
					SampledRequestsEnabled: true,
					CloudWatchMetricsEnabled: true,
					MetricName: 'GeoBlockingRule',
				},
			},
		])
	}
}
```

### 2. Security Headers

```typescript
// Security headers configuration
class CloudFrontSecurityHeaders {
	private distribution: cloudfront.Distribution

	constructor(distribution: cloudfront.Distribution) {
		this.distribution = distribution
	}

	// Configure security headers
	configureSecurityHeaders(): void {
		const securityHeadersPolicy = new cloudfront.ResponseHeadersPolicy(
			this,
			'SecurityHeadersPolicy',
			{
				comment: 'Security headers policy for Macro AI',
				securityHeadersBehavior: {
					strictTransportSecurity: {
						accessControlMaxAge: cdk.Duration.seconds(31536000),
						includeSubdomains: true,
						preload: true,
					},
					contentTypeOptions: {
						override: false,
					},
					frameOptions: {
						frameOption: cloudfront.HeadersFrameOption.DENY,
						override: false,
					},
					referrerPolicy: {
						referrerPolicy:
							cloudfront.HeadersReferrerPolicy.STRICT_ORIGIN_WHEN_CROSS_ORIGIN,
						override: false,
					},
				},
				customHeadersBehavior: {
					customHeaders: [
						{
							header: 'X-Content-Type-Options',
							value: 'nosniff',
							override: false,
						},
						{
							header: 'X-Frame-Options',
							value: 'DENY',
							override: false,
						},
						{
							header: 'X-XSS-Protection',
							value: '1; mode=block',
							override: false,
						},
					],
				},
			},
		)
	}
}
```

## Monitoring and Analytics

### 1. CloudWatch Metrics

```typescript
// CloudFront CloudWatch metrics
class CloudFrontMetrics {
	private cloudWatch: CloudWatchClient

	constructor() {
		this.cloudWatch = new CloudWatchClient({ region: 'us-east-1' })
	}

	// Get CloudFront metrics
	async getCloudFrontMetrics(
		distributionId: string,
	): Promise<CloudFrontMetrics> {
		const metrics = await this.cloudWatch.getMetricStatistics({
			Namespace: 'AWS/CloudFront',
			MetricName: 'Requests',
			Dimensions: [
				{
					Name: 'DistributionId',
					Value: distributionId,
				},
			],
			StartTime: new Date(Date.now() - 3600000), // 1 hour ago
			EndTime: new Date(),
			Period: 300, // 5 minutes
			Statistics: ['Sum', 'Average', 'Maximum'],
		})

		return {
			requests: metrics.Datapoints || [],
			cacheHitRate: await this.getCacheHitRate(distributionId),
			errorRate: await this.getErrorRate(distributionId),
			averageLatency: await this.getAverageLatency(distributionId),
		}
	}

	private async getCacheHitRate(distributionId: string): Promise<number> {
		// Get cache hit rate from CloudWatch
		const metrics = await this.cloudWatch.getMetricStatistics({
			Namespace: 'AWS/CloudFront',
			MetricName: 'CacheHitRate',
			Dimensions: [
				{
					Name: 'DistributionId',
					Value: distributionId,
				},
			],
			StartTime: new Date(Date.now() - 3600000),
			EndTime: new Date(),
			Period: 300,
			Statistics: ['Average'],
		})

		const datapoints = metrics.Datapoints || []
		return datapoints.length > 0 ? datapoints[0].Average || 0 : 0
	}

	private async getErrorRate(distributionId: string): Promise<number> {
		// Get error rate from CloudWatch
		const metrics = await this.cloudWatch.getMetricStatistics({
			Namespace: 'AWS/CloudFront',
			MetricName: '4xxErrorRate',
			Dimensions: [
				{
					Name: 'DistributionId',
					Value: distributionId,
				},
			],
			StartTime: new Date(Date.now() - 3600000),
			EndTime: new Date(),
			Period: 300,
			Statistics: ['Average'],
		})

		const datapoints = metrics.Datapoints || []
		return datapoints.length > 0 ? datapoints[0].Average || 0 : 0
	}

	private async getAverageLatency(distributionId: string): Promise<number> {
		// Get average latency from CloudWatch
		const metrics = await this.cloudWatch.getMetricStatistics({
			Namespace: 'AWS/CloudFront',
			MetricName: 'OriginLatency',
			Dimensions: [
				{
					Name: 'DistributionId',
					Value: distributionId,
				},
			],
			StartTime: new Date(Date.now() - 3600000),
			EndTime: new Date(),
			Period: 300,
			Statistics: ['Average'],
		})

		const datapoints = metrics.Datapoints || []
		return datapoints.length > 0 ? datapoints[0].Average || 0 : 0
	}
}
```

### 2. Real User Monitoring (RUM)

```typescript
// Real User Monitoring for CloudFront
class CloudFrontRUM {
	private distribution: cloudfront.Distribution

	constructor(distribution: cloudfront.Distribution) {
		this.distribution = distribution
	}

	// Configure RUM for CloudFront
	configureRUM(): void {
		const rumApp = new rum.CfnAppMonitor(this, 'RUMAppMonitor', {
			name: 'macro-ai-cloudfront-rum',
			domain: 'macro-ai.com',
			appMonitorConfiguration: {
				allowCookies: true,
				enableXRay: true,
				sessionSampleRate: 0.1,
				telemetries: ['errors', 'performance', 'http'],
			},
		})

		// Add RUM script to CloudFront
		this.distribution.addBehavior('rum.js', {
			origin: new cloudfront.Origins.S3Origin(this.rumBucket),
			viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
			allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD_OPTIONS,
			cachedMethods: cloudfront.CachedMethods.CACHE_GET_HEAD,
			compress: true,
			cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
		})
	}
}
```

## Cost Optimization

### 1. Price Class Optimization

```typescript
// Price class optimization
class CloudFrontPriceOptimization {
	private distribution: cloudfront.Distribution

	constructor(distribution: cloudfront.Distribution) {
		this.distribution = distribution
	}

	// Optimize price class based on user base
	optimizePriceClass(userBase: UserBase): cloudfront.PriceClass {
		const { usUsers, euUsers, asiaUsers, otherUsers } = userBase

		const totalUsers = usUsers + euUsers + asiaUsers + otherUsers
		const usPercentage = usUsers / totalUsers
		const euPercentage = euUsers / totalUsers
		const asiaPercentage = asiaUsers / totalUsers

		// If most users are in US/Canada/Europe, use PriceClass_100
		if (usPercentage + euPercentage > 0.8) {
			return cloudfront.PriceClass.PRICE_CLASS_100
		}

		// If significant users in Asia, use PriceClass_200
		if (asiaPercentage > 0.3) {
			return cloudfront.PriceClass.PRICE_CLASS_200
		}

		// Otherwise, use all edge locations
		return cloudfront.PriceClass.PRICE_CLASS_ALL
	}
}
```

### 2. Cache Optimization

```typescript
// Cache optimization strategies
class CloudFrontCacheOptimization {
	private distribution: cloudfront.Distribution

	constructor(distribution: cloudfront.Distribution) {
		this.distribution = distribution
	}

	// Optimize cache TTL based on content type
	optimizeCacheTtl(contentType: string, updateFrequency: string): number {
		switch (contentType) {
			case 'text/css':
			case 'application/javascript':
				return updateFrequency === 'frequent' ? 3600 : 86400

			case 'image/png':
			case 'image/jpeg':
			case 'image/gif':
				return 31536000 // 1 year

			case 'text/html':
				return updateFrequency === 'frequent' ? 300 : 3600

			case 'application/json':
				return updateFrequency === 'frequent' ? 60 : 300

			default:
				return 86400 // 1 day
		}
	}

	// Optimize cache invalidation
	async optimizeCacheInvalidation(paths: string[]): Promise<void> {
		// Group paths by type for efficient invalidation
		const staticPaths = paths.filter((path) => path.startsWith('/static/'))
		const apiPaths = paths.filter((path) => path.startsWith('/api/'))
		const htmlPaths = paths.filter((path) => path.endsWith('.html'))

		// Invalidate static assets less frequently
		if (staticPaths.length > 0) {
			await this.distribution.createInvalidation({
				paths: staticPaths,
			})
		}

		// Invalidate API responses more frequently
		if (apiPaths.length > 0) {
			await this.distribution.createInvalidation({
				paths: apiPaths,
			})
		}

		// Invalidate HTML pages immediately
		if (htmlPaths.length > 0) {
			await this.distribution.createInvalidation({
				paths: htmlPaths,
			})
		}
	}
}
```

## Conclusion

This comprehensive CloudFront CDN integration strategy provides a clear path for implementing global content delivery
while maintaining performance, security, and cost optimization. The phased approach ensures a smooth integration with proper
monitoring and optimization.

### Key Benefits

1. **Global Performance**: Reduced latency for international users
2. **Cost Optimization**: Reduced bandwidth costs and origin server load
3. **Security**: WAF integration and security headers
4. **Scalability**: Automatic scaling with CloudFront edge locations
5. **Monitoring**: Comprehensive CloudWatch metrics and RUM
6. **Flexibility**: Multiple caching strategies for different content types

### Next Steps

1. **Complete Assessment**: Finish current state analysis and requirements gathering
2. **Infrastructure Setup**: Provision CloudFront infrastructure and configure origins
3. **Integration Testing**: Test CDN integration in staging environment
4. **Production Deployment**: Deploy CloudFront with proper monitoring and optimization
5. **Performance Tuning**: Optimize caching strategies and monitor performance metrics

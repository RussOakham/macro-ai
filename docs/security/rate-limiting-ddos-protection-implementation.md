# Rate Limiting and DDoS Protection Implementation

## Overview

This document describes the comprehensive rate limiting and DDoS protection implementation for the Macro AI infrastructure.
The system provides multiple layers of protection at both the infrastructure and application levels.

## Architecture

### Layered Defense Strategy

```text
┌─────────────────────────────────────────────────────────────┐
│                    Client Requests                         │
└─────────────────────┬───────────────────────────────────────┘
                      │
┌─────────────────────▼───────────────────────────────────────┐
│              AWS WAF Rate Limiting                         │
│  • General: 1000 requests/5min per IP                     │
│  • API: 500 requests/5min per IP                          │
│  • Auth: 100 requests/5min per IP                         │
│  • Admin: 200 requests/5min per IP                        │
│  • Burst: 200 requests/1min per IP                        │
└─────────────────────┬───────────────────────────────────────┘
                      │
┌─────────────────────▼───────────────────────────────────────┐
│              DDoS Protection Layer                         │
│  • Detection: 50 requests/sec per IP                      │
│  • Mitigation: 100 requests/sec per IP                    │
│  • Geographic blocking for monitored countries             │
│  • Bot protection and behavioral analysis                 │
└─────────────────────┬───────────────────────────────────────┘
                      │
┌─────────────────────▼───────────────────────────────────────┐
│              Application Load Balancer                     │
└─────────────────────┬───────────────────────────────────────┘
                      │
┌─────────────────────▼───────────────────────────────────────┐
│              Express API Rate Limiting                     │
│  • Default: 100 requests/15min (Redis-backed)             │
│  • Auth: 10 requests/hour (Redis-backed)                  │
│  • API: 60 requests/minute (Redis-backed)                 │
└─────────────────────────────────────────────────────────────┘
```

## Components

### 1. Rate Limiting Construct (`RateLimitingConstruct`)

**Purpose**: Provides infrastructure-level rate limiting using AWS WAF.

**Features**:

- **Multi-tier rate limiting** with different limits for different endpoint types
- **Progressive rate limiting** with increasing delays for repeat offenders
- **Adaptive rate limiting** that adjusts based on traffic patterns
- **IP-based aggregation** for distributed protection
- **CloudWatch monitoring** and alerting

**Configuration**:

```typescript
rateLimiting: {
  generalLimit: 1000,    // 1000 requests per 5 minutes per IP
  apiLimit: 500,         // 500 API requests per 5 minutes per IP
  authLimit: 100,        // 100 auth requests per 5 minutes per IP
  adminLimit: 200,       // 200 admin requests per 5 minutes per IP
  burstLimit: 200,       // 200 requests per minute per IP
  enableProgressiveLimiting: true,
  enableAdaptiveLimiting: true,
}
```

### 2. DDoS Protection Construct (`DDoSProtectionConstruct`)

**Purpose**: Provides advanced DDoS protection and threat detection.

**Features**:

- **Real-time DDoS detection** with configurable thresholds
- **Geographic-based protection** for monitored countries
- **Bot detection and mitigation** using AWS managed rules
- **Behavioral analysis** for unusual traffic patterns
- **Automatic IP blocking** for repeat offenders
- **Lambda-based analysis** for complex threat detection

**Configuration**:

```typescript
ddosProtection: {
  enabled: true,
  detectionThreshold: 50,      // 50 requests per second per IP
  mitigationThreshold: 100,    // 100 requests per second per IP
  enableGeoProtection: true,
  monitoredCountries: ['CN', 'RU', 'KP', 'IR', 'KP'],
  enableBotProtection: true,
  enableIpReputation: true,
  enableBehavioralAnalysis: true,
  enableAutoIpBlocking: true,
  ipBlockingDuration: 60,      // 60 minutes
}
```

### 3. Security Monitoring Construct (`SecurityMonitoringConstruct`)

**Purpose**: Provides comprehensive security monitoring and incident response.

**Features**:

- **Threat intelligence monitoring** with real-time analysis
- **Security event correlation** across multiple sources
- **Automated incident response** with configurable actions
- **Compliance monitoring** for security standards
- **Vulnerability scanning** and assessment
- **Incident response automation** with Lambda functions

**Configuration**:

```typescript
securityMonitoring: {
  enableThreatIntelligence: true,
  enableEventCorrelation: true,
  enableAutomatedResponse: true,
  enableComplianceMonitoring: true,
  enableVulnerabilityScanning: true,
  enableIncidentResponse: true,
}
```

## Rate Limiting Rules

### WAF Rate Limiting Rules

1. **Allow List Rule** (Priority 0)
   - Allows traffic from trusted IP addresses
   - Bypasses all other rate limiting rules

2. **Block List Rule** (Priority 1)
   - Blocks traffic from known malicious IP addresses
   - Immediate blocking without rate limiting

3. **DDoS Detection Rule** (Priority 2)
   - Monitors for high-frequency requests (50 req/sec)
   - Counts requests for analysis

4. **DDoS Mitigation Rule** (Priority 3)
   - Blocks high-frequency requests (100 req/sec)
   - Immediate blocking for DDoS attacks

5. **Geographic DDoS Protection** (Priority 4)
   - Stricter limits for monitored countries
   - Blocks suspicious traffic from specific regions

6. **Bot Protection Rule** (Priority 5)
   - Uses AWS managed bot detection rules
   - Blocks automated traffic and scrapers

7. **Burst Rate Limiting** (Priority 6)
   - 200 requests per minute per IP
   - Prevents burst attacks

8. **API Endpoint Rate Limiting** (Priority 7)
   - 500 requests per 5 minutes for `/api/*` endpoints
   - Protects API endpoints specifically

9. **Authentication Rate Limiting** (Priority 8)
   - 100 requests per 5 minutes for auth endpoints
   - Protects login, register, password reset

10. **Admin Endpoint Rate Limiting** (Priority 9)
    - 200 requests per 5 minutes for `/admin/*` endpoints
    - Protects administrative functions

11. **General Rate Limiting** (Priority 10)
    - 1000 requests per 5 minutes per IP
    - Catch-all rate limiting rule

## DDoS Protection Features

### Detection Mechanisms

1. **Volume-based Detection**
   - Monitors request volume per IP address
   - Detects sudden spikes in traffic

2. **Geographic Analysis**
   - Monitors traffic patterns by country
   - Identifies unusual geographic distributions

3. **Behavioral Analysis**
   - Analyzes request patterns and timing
   - Detects automated and bot traffic

4. **IP Reputation**
   - Checks against known malicious IP lists
   - Blocks traffic from suspicious sources

### Mitigation Strategies

1. **Rate Limiting**
   - Implements strict rate limits for suspicious traffic
   - Progressive rate limiting for repeat offenders

2. **Geographic Blocking**
   - Blocks traffic from high-risk countries
   - Configurable country allow/deny lists

3. **IP Blocking**
   - Automatic IP blocking for repeat offenders
   - Configurable blocking duration

4. **Bot Mitigation**
   - Uses AWS managed bot detection rules
   - Challenges suspicious traffic

## Monitoring and Alerting

### CloudWatch Metrics

1. **Rate Limiting Metrics**
   - `BlockedRequests`: Number of blocked requests
   - `AllowedRequests`: Number of allowed requests
   - `CountedRequests`: Number of counted requests

2. **DDoS Protection Metrics**
   - `DDoSDetectionRule`: Requests triggering DDoS detection
   - `DDoSMitigationRule`: Requests blocked by DDoS mitigation
   - `GeoDDoSProtectionRule`: Geographic-based blocks

3. **Bot Protection Metrics**
   - `BotProtectionRule`: Bot traffic blocked
   - `BotChallengeRule`: Bot challenges issued

### CloudWatch Alarms

1. **High Rate Limiting Activity**
   - Threshold: 100 blocked requests in 5 minutes
   - Action: SNS notification

2. **DDoS Detection**
   - Threshold: 50 requests triggering DDoS detection
   - Action: SNS notification

3. **Bot Protection**
   - Threshold: 20 bot requests blocked
   - Action: SNS notification

4. **High Security Risk**
   - Threshold: 500 blocked requests in 5 minutes
   - Action: SNS notification

5. **Unusual Access Pattern**
   - Threshold: Response time > 5 seconds
   - Action: SNS notification

### Dashboards

1. **Rate Limiting Dashboard**
   - Real-time rate limiting metrics
   - Blocked vs allowed requests
   - Rate limiting by rule type

2. **DDoS Protection Dashboard**
   - DDoS detection and mitigation metrics
   - Geographic distribution of attacks
   - Bot protection statistics

3. **Security Monitoring Dashboard**
   - Overall security overview
   - Threat detection metrics
   - Performance impact analysis

## Integration with Express API

### Layered Approach

The implementation uses a layered approach where:

1. **AWS WAF** provides coarse-grained, infrastructure-level protection
2. **Express API** provides fine-grained, application-level protection

### Configuration Alignment

To avoid conflicts, the rate limiting thresholds are configured as follows:

```text
AWS WAF (Infrastructure)     Express API (Application)
─────────────────────────    ──────────────────────────
1000 requests/5min         100 requests/15min
500 API requests/5min      60 API requests/1min
100 auth requests/5min     10 auth requests/1hour
200 admin requests/5min    (No specific admin limits)
200 burst requests/1min    (No specific burst limits)
```

### Benefits of Layered Approach

1. **Defense in Depth**: Multiple layers of protection
2. **Performance**: WAF blocks malicious traffic before reaching application
3. **Cost Efficiency**: Reduces load on ECS tasks
4. **Flexibility**: Application-level control for business logic
5. **Scalability**: Infrastructure-level protection scales automatically

## Environment-Specific Configuration

### Production Environment

```typescript
rateLimiting: {
  generalLimit: 1000,
  apiLimit: 500,
  authLimit: 100,
  adminLimit: 200,
  burstLimit: 200,
  enableProgressiveLimiting: true,
  enableAdaptiveLimiting: true,
},
ddosProtection: {
  enabled: true,
  detectionThreshold: 50,
  mitigationThreshold: 100,
  enableGeoProtection: true,
  monitoredCountries: ['CN', 'RU', 'KP', 'IR', 'KP'],
  enableBotProtection: true,
}
```

### Staging Environment

```typescript
rateLimiting: {
  generalLimit: 2000,      // More permissive for testing
  apiLimit: 1000,
  authLimit: 200,
  adminLimit: 400,
  burstLimit: 400,
  enableProgressiveLimiting: false,
  enableAdaptiveLimiting: false,
},
ddosProtection: {
  enabled: true,
  detectionThreshold: 100,  // Higher thresholds
  mitigationThreshold: 200,
  enableGeoProtection: false, // Disabled for testing
  monitoredCountries: [],
  enableBotProtection: true,
}
```

### Development Environment

```typescript
rateLimiting: {
  generalLimit: 5000,      // Very permissive for development
  apiLimit: 2500,
  authLimit: 500,
  adminLimit: 1000,
  burstLimit: 1000,
  enableProgressiveLimiting: false,
  enableAdaptiveLimiting: false,
},
ddosProtection: {
  enabled: false,           // Disabled for development
  detectionThreshold: 1000,
  mitigationThreshold: 2000,
  enableGeoProtection: false,
  monitoredCountries: [],
  enableBotProtection: false,
}
```

## Cost Considerations

### AWS WAF Costs

- **WebACL**: ~$1-5 per month per WebACL
- **Requests**: $0.60 per million requests
- **Rules**: $0.60 per rule per month
- **Logs**: $0.50 per GB ingested

### CloudWatch Costs

- **Metrics**: $0.30 per metric per month
- **Alarms**: $0.10 per alarm per month
- **Logs**: $0.50 per GB ingested
- **Dashboards**: $3.00 per dashboard per month

### Lambda Costs

- **DDoS Analysis**: ~$0.20 per million requests
- **Security Analysis**: ~$0.20 per million requests
- **Incident Response**: ~$0.20 per million requests

### Estimated Monthly Costs

- **Production**: $50-100 per month
- **Staging**: $25-50 per month
- **Development**: $10-25 per month

## Security Best Practices

### 1. Regular Monitoring

- Monitor CloudWatch dashboards daily
- Review security alerts immediately
- Analyze traffic patterns weekly

### 2. Threshold Tuning

- Start with conservative thresholds
- Monitor false positive rates
- Adjust thresholds based on traffic patterns

### 3. Incident Response

- Have incident response procedures ready
- Test alerting mechanisms regularly
- Maintain contact lists for security team

### 4. Compliance

- Document all security measures
- Maintain audit logs
- Regular security assessments

## Troubleshooting

### Common Issues

1. **False Positives**
   - Adjust rate limiting thresholds
   - Review IP allow lists
   - Check geographic blocking rules

2. **Performance Impact**
   - Monitor response times
   - Adjust WAF rule priorities
   - Consider caching strategies

3. **Alert Fatigue**
   - Tune alarm thresholds
   - Implement alert correlation
   - Use different severity levels

### Debugging Steps

1. **Check CloudWatch Logs**
   - Review WAF logs for blocked requests
   - Analyze Lambda function logs
   - Check CloudWatch metrics

2. **Test Rate Limiting**
   - Use tools like `curl` or `ab` for testing
   - Test different endpoint types
   - Verify threshold behavior

3. **Monitor Dashboards**
   - Check real-time metrics
   - Look for unusual patterns
   - Verify alarm states

## Future Enhancements

### Planned Features

1. **Machine Learning-based Detection**
   - Implement ML models for threat detection
   - Adaptive rate limiting based on ML analysis
   - Behavioral pattern recognition

2. **Advanced Analytics**
   - Security event correlation
   - Threat intelligence integration
   - Predictive security analytics

3. **Automated Response**
   - Automatic IP blocking
   - Dynamic rule updates
   - Self-healing security measures

4. **Integration Enhancements**
   - SIEM integration
   - External threat feeds
   - Third-party security tools

## Conclusion

The rate limiting and DDoS protection implementation provides comprehensive security for the Macro AI infrastructure. The
layered approach ensures both infrastructure-level and application-level protection while maintaining performance and
flexibility. Regular monitoring and tuning are essential for maintaining effective security posture.

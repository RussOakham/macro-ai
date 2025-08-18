# EC2 Express API Validation Guide

This guide provides comprehensive procedures for validating Express API functionality when deployed to EC2 instances,
ensuring proper startup, health checks, API endpoint accessibility, environment variable loading, PM2 process management,
and deployment artifact handling.

## Overview

The EC2 Express API validation system consists of:

- **Health endpoint validation**: `/health`, `/health/ready`, `/health/live`, `/health/detailed`
- **Load Balancer integration**: ALB health checks and routing
- **EC2 instance health**: Auto Scaling Group and target group health
- **API functionality**: Core endpoints and documentation
- **Performance validation**: Response times and reliability

## Health Endpoints Overview

The Express API provides comprehensive health check endpoints:

### Core Health Endpoints

- **`/api/health`** - Basic health check (public, no rate limiting)
- **`/api/health/ready`** - Readiness probe (Kubernetes-style)
- **`/api/health/ready/public`** - Public readiness probe (minimal info)
- **`/api/health/live`** - Liveness probe (Kubernetes-style)
- **`/api/health/detailed`** - Detailed health check for monitoring

### Health Check Features

- **No rate limiting** on health endpoints to prevent ALB failures
- **Go-style error handling** with Result tuple patterns
- **Comprehensive checks**: Database, memory, disk, dependencies
- **Production-safe responses** with sanitized error details
- **CORS enabled** for browser access

## Validation Script Usage

### Basic Validation

```bash
cd infrastructure

# Validate by PR number (recommended)
./scripts/validate-ec2-api-health.sh --pr-number 123 --verbose

# Validate by environment name
./scripts/validate-ec2-api-health.sh --env-name pr-456

# Validate by ALB URL directly
./scripts/validate-ec2-api-health.sh --alb-url https://macro-ai-pr123-alb-123456789.us-east-1.elb.amazonaws.com

# Comprehensive validation with performance tests
./scripts/validate-ec2-api-health.sh --pr-number 123 --comprehensive --verbose
```

### Advanced Options

```bash
# Custom timeout and retry settings
./scripts/validate-ec2-api-health.sh --pr-number 123 --timeout 60 --max-retries 10 --retry-interval 15

# Validate specific stack
./scripts/validate-ec2-api-health.sh --stack-name MacroAiPr123Stack --comprehensive

# Help and options
./scripts/validate-ec2-api-health.sh --help
```

## Validation Test Categories

### 1. Health Endpoint Validation

**Tests Performed:**

- **Basic Health Check** (`/api/health`): Validates basic API health status
- **Readiness Check** (`/api/health/ready`): Ensures API is ready to receive traffic
- **Liveness Check** (`/api/health/live`): Confirms API is alive and responsive
- **Detailed Health Check** (`/api/health/detailed`): Comprehensive system health

**Expected Results:**

- All endpoints return HTTP 200 status
- Response bodies contain expected JSON structure
- Readiness endpoint shows `"ready": true`
- Liveness endpoint shows `"alive": true`
- Detailed endpoint includes health checks for database, memory, disk, dependencies

### 2. Load Balancer Integration

**Tests Performed:**

- **ALB Health Check**: Validates Load Balancer can reach health endpoints
- **Response Headers**: Ensures proper HTTP headers are returned
- **Routing Validation**: Confirms ALB routes requests correctly to EC2 instances

**Expected Results:**

- ALB health checks pass consistently
- HTTP response headers are properly formatted
- No 502/503 errors from Load Balancer
- Consistent routing to healthy instances

### 3. API Functionality Testing

**Tests Performed:**

- **Root API Endpoint** (`/api`): Basic API accessibility
- **API Documentation** (`/api-docs`): Swagger UI accessibility
- **CORS Configuration**: Cross-origin request handling

**Expected Results:**

- Root API endpoint returns valid response
- Swagger documentation is accessible
- CORS headers are properly configured
- No authentication errors for public endpoints

### 4. Performance Validation

**Tests Performed (Comprehensive Mode):**

- **Response Time Testing**: Multiple samples of health endpoint response times
- **Consistency Testing**: Validates consistent performance across requests
- **Load Testing**: Basic load validation with multiple concurrent requests

**Expected Results:**

- Average response time < 2 seconds
- Consistent response times across samples
- No timeouts or connection errors
- Stable performance under basic load

### 5. EC2 Instance Health

**Tests Performed (Comprehensive Mode):**

- **Auto Scaling Group Health**: Validates healthy instances in ASG
- **Target Group Health**: Confirms healthy targets in ALB target groups
- **Instance Status**: Checks EC2 instance health status

**Expected Results:**

- At least one healthy instance in Auto Scaling Group
- All instances registered as healthy in target groups
- No instances in unhealthy or draining state

## Manual Validation Procedures

### 1. Direct Health Check Testing

```bash
# Test health endpoints directly
curl -v https://your-alb-url.elb.amazonaws.com/api/health
curl -v https://your-alb-url.elb.amazonaws.com/api/health/ready
curl -v https://your-alb-url.elb.amazonaws.com/api/health/live
curl -v https://your-alb-url.elb.amazonaws.com/api/health/detailed

# Expected responses:
# /api/health: {"message": "API is healthy"}
# /api/health/ready: {"ready": true, "timestamp": "...", "checks": {...}}
# /api/health/live: {"alive": true, "timestamp": "...", "uptime": ...}
# /api/health/detailed: {"ready": true, "checks": {"database": {...}, ...}}
```

### 2. Load Balancer Health Check Validation

```bash
# Check ALB target group health
aws elbv2 describe-target-groups --region us-east-1 --query "TargetGroups[?contains(TargetGroupName, 'pr-123')]"

# Check target health status
aws elbv2 describe-target-health --target-group-arn arn:aws:elasticloadbalancing:... --region us-east-1

# Expected: All targets should show "State": "healthy"
```

### 3. EC2 Instance Validation

```bash
# Check Auto Scaling Group status
aws autoscaling describe-auto-scaling-groups --region us-east-1 --query "AutoScalingGroups[?contains(AutoScalingGroupName, 'pr-123')]"

# Check instance health
aws autoscaling describe-auto-scaling-groups --region us-east-1 --query "AutoScalingGroups[?contains(AutoScalingGroupName, 'pr-123')].Instances[*].{InstanceId:InstanceId,HealthStatus:HealthStatus,LifecycleState:LifecycleState}"

# Expected: HealthStatus: "Healthy", LifecycleState: "InService"
```

## Troubleshooting Guide

### Common Issues and Solutions

#### 1. Health Endpoints Not Accessible

**Symptoms:**

- 502/503 errors from Load Balancer
- Connection timeouts
- Health check failures

**Troubleshooting Steps:**

```bash
# Check EC2 instance status
aws ec2 describe-instances --region us-east-1 --filters "Name=tag:Environment,Values=pr-123"

# Check application logs
# (SSH to instance or check CloudWatch logs)
sudo journalctl -u macro-ai.service -f
pm2 logs macro-ai-api

# Check if application is listening on correct port
sudo netstat -tlnp | grep 3040
```

**Common Causes:**

- Application not started or crashed
- Wrong port configuration
- Security group blocking traffic
- Environment variables not loaded

#### 2. Slow Response Times

**Symptoms:**

- Response times > 2 seconds
- Intermittent timeouts
- Performance test failures

**Troubleshooting Steps:**

```bash
# Check system resources
top
free -h
df -h

# Check application performance
pm2 monit
pm2 logs macro-ai-api --lines 100

# Check database connections
# (if applicable - check database health in detailed endpoint)
```

#### 3. Load Balancer Health Check Failures

**Symptoms:**

- Targets showing as unhealthy
- 502 errors from ALB
- Inconsistent routing

**Troubleshooting Steps:**

```bash
# Check ALB health check configuration
aws elbv2 describe-target-groups --region us-east-1 --target-group-arns arn:aws:elasticloadbalancing:...

# Verify health check path and settings
# Expected: HealthCheckPath: "/api/health", HealthCheckPort: "3040"

# Test health check directly on instance
curl -v http://instance-private-ip:3040/api/health
```

## Integration with CI/CD

### GitHub Actions Integration

The validation script can be integrated into deployment workflows:

```yaml
- name: Validate EC2 API Health
  run: |
    cd infrastructure
    ./scripts/validate-ec2-api-health.sh --pr-number ${{ github.event.pull_request.number }} --comprehensive --verbose
  env:
    AWS_REGION: us-east-1
```

### Post-Deployment Validation

```bash
# Add to deployment pipeline after EC2 stack creation
- name: Wait for API to be ready
  run: |
    cd infrastructure
    # Wait up to 10 minutes for API to be healthy
    timeout 600 bash -c 'until ./scripts/validate-ec2-api-health.sh --pr-number ${{ github.event.pull_request.number }}; do sleep 30; done'
```

## Success Criteria

The EC2 Express API is considered successfully validated when:

- [ ] ✅ All health endpoints return HTTP 200 with valid JSON responses
- [ ] ✅ Load Balancer health checks pass consistently
- [ ] ✅ API functionality endpoints are accessible
- [ ] ✅ Response times are under 2 seconds average
- [ ] ✅ EC2 instances are healthy in Auto Scaling Group
- [ ] ✅ Target groups show all instances as healthy
- [ ] ✅ No 502/503 errors from Load Balancer
- [ ] ✅ CORS configuration allows proper browser access
- [ ] ✅ API documentation is accessible via `/api-docs`

## Monitoring and Alerting

### CloudWatch Metrics

Monitor these key metrics for ongoing health:

- **ALB Target Response Time**: Should be < 2 seconds
- **ALB Healthy Host Count**: Should match desired capacity
- **ALB HTTP 5XX Errors**: Should be 0
- **EC2 Instance CPU/Memory**: Should be within normal ranges

### Log Monitoring

Key log patterns to monitor:

- Application startup messages
- Health check request patterns
- Error messages and stack traces
- PM2 process restart events

### Automated Alerting

Set up CloudWatch alarms for:

- ALB target health dropping below 100%
- High response times (> 5 seconds)
- HTTP 5XX error rate > 1%
- EC2 instance health check failures

## ALB API Routing Validation

### Additional Validation Script

For comprehensive API endpoint accessibility testing through the ALB:

```bash
cd infrastructure

# Test all API routing through ALB
./scripts/validate-alb-api-routing.sh --pr-number 123 --comprehensive --verbose

# Test specific aspects
./scripts/validate-alb-api-routing.sh --alb-url https://your-alb-url.elb.amazonaws.com --test-cors
./scripts/validate-alb-api-routing.sh --stack-name MacroAiPr123Stack --test-auth
```

### API Routing Tests

The ALB routing validation covers:

- **API endpoint routing**: All major API categories (auth, chat, user, utility)
- **CORS configuration**: Preflight requests and origin validation
- **Security headers**: CSP, XSS protection, frame options
- **Error handling**: 404, 405, 400 status codes
- **Rate limiting**: Middleware functionality validation
- **Load Balancer features**: Health checks, routing consistency

### Expected Results

- ✅ All API endpoints accessible through ALB (200 status codes)
- ✅ CORS preflight requests work correctly
- ✅ Security headers present in responses
- ✅ Error handling returns appropriate status codes
- ✅ Rate limiting functions properly
- ✅ Load Balancer routing is consistent

## Next Steps

After successful validation:

1. **Monitor Production**: Set up comprehensive monitoring and alerting
2. **Performance Optimization**: Tune application and infrastructure based on metrics
3. **Scaling Configuration**: Adjust Auto Scaling Group settings based on load patterns
4. **Security Hardening**: Review and enhance security configurations
5. **Documentation Updates**: Keep validation procedures updated with any changes

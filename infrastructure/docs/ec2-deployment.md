# EC2 Application Deployment Guide

## Overview

This document describes the comprehensive EC2 deployment system for the Macro AI Express API. The system includes automated instance initialization, application deployment, monitoring, and lifecycle management.

## Architecture Components

### 1. User Data Script

The EC2 instances are automatically configured using a comprehensive user data script that:

- Installs Node.js 20 LTS and required system packages
- Sets up application user and directory structure
- Configures systemd service for the Express API
- Sets up CloudWatch monitoring and logging
- Implements health checks and error handling

### 2. Deployment Script

A production-ready deployment script (`infrastructure/scripts/deploy-app.sh`) that:

- Downloads and deploys application artifacts
- Manages release versions and rollbacks
- Handles dependency installation
- Performs health checks and service management
- Supports CI/CD integration

### 3. Service Management

- **Systemd Service**: Manages the Express API as a system service
- **PM2 Integration**: Advanced process management with monitoring
- **Graceful Shutdown**: Proper SIGTERM handling for zero-downtime deployments
- **Auto-restart**: Automatic recovery from failures

## Directory Structure

```
/opt/macro-ai/
├── current/              # Symlink to current release
├── releases/             # All deployed releases
│   ├── 20240115_143022/  # Timestamped releases
│   └── 20240115_150000/
├── shared/               # Shared files across releases
├── .env                  # Environment configuration
├── deploy.sh             # Deployment script
└── ecosystem.config.js   # PM2 configuration

/var/log/macro-ai/
├── combined.log          # Application logs
├── error.log             # Error logs
└── out.log               # Output logs
```

## User Data Script Features

### System Setup

- **Package Management**: Updates system and installs Node.js 20 LTS
- **User Management**: Creates dedicated `macroai` user for security
- **Directory Structure**: Sets up application and log directories
- **Security**: Implements proper file permissions and ownership

### Application Configuration

- **Environment Variables**: Configures production environment settings
- **Service Definition**: Creates systemd service with security hardening
- **Process Management**: Sets up PM2 for advanced process monitoring
- **Health Checks**: Implements startup verification and monitoring

### Monitoring and Logging

- **CloudWatch Integration**: Comprehensive metrics and log collection
- **Log Rotation**: Automated log management to prevent disk space issues
- **System Metrics**: CPU, memory, disk, and network monitoring
- **Application Logs**: Structured logging with proper rotation

### Error Handling

- **Comprehensive Logging**: All operations logged with timestamps
- **Error Recovery**: Graceful error handling with CloudFormation signals
- **Validation**: Prerequisites and dependency validation
- **Rollback Support**: Automatic rollback on deployment failures

## Deployment Process

### 1. Initial Instance Setup (User Data)

```bash
# Executed automatically when EC2 instance starts
1. System package updates
2. Node.js 20 LTS installation
3. User and directory creation
4. Service configuration
5. Monitoring setup
6. CloudFormation success signal
```

### 2. Application Deployment (CI/CD)

```bash
# Executed by CI/CD pipeline or manually
./infrastructure/scripts/deploy-app.sh deploy \
  --artifact-url https://github.com/user/repo/releases/download/v1.0.0/app.tar.gz \
  --version 1.0.0 \
  --environment production
```

### 3. Health Verification

```bash
# Automatic health checks
curl http://localhost:3030/api/health
systemctl status macro-ai.service
```

## Environment Configuration

### Environment Variables

- `PARAMETER_STORE_PREFIX`: AWS Parameter Store prefix for configuration
- `NODE_ENV`: Runtime environment (production)
- `PORT`: Application port (3030)
- `APP_ENV`: Application environment
- `PR_NUMBER`: PR number for preview environments (optional)

### Parameter Store Integration

The application loads configuration from AWS Parameter Store using the configured prefix:

- Database connections
- API keys and secrets
- Feature flags
- Environment-specific settings

## Service Management

### Systemd Service

```bash
# Service management commands
systemctl start macro-ai.service
systemctl stop macro-ai.service
systemctl restart macro-ai.service
systemctl status macro-ai.service

# View logs
journalctl -u macro-ai.service -f
```

### PM2 Process Management

```bash
# PM2 commands (as macroai user)
pm2 start ecosystem.config.js
pm2 stop macro-ai-api
pm2 restart macro-ai-api
pm2 logs macro-ai-api
pm2 monit
```

## Monitoring and Observability

### CloudWatch Metrics

- **System Metrics**: CPU, memory, disk usage, network
- **Application Metrics**: Custom metrics from the Express API
- **Log Groups**: Structured log collection and analysis

### Log Files

- **Application Logs**: `/var/log/macro-ai/combined.log`
- **Error Logs**: `/var/log/macro-ai/error.log`
- **System Logs**: `/var/log/messages`
- **User Data Logs**: `/var/log/user-data.log`

### Health Checks

- **Application Health**: `GET /api/health`
- **Service Status**: Systemd service monitoring
- **Process Monitoring**: PM2 process health
- **Resource Monitoring**: CloudWatch alarms

## Security Features

### System Security

- **Dedicated User**: Application runs as non-root `macroai` user
- **File Permissions**: Strict file and directory permissions
- **Service Hardening**: Systemd security features enabled
- **Network Security**: Security groups control access

### Application Security

- **Environment Isolation**: Separate environment files
- **Secret Management**: AWS Parameter Store for sensitive data
- **Process Isolation**: Containerized process execution
- **Log Security**: Secure log file permissions

## Troubleshooting

### Common Issues

#### Service Won't Start

```bash
# Check service status
systemctl status macro-ai.service

# Check logs
journalctl -u macro-ai.service -n 50

# Check application logs
tail -f /var/log/macro-ai/error.log
```

#### Health Check Failures

```bash
# Test health endpoint
curl -v http://localhost:3030/api/health

# Check if port is listening
netstat -tlnp | grep 3030

# Check process status
ps aux | grep node
```

#### Deployment Issues

```bash
# Check deployment logs
tail -f /var/log/user-data.log

# Verify file permissions
ls -la /opt/macro-ai/

# Check environment variables
sudo -u macroai env | grep PARAMETER_STORE_PREFIX
```

### Log Analysis

```bash
# Application errors
grep ERROR /var/log/macro-ai/combined.log

# System errors
grep ERROR /var/log/messages

# Deployment issues
grep ERROR /var/log/user-data.log
```

## CI/CD Integration

### GitHub Actions Integration

The deployment script is designed to integrate with GitHub Actions:

```yaml
- name: Deploy to EC2
  run: |
    ssh ec2-user@${{ secrets.EC2_HOST }} \
      "sudo /opt/macro-ai/deploy.sh deploy \
       --artifact-url ${{ steps.build.outputs.artifact-url }} \
       --version ${{ github.sha }} \
       --environment production"
```

### Artifact Requirements

- **Format**: tar.gz archive
- **Structure**: Must contain package.json and dist/ directory
- **Dependencies**: package-lock.json or pnpm-lock.yaml for reproducible builds

## Performance Optimization

### Resource Management

- **Memory Limits**: PM2 memory restart thresholds
- **CPU Optimization**: Single process per instance for simplicity
- **Disk Management**: Log rotation and cleanup
- **Network Optimization**: Keep-alive connections

### Scaling Considerations

- **Horizontal Scaling**: Multiple EC2 instances behind ALB
- **Auto Scaling**: Based on CPU/memory metrics
- **Load Balancing**: ALB distributes traffic across instances
- **Health Checks**: ALB health checks ensure traffic routing

## Maintenance

### Regular Tasks

- **Log Cleanup**: Automated via logrotate
- **Security Updates**: Regular system package updates
- **Dependency Updates**: Application dependency management
- **Backup Verification**: Ensure backup processes are working

### Monitoring Alerts

- **High CPU Usage**: > 80% for 5 minutes
- **High Memory Usage**: > 85% for 5 minutes
- **Disk Space**: > 90% usage
- **Service Down**: Application health check failures
- **Error Rate**: High error rate in application logs

This comprehensive deployment system ensures reliable, secure, and maintainable EC2-based hosting for the Macro AI Express API.

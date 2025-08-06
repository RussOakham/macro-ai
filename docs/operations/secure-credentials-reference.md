# Secure Credentials Reference

**⚠️ SECURITY WARNING**: This file contains references to secure credentials. Do NOT commit actual secrets to version control.

**Date**: 2025-08-04  
**Phase**: Foundation Setup Complete

---

## 🔐 AWS IAM Credentials

### Service User: `macro-ai-service`

- **User ARN**: `arn:aws:iam::[REDACTED]:user/macro-ai-service`
- **Access Key ID**: `[STORED SECURELY - NOT IN VERSION CONTROL]`
- **Secret Access Key**: `[STORED SECURELY - NOT IN VERSION CONTROL]`
- **Policies**:
  - `AmazonSSMReadOnlyAccess`
  - `AmazonCognitoReadOnly`

### Lambda Execution Role: `macro-ai-lambda-execution-role`

- **Role ARN**: `arn:aws:iam::[REDACTED]:role/macro-ai-lambda-execution-role`
- **Policies**:
  - `AWSLambdaBasicExecutionRole`
  - `MacroAIParameterStoreAccess` (custom)

---

## 📊 Service Identifiers

### AWS Cognito

- **User Pool ID**: `[REDACTED]`
- **App Client ID**: `[REDACTED]`
- **Region**: `us-east-1`

### AWS Account

- **Account ID**: `[REDACTED]`
- **Primary Region**: `us-east-1`

---

## 🗄️ External Service References

### Neon PostgreSQL

- **Project**: `macro-ai-hobby`
- **Database**: `neondb`
- **Region**: `us-east-2`
- **Connection String**: `[STORED IN PARAMETER STORE]`

### Upstash Redis

- **Database**: `macro-ai-redis`
- **Region**: Regional deployment
- **Connection URL**: `[STORED IN PARAMETER STORE]`

### OpenAI

- **API Key**: `[STORED IN PARAMETER STORE]`
- **Organization**: Personal account

---

## 📋 Parameter Store Locations

All sensitive credentials are stored in AWS Systems Manager Parameter Store:

| Parameter Name                         | Type         | Tier     | Description                |
| -------------------------------------- | ------------ | -------- | -------------------------- |
| `macro-ai-openai-key`                  | SecureString | Advanced | OpenAI API key             |
| `macro-ai-database-url`                | SecureString | Advanced | Neon PostgreSQL connection |
| `macro-ai-redis-url`                   | SecureString | Standard | Upstash Redis connection   |
| `macro-ai-cognito-user-pool-id`        | String       | Standard | Cognito User Pool ID       |
| `macro-ai-cognito-user-pool-client-id` | String       | Standard | Cognito App Client ID      |

---

## 🔧 Access Commands

### Retrieve Parameters (AWS CLI)

```bash
# Get all parameters
aws ssm get-parameters \
  --names "macro-ai-openai-key" "macro-ai-database-url" "macro-ai-redis-url" "macro-ai-cognito-user-pool-id" "macro-ai-cognito-user-pool-client-id" \
  --with-decryption \
  --query "Parameters[*].[Name,Value]" \
  --output table

# Get specific parameter
aws ssm get-parameter \
  --name "macro-ai-database-url" \
  --with-decryption \
  --query "Parameter.Value" \
  --output text
```

### Test Connectivity

```bash
# Test database connectivity
cd apps/express-api
node -e "
const { Client } = require('pg');
const { execSync } = require('child_process');

(async () => {
  try {
    // Get database URL from Parameter Store with error handling
    let url;
    try {
      url = execSync('aws ssm get-parameter --name \"macro-ai-database-url\" --with-decryption --query \"Parameter.Value\" --output text', { encoding: 'utf8' }).trim();
    } catch (error) {
      console.error('❌ Failed to retrieve database URL from Parameter Store:', error.message);
      process.exit(1);
    }

    // Configure SSL based on environment
    const sslConfig = process.env.NODE_ENV === 'production'
      ? { rejectUnauthorized: true }  // Strict SSL in production
      : { rejectUnauthorized: false }; // Relaxed SSL for development/testing

    const client = new Client({
      connectionString: url,
      ssl: sslConfig
    });

    await client.connect();
    console.log('✅ Database connected successfully');
    await client.end();
  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
    process.exit(1);
  }
})();
"

# Test Redis connectivity
node -e "
const { createClient } = require('redis');
const { execSync } = require('child_process');

(async () => {
  try {
    // Get Redis URL from Parameter Store with error handling
    let url;
    try {
      url = execSync('aws ssm get-parameter --name \"macro-ai-redis-url\" --with-decryption --query \"Parameter.Value\" --output text', { encoding: 'utf8' }).trim();
    } catch (error) {
      console.error('❌ Failed to retrieve Redis URL from Parameter Store:', error.message);
      process.exit(1);
    }

    const client = createClient({ url });

    await client.connect();
    console.log('✅ Redis connected successfully');
    await client.quit();
  } catch (error) {
    console.error('❌ Redis connection failed:', error.message);
    process.exit(1);
  }
})();
"
```

---

## 🚨 Security Best Practices

### Credential Rotation

- **AWS Access Keys**: Rotate every 90 days
- **OpenAI API Key**: Monitor usage and rotate if compromised
- **Database Passwords**: Managed by Neon (automatic rotation)
- **Redis Auth**: Managed by Upstash (automatic rotation)

### Access Control

- ✅ Least privilege IAM policies
- ✅ No hardcoded secrets in code
- ✅ Parameter Store encryption at rest
- ✅ TLS/SSL for all connections

### Monitoring

- ✅ AWS CloudTrail for API access logging
- ✅ Budget alerts for cost monitoring
- ✅ Parameter Store access logging

---

## 🔄 Backup & Recovery

### IAM Access Keys

- **Primary Storage**: AWS IAM Console
- **Backup Location**: `[SECURE OFFLINE STORAGE]`
- **Recovery Process**: Regenerate through IAM Console

### Service Configurations

- **AWS Resources**: CloudFormation templates (future)
- **External Services**: Configuration documented in Phase 1 summary
- **Parameter Store**: Automatic backup via AWS

---

## 📞 Emergency Contacts

### AWS Support

- **Plan**: Basic (free)
- **Access**: AWS Console support center

### Service Providers

- **Neon**: Community support (hobby tier)
- **Upstash**: Email support (free tier)
- **OpenAI**: API support through platform

---

**Last Updated**: 2025-08-04  
**Next Review**: Before Phase 2 deployment  
**Status**: ✅ All credentials secured and validated

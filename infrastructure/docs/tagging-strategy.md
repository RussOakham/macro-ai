# Macro AI Infrastructure Tagging Strategy

## Overview

This document outlines the comprehensive tagging strategy for Macro AI's AWS infrastructure. The strategy is designed to
enable cost tracking, environment identification, automated cleanup, security compliance, and operational monitoring.

## Key Benefits

- **Cost Allocation**: Track costs by environment, component, and PR
- **Environment Isolation**: Clear identification of persistent vs ephemeral resources
- **Automated Cleanup**: Expiry dates and auto-shutdown flags for cost optimization
- **Security Compliance**: Data classification and compliance scope tracking
- **Operational Monitoring**: Monitoring level configuration and ownership tracking
- **Resource Management**: Consistent identification and lifecycle management

## Tag Categories

### Core Identification Tags

| Tag Key           | Description              | Example Values                               | Required |
| ----------------- | ------------------------ | -------------------------------------------- | -------- |
| `Project`         | Project name             | `MacroAI`                                    | ✅       |
| `Environment`     | Environment name         | `development`, `production`, `pr-123`        | ✅       |
| `EnvironmentType` | Type of environment      | `persistent`, `ephemeral`, `preview`         | ✅       |
| `Component`       | Infrastructure component | `VPC`, `ECS`, `ALB`, `Security-Groups`       | ✅       |
| `Purpose`         | Resource purpose         | `SharedInfrastructure`, `PreviewEnvironment` | ✅       |

### Cost Management Tags

| Tag Key      | Description            | Example Values                        | Required |
| ------------ | ---------------------- | ------------------------------------- | -------- |
| `CostCenter` | Cost allocation center | `development`, `production`, `shared` | ✅       |
| `Owner`      | Resource owner         | `development-deployment`, `pr-123`    | ✅       |
| `Scale`      | Deployment scale       | `hobby`, `professional`, `enterprise` | ❌       |

### Operational Tags

| Tag Key           | Description             | Example Values                  | Required |
| ----------------- | ----------------------- | ------------------------------- | -------- |
| `ManagedBy`       | Management system       | `CDK`                           | ✅       |
| `CreatedBy`       | Creating construct      | `EcsConstruct`, `AlbConstruct`  | ✅       |
| `CreatedDate`     | Creation date           | `2024-01-15`                    | ✅       |
| `MonitoringLevel` | Monitoring detail level | `basic`, `standard`, `detailed` | ❌       |

### PR-Specific Tags (Ephemeral Resources)

| Tag Key      | Description         | Example Values        | Required |
| ------------ | ------------------- | --------------------- | -------- |
| `PRNumber`   | Pull request number | `123`, `456`          | ✅       |
| `Branch`     | Git branch name     | `feature/new-feature` | ❌       |
| `ExpiryDate` | Cleanup date        | `2024-01-22`          | ✅       |

### Automation Tags

| Tag Key          | Description          | Example Values  | Required |
| ---------------- | -------------------- | --------------- | -------- |
| `AutoShutdown`   | Enable auto-shutdown | `true`, `false` | ❌       |
| `BackupRequired` | Backup requirement   | `true`, `false` | ❌       |

### Security Tags

| Tag Key              | Description             | Example Values              | Required |
| -------------------- | ----------------------- | --------------------------- | -------- |
| `DataClassification` | Data sensitivity        | `Internal`, `Confidential`  | ❌       |
| `ComplianceScope`    | Compliance requirements | `Development`, `Production` | ❌       |

## Implementation

### Using the TaggingStrategy Utility

```typescript
import { TaggingStrategy, TAG_VALUES } from '../utils/tagging-strategy.js'

// Apply base tags to shared infrastructure
TaggingStrategy.applyBaseTags(construct, {
	environment: 'development',
	component: 'VPC',
	purpose: TAG_VALUES.PURPOSES.SHARED_INFRASTRUCTURE,
	createdBy: 'VpcConstruct',
	monitoringLevel: TAG_VALUES.MONITORING_LEVELS.BASIC,
})

// Apply PR-specific tags to ephemeral resources
TaggingStrategy.applyPrTags(construct, {
	prNumber: 123,
	component: 'ECS-Service',
	purpose: TAG_VALUES.PURPOSES.PREVIEW_ENVIRONMENT,
	createdBy: 'EcsConstruct',
	expiryDays: 7,
	autoShutdown: true,
	backupRequired: false,
	monitoringLevel: TAG_VALUES.MONITORING_LEVELS.STANDARD,
})
```

### Construct-Specific Tagging

#### VPC and Networking

- **Component**: `VPC-Networking`
- **Purpose**: `SharedInfrastructure`
- **MonitoringLevel**: `basic`
- **EnvironmentType**: `persistent`

#### Security Groups

- **Component**: `Security-Groups` (shared), `Security-Group` (PR-specific)
- **Purpose**: `SharedInfrastructure` (shared), `PreviewEnvironment` (PR-specific)
- **MonitoringLevel**: `basic`

#### Application Load Balancer

- **Component**: `ALB` (shared), `ALB-TargetGroup` (PR-specific)
- **Purpose**: `SharedInfrastructure` (shared), `PreviewEnvironment` (PR-specific)
- **MonitoringLevel**: `standard`

#### ECS Services

- **Component**: `ECS` (shared), `ECS-Service` (PR-specific)
- **Purpose**: `PreviewEnvironment`
- **MonitoringLevel**: `standard`
- **AutoShutdown**: `true` (PR instances)
- **BackupRequired**: `false` (preview environments)

## Cost Optimization Features

### Automatic Cost Center Assignment

- **Production environments**: `production` cost center
- **PR environments**: `development` cost center
- **Shared infrastructure**: `shared` cost center

### Expiry Date Calculation

- **PR resources**: 7-day default expiry
- **Automatic cleanup**: Based on `ExpiryDate` tag
- **Cost alerts**: Monitor resources approaching expiry

### Auto-Shutdown Configuration

- **ECS services**: Enabled for PR environments
- **Cost savings**: Automatic shutdown during off-hours
- **Development workflow**: Preserves resources during active development

## Monitoring and Alerting

### Monitoring Levels

- **Basic**: Essential metrics only (VPC, Security Groups)
- **Standard**: Standard monitoring (ALB, ECS)
- **Detailed**: Comprehensive monitoring (Production resources)

### Cost Tracking Queries

```bash
# Find all resources for a specific PR
aws resourcegroupstaggingapi get-resources \
  --tag-filters Key=PRNumber,Values=123

# Find expiring resources
aws resourcegroupstaggingapi get-resources \
  --tag-filters Key=ExpiryDate,Values=$(date -d '+1 day' +%Y-%m-%d)

# Cost allocation by environment
aws ce get-cost-and-usage \
  --group-by Type=DIMENSION,Key=LINKED_ACCOUNT \
  --group-by Type=TAG,Key=Environment
```

## Compliance and Security

### Data Classification

- **Internal**: Development and testing data
- **Confidential**: Production customer data
- **Public**: Documentation and open-source components

### Compliance Scope

- **Development**: Non-production environments
- **Production**: Customer-facing environments
- **Shared**: Infrastructure components

## Best Practices

### Tag Validation

- Use `TaggingStrategy.validateTags()` to ensure compliance
- Required tags must be present for all resources
- Tag values must not exceed AWS limits (256 characters)

### Consistent Naming

- Use standardized tag keys from `TAG_KEYS` constants
- Use predefined values from `TAG_VALUES` where applicable
- Follow kebab-case for multi-word values

### Automation Integration

- Tags drive automated cleanup processes
- Cost allocation reports use tag-based grouping
- Monitoring alerts filter by tag values

### Documentation

- Generate tag summaries using `TaggingStrategy.generateTagSummary()`
- Include tag information in infrastructure documentation
- Update tagging strategy as requirements evolve

## Migration Notes

### Existing Resources

- All constructs have been updated to use the new tagging strategy
- Legacy tag formats are automatically converted
- No manual intervention required for existing deployments

### Future Enhancements

- Additional automation tags as needed
- Enhanced cost allocation categories
- Integration with AWS Cost Categories
- Automated tag compliance reporting

## Support

For questions about the tagging strategy or implementation:

- Review the `TaggingStrategy` utility class
- Check construct-specific tagging implementations
- Refer to AWS tagging best practices documentation

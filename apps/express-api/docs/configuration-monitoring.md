# Configuration Loading Monitoring & Alerting

This document describes the comprehensive configuration loading monitoring and alerting system implemented to detect
configuration issues early in future deployments.

## Overview

The configuration monitoring system provides:

- **Real-time metrics** for configuration loading success/failure rates
- **Detailed error categorization** for faster troubleshooting
- **Performance monitoring** for configuration loading times
- **CloudWatch alarms** with severity-based alerting
- **Integration** with existing monitoring infrastructure
- **Early warning system** for configuration issues

## Architecture

### Components

1. **Configuration Monitoring Middleware** (`configuration-monitoring.ts`)
   - Metrics publishing to CloudWatch
   - Error categorization and analysis
   - Performance tracking

2. **Monitoring Integration** (`monitoring-construct.ts`)
   - CloudWatch alarms for configuration failures
   - Dashboard widgets for visualization
   - SNS notifications for alerts

3. **Load Config Integration** (`load-config.ts`)
   - Automatic monitoring of configuration loading stages
   - Parameter Store access monitoring
   - Schema validation monitoring

## Metrics Published

### CloudWatch Namespace: `MacroAI/Configuration`

| Metric Name                    | Description                               | Unit         | Dimensions                                     |
| ------------------------------ | ----------------------------------------- | ------------ | ---------------------------------------------- |
| `ConfigurationLoadingSuccess`  | Success rate of configuration loading     | Count (0/1)  | Environment, Stage, Application                |
| `ConfigurationLoadingDuration` | Time taken to load configuration          | Milliseconds | Environment, Stage, Application                |
| `ConfigurationLoadingErrors`   | Count of configuration errors by category | Count        | Environment, Stage, Application, ErrorCategory |
| `ParametersLoaded`             | Number of parameters successfully loaded  | Count        | Environment, Stage, Application                |
| `ParametersFailedToLoad`       | Number of parameters that failed to load  | Count        | Environment, Stage, Application                |

### Configuration Stages

- `INITIALIZATION` - Initial configuration setup
- `ENV_FILE_LOADING` - Loading .env file
- `SCHEMA_VALIDATION` - Validating configuration schema
- `PARAMETER_STORE_ACCESS` - Accessing Parameter Store
- `PARAMETER_RETRIEVAL` - Retrieving parameters from Parameter Store
- `CONFIGURATION_MERGE` - Merging configuration sources
- `VALIDATION_COMPLETE` - Final validation complete

### Error Categories

- `SCHEMA_VALIDATION` - Zod schema validation errors
- `PARAMETER_STORE` - AWS Parameter Store access errors
- `ENVIRONMENT_VARIABLES` - Environment variable issues
- `FILE_SYSTEM` - File system access errors
- `NETWORK` - Network connectivity issues
- `PERMISSIONS` - AWS permissions errors
- `UNKNOWN` - Uncategorized errors

## CloudWatch Alarms

### Critical Alarms

- **Configuration Loading Failure** (`config-loading-failure`)
  - **Threshold**: Success rate < 80%
  - **Evaluation**: 2 periods of 5 minutes
  - **Action**: Critical alert to operations team

- **Parameter Store Failure** (`parameter-store-failure`)
  - **Threshold**: > 3 Parameter Store errors in 5 minutes
  - **Evaluation**: 1 period of 5 minutes
  - **Action**: Critical alert to operations team

### Warning Alarms

- **Schema Validation Failure** (`schema-validation-failure`)
  - **Threshold**: Any schema validation failure
  - **Evaluation**: 1 period of 10 minutes
  - **Action**: Warning alert to development team

- **Slow Configuration Loading** (`slow-config-loading`)
  - **Threshold**: Average duration > 5 seconds
  - **Evaluation**: 3 periods of 5 minutes
  - **Action**: Warning alert to operations team

### Info Alarms

- **Parameter Loading Failure** (`parameter-loading-failure`)
  - **Threshold**: Any parameter loading failure
  - **Evaluation**: 1 period of 15 minutes
  - **Action**: Info alert to development team

## Dashboard Widgets

The monitoring system adds the following widgets to the CloudWatch dashboard:

1. **Configuration Loading Success Rate** - Line graph showing success rate over time
2. **Configuration Loading Duration** - Line graph showing average and max duration
3. **Configuration Errors by Category** - Line graph showing errors by category
4. **Parameter Loading Statistics** - Line graph showing loaded vs failed parameters
5. **Current Configuration Health** - Single value widget showing current health status
6. **Latest Config Load Time** - Single value widget showing latest load duration

## Usage

### Automatic Monitoring

Configuration monitoring is automatically enabled when loading configuration:

```typescript
// Automatically monitored in load-config.ts
const [config, error] = await loadRuntimeConfig()
```

### Manual Monitoring

You can also manually monitor configuration operations:

```typescript
import {
	monitorConfigurationLoading,
	ConfigurationStage,
} from '../middleware/configuration-monitoring.js'

const result = await monitorConfigurationLoading(
	ConfigurationStage.PARAMETER_RETRIEVAL,
	async () => {
		// Your configuration loading operation
		return await loadParameters()
	},
	{
		appEnv: 'production',
		parameterStorePrefix: '/macro-ai/production',
	},
)
```

### Publishing Custom Metrics

```typescript
import {
	publishParameterLoadingStats,
	publishConfigurationHealthMetric,
} from '../middleware/configuration-monitoring.js'

// Publish parameter loading statistics
await publishParameterLoadingStats(15, 2, 'production')

// Publish configuration health metric
await publishConfigurationHealthMetric(true, 1500, 'production')
```

## Alert Response Procedures

### Critical Alerts

**Configuration Loading Failure**

1. Check CloudWatch logs for detailed error messages
2. Verify Parameter Store parameters exist and are accessible
3. Check AWS credentials and permissions
4. Validate APP_ENV and parameter prefix configuration
5. Review recent deployments for configuration changes

**Parameter Store Failure**

1. Check AWS service health dashboard
2. Verify Parameter Store service availability in region
3. Check IAM permissions for Parameter Store access
4. Validate parameter paths and naming conventions
5. Check for rate limiting or throttling

### Warning Alerts

**Schema Validation Failure**

1. Review configuration schema changes
2. Check for missing or invalid environment variables
3. Validate APP_ENV pattern matching
4. Review recent code changes affecting configuration

**Slow Configuration Loading**

1. Check Parameter Store response times
2. Review number of parameters being loaded
3. Check network connectivity to AWS services
4. Consider implementing parameter caching optimizations

## Troubleshooting

### Common Issues

1. **High Error Rate**
   - Check Parameter Store parameter existence
   - Verify AWS credentials and permissions
   - Validate APP_ENV and parameter prefix mapping

2. **Slow Loading Times**
   - Review number of parameters being loaded
   - Check Parameter Store service limits
   - Consider implementing parameter batching

3. **Schema Validation Failures**
   - Review Zod schema definitions
   - Check for missing required parameters
   - Validate APP_ENV pattern matching

### Debugging

Enable debug logging for detailed configuration monitoring:

```bash
NODE_ENV=development npm start
```

Check CloudWatch logs for detailed error information:

- Log Group: `/aws/ec2/macro-ai-express-api`
- Filter: `operation: "configurationLoadingFailure"`

## Deployment Considerations

### Environment Variables

Ensure these environment variables are set:

- `AWS_REGION` - AWS region for CloudWatch metrics
- `APP_ENV` - Application environment for metric dimensions
- `PARAMETER_STORE_PREFIX` - Parameter Store prefix for context

### IAM Permissions

The application requires these CloudWatch permissions:

```json
{
	"Version": "2012-10-17",
	"Statement": [
		{
			"Effect": "Allow",
			"Action": ["cloudwatch:PutMetricData"],
			"Resource": "*"
		}
	]
}
```

### Testing

Run the configuration monitoring tests:

```bash
npm test -- configuration-monitoring.test.ts
```

## Future Enhancements

1. **Predictive Alerting** - Use machine learning to predict configuration failures
2. **Auto-Recovery** - Implement automatic retry mechanisms for transient failures
3. **Configuration Drift Detection** - Monitor for unexpected configuration changes
4. **Performance Optimization** - Implement intelligent parameter caching strategies
5. **Cross-Environment Monitoring** - Compare configuration health across environments

## Related Documentation

- [Parameter Store Management Guide](parameter-store-management.md)
- [Monitoring Infrastructure](../infrastructure/monitoring.md)
- [Deployment Procedures](deployment-procedures.md)
- [Troubleshooting Guide](troubleshooting.md)

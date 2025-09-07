import { Construct } from 'constructs';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import * as cloudwatch_actions from 'aws-cdk-lib/aws-cloudwatch-actions';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as elbv2 from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import { Duration } from 'aws-cdk-lib';

export interface CloudWatchMonitoringProps {
  environment: string;
  service: ecs.FargateService;
  loadBalancer?: elbv2.ApplicationLoadBalancer;
  clusterName: string;
  serviceName: string;
  alarmTopic?: sns.ITopic;
  enableDetailedMonitoring?: boolean;
  enableCostMonitoring?: boolean;
}

export class CloudWatchMonitoringConstruct extends Construct {
  public readonly alarms: cloudwatch.Alarm[];
  public readonly dashboard: cloudwatch.Dashboard;
  public readonly alarmTopic: sns.ITopic;

  constructor(scope: Construct, id: string, props: CloudWatchMonitoringProps) {
    super(scope, id);

    this.alarms = [];

    // Create SNS topic for alarms if not provided
    this.alarmTopic = props.alarmTopic || new sns.Topic(this, 'AlarmTopic', {
      displayName: `${props.environment} Monitoring Alarms`,
      topicName: `${props.environment.toLowerCase()}-monitoring-alarms`,
    });

    // ECS Service Monitoring
    this.createEcsServiceMonitoring(props);

    // Application Load Balancer Monitoring
    if (props.loadBalancer) {
      this.createLoadBalancerMonitoring(props);
    }

    // Cost Monitoring (if enabled)
    if (props.enableCostMonitoring) {
      this.createCostMonitoring(props);
    }

    // Create CloudWatch Dashboard
    this.dashboard = this.createMonitoringDashboard(props);
  }

  private createEcsServiceMonitoring(props: CloudWatchMonitoringProps): void {
    const { environment, service, clusterName, serviceName } = props;

    // CPU Utilization Alarm
    const cpuAlarm = new cloudwatch.Alarm(this, 'CpuUtilizationAlarm', {
      alarmName: `${environment}-ecs-cpu-high`,
      alarmDescription: `High CPU utilization on ${environment} ECS service`,
      metric: new cloudwatch.Metric({
        namespace: 'AWS/ECS',
        metricName: 'CPUUtilization',
        dimensionsMap: {
          ClusterName: clusterName,
          ServiceName: serviceName,
        },
        statistic: 'Average',
        period: Duration.minutes(5),
      }),
      threshold: 80,
      evaluationPeriods: 3,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });
    cpuAlarm.addAlarmAction(new cloudwatch_actions.SnsAction(this.alarmTopic));
    this.alarms.push(cpuAlarm);

    // Memory Utilization Alarm
    const memoryAlarm = new cloudwatch.Alarm(this, 'MemoryUtilizationAlarm', {
      alarmName: `${environment}-ecs-memory-high`,
      alarmDescription: `High memory utilization on ${environment} ECS service`,
      metric: new cloudwatch.Metric({
        namespace: 'AWS/ECS',
        metricName: 'MemoryUtilization',
        dimensionsMap: {
          ClusterName: clusterName,
          ServiceName: serviceName,
        },
        statistic: 'Average',
        period: Duration.minutes(5),
      }),
      threshold: 85,
      evaluationPeriods: 3,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });
    memoryAlarm.addAlarmAction(new cloudwatch_actions.SnsAction(this.alarmTopic));
    this.alarms.push(memoryAlarm);

    // Running Task Count Alarm
    const taskCountAlarm = new cloudwatch.Alarm(this, 'RunningTaskCountAlarm', {
      alarmName: `${environment}-ecs-running-tasks-low`,
      alarmDescription: `Low running task count on ${environment} ECS service`,
      metric: new cloudwatch.Metric({
        namespace: 'AWS/ECS',
        metricName: 'RunningTaskCount',
        dimensionsMap: {
          ClusterName: clusterName,
          ServiceName: serviceName,
        },
        statistic: 'Average',
        period: Duration.minutes(5),
      }),
      threshold: 1,
      evaluationPeriods: 2,
      comparisonOperator: cloudwatch.ComparisonOperator.LESS_THAN_THRESHOLD,
      treatMissingData: cloudwatch.TreatMissingData.BREACHING,
    });
    taskCountAlarm.addAlarmAction(new cloudwatch_actions.SnsAction(this.alarmTopic));
    this.alarms.push(taskCountAlarm);

    // HTTP 5xx Error Rate Alarm (Application metrics)
    if (props.enableDetailedMonitoring) {
      try {
        const http5xxAlarm = new cloudwatch.Alarm(this, 'Http5xxErrorAlarm', {
          alarmName: `${environment}-http-5xx-high`,
          alarmDescription: `High HTTP 5xx error rate on ${environment} service`,
          metric: new cloudwatch.Metric({
            namespace: 'AWS/ApplicationELB',
            metricName: 'HTTPCode_Target_5XX_Count',
            dimensionsMap: {
              LoadBalancer: props.loadBalancer?.loadBalancerFullName || '',
            },
            statistic: 'Sum',
            period: Duration.minutes(5),
          }),
          threshold: 10,
          evaluationPeriods: 2,
          comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
          treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
        });
        http5xxAlarm.addAlarmAction(new cloudwatch_actions.SnsAction(this.alarmTopic));
        this.alarms.push(http5xxAlarm);
      } catch (error) {
        console.warn('Failed to create HTTP 5xx alarm:', error);
      }
    }
  }

  private createLoadBalancerMonitoring(props: CloudWatchMonitoringProps): void {
    if (!props.loadBalancer) return;

    const { environment, loadBalancer } = props;

    // ALB Healthy Host Count Alarm
    const healthyHostAlarm = new cloudwatch.Alarm(this, 'HealthyHostCountAlarm', {
      alarmName: `${environment}-alb-healthy-hosts-low`,
      alarmDescription: `Low healthy host count on ${environment} ALB`,
      metric: new cloudwatch.Metric({
        namespace: 'AWS/ApplicationELB',
        metricName: 'HealthyHostCount',
        dimensionsMap: {
          LoadBalancer: loadBalancer.loadBalancerFullName,
        },
        statistic: 'Average',
        period: Duration.minutes(5),
      }),
      threshold: 1,
      evaluationPeriods: 2,
      comparisonOperator: cloudwatch.ComparisonOperator.LESS_THAN_THRESHOLD,
      treatMissingData: cloudwatch.TreatMissingData.BREACHING,
    });
    healthyHostAlarm.addAlarmAction(new cloudwatch_actions.SnsAction(this.alarmTopic));
    this.alarms.push(healthyHostAlarm);

    // ALB Request Count (for traffic monitoring)
    const requestCountAlarm = new cloudwatch.Alarm(this, 'RequestCountLowAlarm', {
      alarmName: `${environment}-alb-request-count-low`,
      alarmDescription: `Very low request count on ${environment} ALB (possible service down)`,
      metric: new cloudwatch.Metric({
        namespace: 'AWS/ApplicationELB',
        metricName: 'RequestCount',
        dimensionsMap: {
          LoadBalancer: loadBalancer.loadBalancerFullName,
        },
        statistic: 'Sum',
        period: Duration.minutes(15),
      }),
      threshold: 1,
      evaluationPeriods: 2,
      comparisonOperator: cloudwatch.ComparisonOperator.LESS_THAN_THRESHOLD,
      treatMissingData: cloudwatch.TreatMissingData.BREACHING,
    });
    requestCountAlarm.addAlarmAction(new cloudwatch_actions.SnsAction(this.alarmTopic));
    this.alarms.push(requestCountAlarm);
  }

  private createCostMonitoring(props: CloudWatchMonitoringProps): void {
    const { environment } = props;

    // Note: Cost monitoring would typically be done via AWS Budgets API
    // This is a simplified version that could be expanded

    // Estimated monthly cost alarm (placeholder for actual cost monitoring)
    const estimatedCostAlarm = new cloudwatch.Alarm(this, 'EstimatedMonthlyCostAlarm', {
      alarmName: `${environment}-estimated-monthly-cost-high`,
      alarmDescription: `Estimated monthly cost is approaching budget limit for ${environment}`,
      metric: new cloudwatch.Metric({
        namespace: 'AWS/Budgets',
        metricName: 'EstimatedMonthlyCost',
        dimensionsMap: {
          BudgetName: `${environment}-budget`,
        },
        statistic: 'Maximum',
        period: Duration.hours(6),
      }),
      threshold: 80, // 80% of budget
      evaluationPeriods: 1,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });
    estimatedCostAlarm.addAlarmAction(new cloudwatch_actions.SnsAction(this.alarmTopic));
    this.alarms.push(estimatedCostAlarm);
  }

  private createMonitoringDashboard(props: CloudWatchMonitoringProps): cloudwatch.Dashboard {
    const { environment, clusterName, serviceName, loadBalancer } = props;

    const dashboard = new cloudwatch.Dashboard(this, 'MonitoringDashboard', {
      dashboardName: `${environment}-monitoring-dashboard`,
    });

    // ECS Service Metrics
    const ecsWidget = new cloudwatch.GraphWidget({
      title: 'ECS Service Metrics',
      left: [
        new cloudwatch.Metric({
          namespace: 'AWS/ECS',
          metricName: 'CPUUtilization',
          dimensionsMap: { ClusterName: clusterName, ServiceName: serviceName },
          statistic: 'Average',
        }),
        new cloudwatch.Metric({
          namespace: 'AWS/ECS',
          metricName: 'MemoryUtilization',
          dimensionsMap: { ClusterName: clusterName, ServiceName: serviceName },
          statistic: 'Average',
        }),
      ],
      width: 12,
      height: 6,
    });

    // Running Tasks
    const taskWidget = new cloudwatch.GraphWidget({
      title: 'Running Tasks',
      left: [
        new cloudwatch.Metric({
          namespace: 'AWS/ECS',
          metricName: 'RunningTaskCount',
          dimensionsMap: { ClusterName: clusterName, ServiceName: serviceName },
          statistic: 'Average',
        }),
        new cloudwatch.Metric({
          namespace: 'AWS/ECS',
          metricName: 'DesiredTaskCount',
          dimensionsMap: { ClusterName: clusterName, ServiceName: serviceName },
          statistic: 'Average',
        }),
      ],
      width: 12,
      height: 6,
    });

    // Load Balancer Metrics (if available)
    let albWidget: cloudwatch.GraphWidget | undefined;
    if (loadBalancer) {
      albWidget = new cloudwatch.GraphWidget({
        title: 'Application Load Balancer Metrics',
        left: [
          new cloudwatch.Metric({
            namespace: 'AWS/ApplicationELB',
            metricName: 'RequestCount',
            dimensionsMap: { LoadBalancer: loadBalancer.loadBalancerFullName },
            statistic: 'Sum',
          }),
          new cloudwatch.Metric({
            namespace: 'AWS/ApplicationELB',
            metricName: 'TargetResponseTime',
            dimensionsMap: { LoadBalancer: loadBalancer.loadBalancerFullName },
            statistic: 'Average',
          }),
        ],
        right: [
          new cloudwatch.Metric({
            namespace: 'AWS/ApplicationELB',
            metricName: 'HTTPCode_Target_2XX_Count',
            dimensionsMap: { LoadBalancer: loadBalancer.loadBalancerFullName },
            statistic: 'Sum',
          }),
          new cloudwatch.Metric({
            namespace: 'AWS/ApplicationELB',
            metricName: 'HTTPCode_Target_5XX_Count',
            dimensionsMap: { LoadBalancer: loadBalancer.loadBalancerFullName },
            statistic: 'Sum',
          }),
        ],
        width: 24,
        height: 8,
      });
    }

    // Add widgets to dashboard
    dashboard.addWidgets(ecsWidget, taskWidget);
    if (albWidget) {
      dashboard.addWidgets(albWidget);
    }

    // Add alarm status widget
    const alarmWidget = new cloudwatch.AlarmStatusWidget({
      title: 'Alarm Status',
      alarms: this.alarms,
      width: 24,
      height: 4,
    });
    dashboard.addWidgets(alarmWidget);

    return dashboard;
  }
}

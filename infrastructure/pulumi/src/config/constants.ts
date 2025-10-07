// Application constants
export const APP_CONFIG = {
	name: 'macro-ai',
	port: 3040,
	healthEndpoint: '/api/health',
} as const

// AWS resource limits and defaults
export const AWS_LIMITS = {
	albListenerRulesPerAlb: 100,
	ecsTasksPerService: 10,
	// eslint-disable-next-line sonarjs/no-hardcoded-ip
	vpcCidrBlock: '10.0.0.0/16',
	// eslint-disable-next-line sonarjs/no-hardcoded-ip
	publicSubnets: ['10.0.1.0/24', '10.0.2.0/24'],
	// eslint-disable-next-line sonarjs/no-hardcoded-ip
	privateSubnets: ['10.0.3.0/24', '10.0.4.0/24'],
} as const

// Cost optimization settings
export const COST_OPTIMIZATION = {
	logRetentionDays: {
		preview: 7,
		permanent: 30,
	},
	ecsCpu: '256',
	ecsMemory: '512',
	enableNatGateways: false, // Cost optimization for dev/preview
} as const

// Environment configurations
export const ENVIRONMENT_CONFIGS = {
	dev: {
		dopplerConfig: 'dev',
		enableDeletionProtection: false,
	},
	staging: {
		dopplerConfig: 'stg',
		enableDeletionProtection: false,
	},
	production: {
		dopplerConfig: 'prd',
		enableDeletionProtection: true,
	},
} as const

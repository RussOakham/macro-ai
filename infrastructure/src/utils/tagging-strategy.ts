import * as cdk from 'aws-cdk-lib'
import { Construct } from 'constructs'

/**
 * Standardized tag keys for consistent resource management
 */
export const TAG_KEYS = {
	// Core identification tags
	PROJECT: 'Project',
	ENVIRONMENT: 'Environment',
	ENVIRONMENT_TYPE: 'EnvironmentType',
	COMPONENT: 'Component',
	PURPOSE: 'Purpose',

	// Cost management tags
	COST_CENTER: 'CostCenter',
	OWNER: 'Owner',
	SCALE: 'Scale',

	// Operational tags
	MANAGED_BY: 'ManagedBy',
	CREATED_BY: 'CreatedBy',
	CREATED_DATE: 'CreatedDate',

	// PR-specific tags
	PR_NUMBER: 'PRNumber',
	BRANCH: 'Branch',
	EXPIRY_DATE: 'ExpiryDate',

	// Automation tags
	AUTO_SHUTDOWN: 'AutoShutdown',
	BACKUP_REQUIRED: 'BackupRequired',
	MONITORING_LEVEL: 'MonitoringLevel',

	// Priority 3: Auto-cleanup tags for cost optimization
	AUTO_CLEANUP: 'AutoCleanup',
	CLEANUP_DATE: 'CleanupDate',

	// Security tags
	DATA_CLASSIFICATION: 'DataClassification',
	COMPLIANCE_SCOPE: 'ComplianceScope',
} as const

/**
 * Standardized tag values for consistent categorization
 */
export const TAG_VALUES = {
	PROJECT: 'MacroAI',
	MANAGED_BY: 'CDK',
	DATA_CLASSIFICATION: 'Internal',
	COMPLIANCE_SCOPE: 'Development',

	ENVIRONMENT_TYPES: {
		PERSISTENT: 'persistent',
		EPHEMERAL: 'ephemeral',
		PREVIEW: 'preview',
	},

	PURPOSES: {
		SHARED_INFRASTRUCTURE: 'SharedInfrastructure',
		PREVIEW_ENVIRONMENT: 'PreviewEnvironment',
		COST_OPTIMIZATION: 'CostOptimization',
		MONITORING: 'Monitoring',
		SECURITY: 'Security',
	},

	COST_CENTERS: {
		DEVELOPMENT: 'development',
		PRODUCTION: 'production',
		SHARED: 'shared',
	},

	SCALES: {
		HOBBY: 'hobby',
		PROFESSIONAL: 'professional',
		ENTERPRISE: 'enterprise',
	},

	MONITORING_LEVELS: {
		BASIC: 'basic',
		STANDARD: 'standard',
		DETAILED: 'detailed',
	},
} as const

/**
 * Base tag configuration for all resources
 */
export interface BaseTagConfig {
	readonly project?: string
	readonly environment: string
	readonly environmentType?: string
	readonly component: string
	readonly purpose: string
	readonly costCenter?: string
	readonly owner?: string
	readonly scale?: string
	readonly managedBy?: string
	readonly createdBy: string
	readonly monitoringLevel?: string
	readonly dataClassification?: string
	readonly complianceScope?: string
}

/**
 * PR-specific tag configuration for ephemeral resources
 */
export interface PrTagConfig extends Omit<BaseTagConfig, 'environment'> {
	readonly prNumber: number
	readonly branch?: string
	readonly expiryDays?: number
	readonly autoShutdown?: boolean
	readonly backupRequired?: boolean
}

/**
 * Comprehensive tagging strategy utility for Macro AI infrastructure
 *
 * This utility provides standardized tagging for:
 * - Cost tracking and allocation
 * - Environment identification and isolation
 * - Automated cleanup and lifecycle management
 * - Security and compliance requirements
 * - Operational monitoring and alerting
 *
 * Key Features:
 * - Consistent tag keys and values across all resources
 * - PR-specific tagging for ephemeral environments
 * - Automatic expiry date calculation
 * - Cost center allocation based on environment
 * - Monitoring level configuration
 * - Security classification tags
 */
// eslint-disable-next-line @typescript-eslint/no-extraneous-class
export class TaggingStrategy {
	/**
	 * Create base tags for shared infrastructure resources
	 */
	public static createBaseTags(config: BaseTagConfig): Record<string, string> {
		const currentDate =
			new Date().toISOString().split('T')[0] ??
			new Date().toISOString().substring(0, 10)

		return {
			[TAG_KEYS.PROJECT]: config.project ?? TAG_VALUES.PROJECT,
			[TAG_KEYS.ENVIRONMENT]: config.environment,
			[TAG_KEYS.ENVIRONMENT_TYPE]:
				config.environmentType ?? TAG_VALUES.ENVIRONMENT_TYPES.PERSISTENT,
			[TAG_KEYS.COMPONENT]: config.component,
			[TAG_KEYS.PURPOSE]: config.purpose,
			[TAG_KEYS.COST_CENTER]:
				config.costCenter ?? this.determineCostCenter(config.environment),
			[TAG_KEYS.OWNER]: config.owner ?? `${config.environment}-deployment`,
			[TAG_KEYS.SCALE]: config.scale ?? TAG_VALUES.SCALES.HOBBY,
			[TAG_KEYS.MANAGED_BY]: config.managedBy ?? TAG_VALUES.MANAGED_BY,
			[TAG_KEYS.CREATED_BY]: config.createdBy,
			[TAG_KEYS.CREATED_DATE]: currentDate,
			[TAG_KEYS.MONITORING_LEVEL]:
				config.monitoringLevel ?? TAG_VALUES.MONITORING_LEVELS.BASIC,
			[TAG_KEYS.DATA_CLASSIFICATION]:
				config.dataClassification ?? TAG_VALUES.DATA_CLASSIFICATION,
			[TAG_KEYS.COMPLIANCE_SCOPE]:
				config.complianceScope ?? TAG_VALUES.COMPLIANCE_SCOPE,
		}
	}

	/**
	 * Create PR-specific tags for ephemeral preview environments
	 */
	public static createPrTags(config: PrTagConfig): Record<string, string> {
		const baseTags = this.createBaseTags({
			...config,
			environment: `pr-${config.prNumber.toString()}`,
			environmentType: TAG_VALUES.ENVIRONMENT_TYPES.EPHEMERAL,
			purpose: TAG_VALUES.PURPOSES.PREVIEW_ENVIRONMENT,
		})

		const prSpecificTags: Record<string, string> = {
			...baseTags,
			[TAG_KEYS.PR_NUMBER]: config.prNumber.toString(),
			[TAG_KEYS.EXPIRY_DATE]: this.calculateExpiryDate(config.expiryDays ?? 7),
		}

		// Add optional PR-specific tags
		if (config.branch) {
			prSpecificTags[TAG_KEYS.BRANCH] = config.branch
		}

		if (config.autoShutdown !== undefined) {
			prSpecificTags[TAG_KEYS.AUTO_SHUTDOWN] = config.autoShutdown.toString()
		}

		if (config.backupRequired !== undefined) {
			prSpecificTags[TAG_KEYS.BACKUP_REQUIRED] =
				config.backupRequired.toString()
		}

		return prSpecificTags
	}

	/**
	 * Apply tags to a CDK construct and all its child resources
	 */
	public static applyTags(
		construct: Construct,
		tags: Record<string, string>,
	): void {
		Object.entries(tags).forEach(([key, value]) => {
			cdk.Tags.of(construct).add(key, value)
		})
	}

	/**
	 * Apply base tags to a construct
	 */
	public static applyBaseTags(
		construct: Construct,
		config: BaseTagConfig,
	): void {
		const tags = this.createBaseTags(config)
		this.applyTags(construct, tags)
	}

	/**
	 * Apply PR-specific tags to a construct
	 */
	public static applyPrTags(construct: Construct, config: PrTagConfig): void {
		const tags = this.createPrTags(config)
		this.applyTags(construct, tags)
	}

	/**
	 * Create cost allocation tags for billing and reporting
	 */
	public static createCostAllocationTags(
		environment: string,
		component: string,
		prNumber?: number,
	): Record<string, string> {
		const costCenter = this.determineCostCenter(environment)
		const owner = prNumber
			? `pr-${prNumber.toString()}`
			: `${environment}-deployment`

		return {
			[TAG_KEYS.COST_CENTER]: costCenter,
			[TAG_KEYS.OWNER]: owner,
			[TAG_KEYS.ENVIRONMENT]: environment,
			[TAG_KEYS.COMPONENT]: component,
			[TAG_KEYS.PROJECT]: TAG_VALUES.PROJECT,
		}
	}

	/**
	 * Create automation tags for lifecycle management
	 */
	public static createAutomationTags(
		autoShutdown = false,
		backupRequired = false,
		monitoringLevel: string = TAG_VALUES.MONITORING_LEVELS.BASIC,
	): Record<string, string> {
		return {
			[TAG_KEYS.AUTO_SHUTDOWN]: autoShutdown.toString(),
			[TAG_KEYS.BACKUP_REQUIRED]: backupRequired.toString(),
			[TAG_KEYS.MONITORING_LEVEL]: monitoringLevel,
		}
	}

	/**
	 * Priority 3: Create auto-cleanup tags for preview environments
	 * Helps prevent orphaned resources and reduces costs
	 */
	public static createAutoCleanupTags(
		cleanupDays = 7,
		environment?: string,
	): Record<string, string> {
		const isPreviewEnv = Boolean(
			environment &&
				(environment.startsWith('pr-') || environment.includes('preview')),
		)

		return {
			[TAG_KEYS.AUTO_CLEANUP]: isPreviewEnv ? 'true' : 'false',
			[TAG_KEYS.CLEANUP_DATE]: this.calculateExpiryDate(cleanupDays),
			[TAG_KEYS.COST_CENTER]: TAG_VALUES.COST_CENTERS.DEVELOPMENT,
		}
	}

	/**
	 * Calculate expiry date for resource cleanup
	 */
	private static calculateExpiryDate(days: number): string {
		const expiry = new Date()
		expiry.setDate(expiry.getDate() + days)
		const datePart = expiry.toISOString().split('T')[0]
		return datePart ?? expiry.toISOString().substring(0, 10) // YYYY-MM-DD format
	}

	/**
	 * Determine cost center based on environment
	 */
	private static determineCostCenter(environment: string): string {
		if (environment === 'production') {
			return TAG_VALUES.COST_CENTERS.PRODUCTION
		}
		if (environment.startsWith('pr-')) {
			return TAG_VALUES.COST_CENTERS.DEVELOPMENT
		}
		return TAG_VALUES.COST_CENTERS.DEVELOPMENT
	}

	/**
	 * Validate tag configuration for compliance
	 */
	public static validateTags(tags: Record<string, string>): {
		valid: boolean
		errors: string[]
	} {
		const errors: string[] = []
		const requiredTags = [
			TAG_KEYS.PROJECT,
			TAG_KEYS.ENVIRONMENT,
			TAG_KEYS.COMPONENT,
			TAG_KEYS.COST_CENTER,
			TAG_KEYS.CREATED_BY,
		]

		// Check required tags
		requiredTags.forEach((tag) => {
			if (!tags[tag]) {
				errors.push(`Missing required tag: ${tag}`)
			}
		})

		// Validate tag value lengths (AWS limit is 256 characters)
		Object.entries(tags).forEach(([key, value]) => {
			if (key.length > 128) {
				errors.push(`Tag key too long: ${key} (max 128 characters)`)
			}
			if (value.length > 256) {
				errors.push(
					`Tag value too long for ${key}: ${value} (max 256 characters)`,
				)
			}
		})

		return {
			valid: errors.length === 0,
			errors,
		}
	}

	/**
	 * Generate tag summary for documentation and reporting
	 */
	public static generateTagSummary(tags: Record<string, string>): string {
		const sections = [
			'# Resource Tag Summary',
			'',
			'## Core Identification',
			`- Project: ${tags[TAG_KEYS.PROJECT] ?? 'N/A'}`,
			`- Environment: ${tags[TAG_KEYS.ENVIRONMENT] ?? 'N/A'}`,
			`- Component: ${tags[TAG_KEYS.COMPONENT] ?? 'N/A'}`,
			`- Purpose: ${tags[TAG_KEYS.PURPOSE] ?? 'N/A'}`,
			'',
			'## Cost Management',
			`- Cost Center: ${tags[TAG_KEYS.COST_CENTER] ?? 'N/A'}`,
			`- Owner: ${tags[TAG_KEYS.OWNER] ?? 'N/A'}`,
			`- Scale: ${tags[TAG_KEYS.SCALE] ?? 'N/A'}`,
			'',
			'## Operational',
			`- Managed By: ${tags[TAG_KEYS.MANAGED_BY] ?? 'N/A'}`,
			`- Created By: ${tags[TAG_KEYS.CREATED_BY] ?? 'N/A'}`,
			`- Created Date: ${tags[TAG_KEYS.CREATED_DATE] ?? 'N/A'}`,
			`- Monitoring Level: ${tags[TAG_KEYS.MONITORING_LEVEL] ?? 'N/A'}`,
		]

		// Add PR-specific information if present
		if (tags[TAG_KEYS.PR_NUMBER]) {
			sections.push(
				'',
				'## PR Environment',
				`- PR Number: ${tags[TAG_KEYS.PR_NUMBER] ?? 'N/A'}`,
				`- Branch: ${tags[TAG_KEYS.BRANCH] ?? 'N/A'}`,
				`- Expiry Date: ${tags[TAG_KEYS.EXPIRY_DATE] ?? 'N/A'}`,
				`- Auto Shutdown: ${tags[TAG_KEYS.AUTO_SHUTDOWN] ?? 'N/A'}`,
			)
		}

		return sections.join('\n')
	}
}

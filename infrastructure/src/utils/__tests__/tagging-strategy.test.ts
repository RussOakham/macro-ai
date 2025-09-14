import { describe, expect, it } from 'vitest'

import { TAG_KEYS } from '../tagging-strategy.js'
import { TaggingStrategy } from '../tagging-strategy.js'

describe('TaggingStrategy.validateTags', () => {
	it('should return valid=true for tags with all required fields', () => {
		const validTags = {
			[TAG_KEYS.PROJECT]: 'TestProject',
			[TAG_KEYS.ENVIRONMENT]: 'test-env',
			[TAG_KEYS.COMPONENT]: 'test-component',
			[TAG_KEYS.COST_CENTER]: 'development',
			[TAG_KEYS.CREATED_BY]: 'test-user',
			[TAG_KEYS.OWNER]: 'test-owner',
			[TAG_KEYS.PURPOSE]: 'TestPurpose',
		}

		const result = TaggingStrategy.validateTags(validTags)

		expect(result.valid).toBe(true)
		expect(result.errors).toHaveLength(0)
	})

	it('should return validation errors for missing required tags', () => {
		const invalidTags = {
			[TAG_KEYS.PROJECT]: 'TestProject',
			// Missing ENVIRONMENT
			[TAG_KEYS.COMPONENT]: 'test-component',
			[TAG_KEYS.COST_CENTER]: 'development',
			[TAG_KEYS.CREATED_BY]: 'test-user',
		}

		const result = TaggingStrategy.validateTags(invalidTags)

		expect(result.valid).toBe(false)
		expect(result.errors).toContain('Missing required tag: Environment')
		expect(result.errors).toHaveLength(1)
	})

	it('should return validation errors for multiple missing required tags', () => {
		const invalidTags = {
			[TAG_KEYS.PROJECT]: 'TestProject',
			// Missing ENVIRONMENT, COMPONENT, COST_CENTER, CREATED_BY
		}

		const result = TaggingStrategy.validateTags(invalidTags)

		expect(result.valid).toBe(false)
		expect(result.errors).toHaveLength(4)
		expect(result.errors).toContain('Missing required tag: Environment')
		expect(result.errors).toContain('Missing required tag: Component')
		expect(result.errors).toContain('Missing required tag: CostCenter')
		expect(result.errors).toContain('Missing required tag: CreatedBy')
	})

	it('should return validation errors for tag key too long', () => {
		const longKey = 'A'.repeat(129) // AWS limit is 128 characters
		const invalidTags = {
			[TAG_KEYS.PROJECT]: 'TestProject',
			[TAG_KEYS.ENVIRONMENT]: 'test-env',
			[TAG_KEYS.COMPONENT]: 'test-component',
			[TAG_KEYS.COST_CENTER]: 'development',
			[TAG_KEYS.CREATED_BY]: 'test-user',
			[longKey]: 'test-value',
		}

		const result = TaggingStrategy.validateTags(invalidTags)

		expect(result.valid).toBe(false)
		expect(result.errors).toContain(
			`Tag key too long: ${longKey} (max 128 characters)`,
		)
	})

	it('should return validation errors for tag value too long', () => {
		const longValue = 'A'.repeat(257) // AWS limit is 256 characters
		const invalidTags = {
			[TAG_KEYS.PROJECT]: 'TestProject',
			[TAG_KEYS.ENVIRONMENT]: 'test-env',
			[TAG_KEYS.COMPONENT]: 'test-component',
			[TAG_KEYS.COST_CENTER]: 'development',
			[TAG_KEYS.CREATED_BY]: 'test-user',
			[TAG_KEYS.OWNER]: longValue,
		}

		const result = TaggingStrategy.validateTags(invalidTags)

		expect(result.valid).toBe(false)
		expect(result.errors).toContain(
			`Tag value too long for Owner: ${longValue} (max 256 characters)`,
		)
	})

	it('should handle empty tags object', () => {
		const result = TaggingStrategy.validateTags({})

		expect(result.valid).toBe(false)
		expect(result.errors).toHaveLength(5) // All required tags are missing
		expect(result.errors).toContain('Missing required tag: Project')
		expect(result.errors).toContain('Missing required tag: Environment')
		expect(result.errors).toContain('Missing required tag: Component')
		expect(result.errors).toContain('Missing required tag: CostCenter')
		expect(result.errors).toContain('Missing required tag: CreatedBy')
	})

	it('should validate tag lengths correctly at boundaries', () => {
		const maxKeyLength = 'A'.repeat(128) // Exactly at AWS limit
		const maxValueLength = 'A'.repeat(256) // Exactly at AWS limit
		const validTags = {
			[TAG_KEYS.PROJECT]: 'TestProject',
			[TAG_KEYS.ENVIRONMENT]: 'test-env',
			[TAG_KEYS.COMPONENT]: 'test-component',
			[TAG_KEYS.COST_CENTER]: 'development',
			[TAG_KEYS.CREATED_BY]: 'test-user',
			[maxKeyLength]: maxValueLength,
		}

		const result = TaggingStrategy.validateTags(validTags)

		expect(result.valid).toBe(true)
		expect(result.errors).toHaveLength(0)
	})
})

#!/usr/bin/env tsx

import { readFileSync, writeFileSync } from 'fs'
import yaml from 'yaml'

interface PackageJson {
	[key: string]: any
	dependencies?: Record<string, string>
	devDependencies?: Record<string, string>
	peerDependencies?: Record<string, string>
	optionalDependencies?: Record<string, string>
}

interface WorkspaceConfig {
	catalog?: Record<string, string>
	catalogs?: Record<string, Record<string, string>>
}

/**
 * Resolves pnpm workspace catalog references in package.json
 */
class CatalogResolver {
	private catalogs: Map<string, Record<string, string>> = new Map()

	constructor(workspaceConfigPath: string) {
		this.loadCatalogs(workspaceConfigPath)
	}

	private loadCatalogs(workspaceConfigPath: string): void {
		try {
			const workspaceContent = readFileSync(workspaceConfigPath, 'utf-8')
			const workspaceConfig: WorkspaceConfig = yaml.parse(workspaceContent)

			// Load default catalog
			if (workspaceConfig.catalog) {
				this.catalogs.set('default', workspaceConfig.catalog)
			}

			// Load named catalogs
			if (workspaceConfig.catalogs) {
				Object.entries(workspaceConfig.catalogs).forEach(([name, catalog]) => {
					this.catalogs.set(name, catalog)
				})
			}

			console.log(`✅ Loaded ${this.catalogs.size} catalog(s)`)
			this.catalogs.forEach((_, name) => {
				console.log(`   - ${name}`)
			})
		} catch (error) {
			throw new Error(`Failed to load workspace config: ${error}`)
		}
	}

	private resolveDependencySection(
		dependencies: Record<string, string> | undefined,
		sectionName: string,
	): Record<string, string> | undefined {
		if (!dependencies) return undefined

		const resolved: Record<string, string> = {}
		let resolvedCount = 0
		let removedCount = 0

		Object.entries(dependencies).forEach(([packageName, version]) => {
			if (version.startsWith('catalog:')) {
				try {
					const catalogName =
						version === 'catalog:' ? 'default' : version.replace('catalog:', '')
					const catalog = this.catalogs.get(catalogName)

					if (!catalog) {
						throw new Error(`Catalog "${catalogName}" not found`)
					}

					const resolvedVersion = catalog[packageName]
					if (!resolvedVersion) {
						throw new Error(
							`Package "${packageName}" not found in catalog "${catalogName}"`,
						)
					}

					resolved[packageName] = resolvedVersion
					resolvedCount++
					console.log(
						`   ✓ ${sectionName}: ${packageName}: ${version} → ${resolvedVersion}`,
					)
				} catch (error) {
					throw new Error(
						`Failed to resolve ${packageName} in ${sectionName}: ${error}`,
					)
				}
			} else if (version.startsWith('workspace:')) {
				// Remove workspace dependencies as they are development-time configuration packages
				// not needed in production deployment
				removedCount++
				console.log(
					`   🗑️  ${sectionName}: ${packageName}: ${version} → REMOVED (workspace dependency)`,
				)
				// Don't add to resolved object - effectively removes the dependency
			} else {
				resolved[packageName] = version
			}
		})

		if (resolvedCount > 0) {
			console.log(
				`✅ Resolved ${resolvedCount} catalog references in ${sectionName}`,
			)
		}

		if (removedCount > 0) {
			console.log(
				`🗑️  Removed ${removedCount} workspace dependencies from ${sectionName}`,
			)
		}

		return resolved
	}

	public resolvePackageJson(
		packageJsonPath: string,
		outputPath?: string,
	): void {
		try {
			console.log(`📖 Reading package.json from: ${packageJsonPath}`)
			const packageContent = readFileSync(packageJsonPath, 'utf-8')
			const packageJson: PackageJson = JSON.parse(packageContent)

			console.log(
				`🔍 Resolving catalog references and removing workspace dependencies...`,
			)

			// Resolve each dependency section
			const resolvedPackageJson: PackageJson = {
				...packageJson,
				dependencies: this.resolveDependencySection(
					packageJson.dependencies,
					'dependencies',
				),
				devDependencies: this.resolveDependencySection(
					packageJson.devDependencies,
					'devDependencies',
				),
				peerDependencies: this.resolveDependencySection(
					packageJson.peerDependencies,
					'peerDependencies',
				),
				optionalDependencies: this.resolveDependencySection(
					packageJson.optionalDependencies,
					'optionalDependencies',
				),
			}

			// Write resolved package.json
			const output = outputPath || packageJsonPath
			writeFileSync(output, JSON.stringify(resolvedPackageJson, null, 2) + '\n')

			console.log(`✅ Resolved package.json written to: ${output}`)
		} catch (error) {
			throw new Error(`Failed to resolve package.json: ${error}`)
		}
	}
}

// CLI Interface
function main() {
	const args = process.argv.slice(2)

	if (args.length < 2) {
		console.error(`
Usage: tsx resolve-catalog-references.ts <workspace-config> <package-json> [output-path]

Arguments:
  workspace-config  Path to pnpm-workspace.yaml
  package-json      Path to package.json with catalog references
  output-path       Optional output path (defaults to overwriting input)

Example:
  tsx resolve-catalog-references.ts pnpm-workspace.yaml apps/express-api/package.json
  tsx resolve-catalog-references.ts pnpm-workspace.yaml apps/express-api/package.json resolved-package.json
`)
		process.exit(1)
	}

	const [workspaceConfigPath, packageJsonPath, outputPath] = args

	try {
		console.log(`🚀 Starting catalog resolution...`)
		console.log(`   Workspace config: ${workspaceConfigPath}`)
		console.log(`   Package.json: ${packageJsonPath}`)
		console.log(`   Output: ${outputPath || packageJsonPath}`)
		console.log('')

		const resolver = new CatalogResolver(workspaceConfigPath)
		resolver.resolvePackageJson(packageJsonPath, outputPath)

		console.log('')
		console.log(`🎉 Catalog resolution completed successfully!`)
	} catch (error) {
		console.error(`❌ Error: ${error}`)
		process.exit(1)
	}
}

// Run main function
main()

export { CatalogResolver }

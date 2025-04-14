import * as fs from 'fs/promises'
import * as path from 'path'
import { glob } from 'glob'
import * as ts from 'typescript'

const EXPRESS_API_PATH = path.resolve(
	__dirname,
	'../../../apps/express-api/src',
)
const OUTPUT_PATH = path.resolve(__dirname, '../src')

async function findTypeFiles(): Promise<string[]> {
	const patterns = ['**/*.types.ts', '**/*.schemas.ts']
	const files = await Promise.all(
		patterns.map((pattern) =>
			glob(pattern, { cwd: EXPRESS_API_PATH, absolute: true }),
		),
	)
	return files.flat()
}

async function generateTypes() {
	try {
		await fs.mkdir(OUTPUT_PATH, { recursive: true })
		const typeFiles = await findTypeFiles()

		const program = ts.createProgram(typeFiles, {
			target: ts.ScriptTarget.ESNext,
			module: ts.ModuleKind.ESNext,
		})

		for (const filePath of typeFiles) {
			const sourceFile = program.getSourceFile(filePath)
			if (!sourceFile) continue

			const relativePath = path.relative(EXPRESS_API_PATH, filePath)
			const featureName = path.dirname(relativePath).split('/')[1]
			const outputDir = path.join(OUTPUT_PATH, featureName ?? 'unknown')

			await fs.mkdir(outputDir, { recursive: true })

			const isSchemaFile = filePath.endsWith('.schemas.ts')
			const nodes = extractNodes(sourceFile, isSchemaFile)

			let outputContent: string
			if (isSchemaFile) {
				outputContent = `import { z } from 'zod';

// Generated from ${relativePath}

${nodes}
`
			} else {
				// For types file, import schemas
				outputContent = `import { z } from 'zod';
import express from 'express';
import {
    registerSchema,
    confirmRegistrationSchema,
    resendConfirmationCodeSchema,
    loginSchema,
    loginResponseSchema,
    refreshTokenSchema,
    getUserSchema,
    getUserResponseSchema,
} from './schemas';

// Generated from ${relativePath}

${nodes}
`
			}

			const outputFileName = isSchemaFile ? 'schemas.ts' : 'types.ts'
			const outputFile = path.join(outputDir, outputFileName)
			await fs.writeFile(outputFile, outputContent)

			// Create or update index.ts for the feature
			const indexPath = path.join(outputDir, 'index.ts')
			let indexContent = ''

			try {
				indexContent = await fs.readFile(indexPath, 'utf-8')
			} catch (error) {
				// File doesn't exist yet
			}

			const exportStatement = `export * from './${path.parse(outputFileName).name}';\n`
			if (!indexContent.includes(exportStatement)) {
				indexContent += exportStatement
				await fs.writeFile(indexPath, indexContent)
			}

			console.log(
				`Generated ${isSchemaFile ? 'schemas' : 'types'} for ${featureName}`,
			)
		}

		// Generate main index.ts
		const features = await fs.readdir(OUTPUT_PATH)
		const mainIndexContent = features
			.filter((f) => !f.includes('.') && f !== 'scripts')
			.map((feature) => `export * from './${feature}';`)
			.join('\n')

		await fs.writeFile(
			path.join(OUTPUT_PATH, 'index.ts'),
			mainIndexContent
				? `${mainIndexContent}\n`
				: '// No types generated yet\n',
		)

		console.log('Type generation complete!')
	} catch (error) {
		console.error('Error generating types:', error)
		process.exit(1)
	}
}

function extractNodes(
	sourceFile: ts.SourceFile,
	isSchemaFile: boolean,
): string {
	const printer = ts.createPrinter({ newLine: ts.NewLineKind.LineFeed })
	const nodes: ts.Node[] = []

	function visit(node: ts.Node) {
		if (isSchemaFile) {
			// For schema files, include variable declarations and functions
			if (ts.isVariableStatement(node) || ts.isFunctionDeclaration(node)) {
				nodes.push(node)
			}
		} else {
			// For type files, include type declarations and interfaces
			if (
				ts.isTypeAliasDeclaration(node) ||
				ts.isInterfaceDeclaration(node) ||
				ts.isEnumDeclaration(node)
			) {
				nodes.push(node)
			}
		}
		ts.forEachChild(node, visit)
	}

	visit(sourceFile)

	return nodes
		.map((node) => printer.printNode(ts.EmitHint.Unspecified, node, sourceFile))
		.join('\n\n')
}

generateTypes()

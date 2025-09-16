import { exec } from 'node:child_process'
import { promisify } from 'node:util'

const execAsync = promisify(exec)

/**
 * Fetch Doppler secrets using CLI in JSON format
 * This avoids the table parsing issue by getting raw JSON data
 */
export async function fetchDopplerSecretsJson(
	project: string,
	config: string,
): Promise<Record<string, string>> {
	try {
		const command = `doppler secrets --project ${project} --config ${config} --json`
		const { stdout, stderr } = await execAsync(command)

		if (stderr) {
			throw new Error(`Doppler CLI stderr: ${stderr}`)
		}

		const secretsData = JSON.parse(stdout)

		// Extract the computed values from the Doppler CLI JSON response
		const secrets: Record<string, string> = {}
		for (const [key, value] of Object.entries(secretsData)) {
			if (typeof value === 'object' && value !== null && 'computed' in value) {
				secrets[key] = (value as { computed: string }).computed
			}
		}

		return secrets
	} catch (error) {
		throw new Error(`Failed to fetch Doppler secrets: ${error}`)
	}
}

/**
 * Create environment variables from Doppler secrets using CLI
 * This version gets raw JSON data instead of table format
 */
export function createEnvironmentVariablesFromCli(
	secrets: Record<string, string>,
	environmentName: string,
): Record<string, string> {
	const envVars: Record<string, string> = {}

	// Add all secrets directly (no table parsing needed!)
	Object.entries(secrets).forEach(([key, value]) => {
		envVars[key] = value
	})

	// Add application-specific environment variables
	envVars.NODE_ENV = 'production'
	envVars.SERVER_PORT = '3040'
	envVars.APP_ENV = environmentName

	return envVars
}

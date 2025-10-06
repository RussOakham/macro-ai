import { DopplerSDK } from '@dopplerhq/node-sdk'
import * as pulumi from '@pulumi/pulumi'

async function fetchDopplerSecrets(
	project: string,
	config: string,
	dopplerToken: string,
): Promise<Record<string, string>> {
	const sdk = new DopplerSDK({
		accessToken: dopplerToken,
	})

	try {
		const response = await sdk.secrets.list(project, config)

		if (!response.secrets) {
			throw new Error('No secrets found')
		}

		const secrets: Record<string, string> = {}

		Object.entries(response.secrets).forEach(([key, secretObj]) => {
			if (secretObj?.computed !== undefined && secretObj?.computed !== null) {
				secrets[key] = String(secretObj.computed)
			}
		})

		return secrets
	} catch (error) {
		console.error('Failed to fetch Doppler secrets:', error)
		throw error
	}
}

export function getDopplerSecrets(
	dopplerToken: pulumi.Output<string>,
	project: string,
	config: string,
	additionalEnvVars: Record<string, string> = {},
): pulumi.Output<Record<string, string>> {
	return pulumi.secret(
		pulumi
			.output(dopplerToken)
			.apply((token) => {
				const fallbackToken =
					process.env.DOPPLER_TOKEN || process.env.DOPPLER_TOKEN_STAGING
				const finalToken = token || fallbackToken

				if (!finalToken) {
					throw new Error(
						'Doppler token not found in Pulumi configuration or environment variables',
					)
				}

				return fetchDopplerSecrets(project, config, finalToken)
			})
			.apply((secrets) => {
				return {
					...secrets,
					...additionalEnvVars,
				}
			}),
	)
}

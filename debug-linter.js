import path from 'node:path'

// Replicate the getFileType function to test it
const getFileType = function getFileType(filePath) {
	const basename = path.basename(filePath)

	if (basename.startsWith('docker-compose')) {
		return 'docker-compose'
	}

	if (
		basename.includes('workflow') ||
		filePath.includes('/.github/workflows/')
	) {
		return 'workflow'
	}

	if (basename.startsWith('amplify')) {
		return 'amplify'
	}

	return 'default'
}

// Test cases
const testFiles = [
	'.github/workflows/test-workflow.yml',
	'.github/workflows/hygiene-checks.yml',
	'docker-compose.yml',
	'some-amplify.yml',
	'regular-file.yml',
]

console.log('Testing getFileType function:')
testFiles.forEach((file) => {
	const type = getFileType(file)
	console.log(`${file} -> ${type}`)
})

#!/usr/bin/env node

/**
 * Local Security Scanning Script for GitHub Actions Workflows
 * Scans workflows for security issues before committing
 */

import { execSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const projectRoot = path.resolve(__dirname, '..')

// Color codes for console output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
}

function log(color, message) {
  console.log(`${colors[color]}${message}${colors.reset}`)
}

// Check if tool is installed
function isToolInstalled(tool) {
  try {
    execSync(`which ${tool}`, { stdio: 'ignore' })
    return true
  } catch {
    return false
  }
}

// Install actionlint if not present
function installActionlint() {
  if (!isToolInstalled('actionlint')) {
    log('yellow', 'Installing actionlint...')
    try {
      execSync('brew install actionlint', { stdio: 'inherit' })
      log('green', '✅ actionlint installed')
    } catch (error) {
      log('red', '❌ Failed to install actionlint. Please install manually: brew install actionlint')
      return false
    }
  }
  return true
}

// Install gitleaks if not present
function installGitleaks() {
  if (!isToolInstalled('gitleaks')) {
    log('yellow', 'Installing gitleaks...')
    try {
      execSync('brew install gitleaks', { stdio: 'inherit' })
      log('green', '✅ gitleaks installed')
    } catch (error) {
      log('red', '❌ Failed to install gitleaks. Please install manually: brew install gitleaks')
      return false
    }
  }
  return true
}

// Run actionlint on workflows
function runActionlint() {
  log('cyan', '🔍 Running actionlint on GitHub Actions workflows...')
  
  try {
    const output = execSync('actionlint -color', { 
      cwd: projectRoot,
      encoding: 'utf8',
      stdio: 'pipe'
    })
    
    if (output.trim()) {
      log('yellow', '⚠️ Actionlint found issues:')
      console.log(output)
      return false
    } else {
      log('green', '✅ Actionlint: No issues found')
      return true
    }
  } catch (error) {
    log('red', '❌ Actionlint failed:')
    console.log(error.stdout || error.message)
    return false
  }
}

// Run gitleaks on workflows
function runGitleaks() {
  log('cyan', '🔍 Running gitleaks on GitHub Actions workflows...')
  
  try {
    const output = execSync('gitleaks detect --source .github/workflows/ --config .gitleaks.toml --verbose', {
      cwd: projectRoot,
      encoding: 'utf8',
      stdio: 'pipe'
    })
    
    if (output.trim()) {
      log('yellow', '⚠️ Gitleaks found potential secrets:')
      console.log(output)
      return false
    } else {
      log('green', '✅ Gitleaks: No secrets found')
      return true
    }
  } catch (error) {
    // Gitleaks exits with code 1 when secrets are found
    if (error.status === 1) {
      log('red', '❌ Gitleaks found secrets:')
      console.log(error.stdout || error.message)
      return false
    } else {
      log('red', '❌ Gitleaks failed:')
      console.log(error.message)
      return false
    }
  }
}

// Check for dangerous GitHub Actions
function checkDangerousActions() {
  log('cyan', '🔍 Checking for dangerous GitHub Actions...')
  
  const dangerousActions = [
    'actions/checkout@v1',
    'actions/checkout@v2',
    'actions/setup-node@v1',
    'actions/setup-node@v2',
    'actions/upload-artifact@v1',
    'actions/upload-artifact@v2',
    'actions/download-artifact@v1',
    'actions/download-artifact@v2',
  ]
  
  const workflowDir = path.join(projectRoot, '.github', 'workflows')
  const workflows = fs.readdirSync(workflowDir).filter(f => f.endsWith('.yml') || f.endsWith('.yaml'))
  
  let hasIssues = false
  
  workflows.forEach(workflow => {
    const content = fs.readFileSync(path.join(workflowDir, workflow), 'utf8')
    
    dangerousActions.forEach(action => {
      if (content.includes(action)) {
        log('red', `❌ ${workflow}: Found potentially dangerous action ${action}`)
        hasIssues = true
      }
    })
  })
  
  if (!hasIssues) {
    log('green', '✅ No dangerous actions found')
  }
  
  return !hasIssues
}

// Check for hardcoded secrets
function checkHardcodedSecrets() {
  log('cyan', '🔍 Checking for hardcoded secrets in workflows...')
  
  const secretPatterns = [
    /password\s*[:=]\s*['"][^'"]+['"]/gi,
    /secret\s*[:=]\s*['"][^'"]+['"]/gi,
    /key\s*[:=]\s*['"][^'"]+['"]/gi,
    /token\s*[:=]\s*['"][^'"]+['"]/gi,
    /api[_-]?key\s*[:=]\s*['"][^'"]+['"]/gi,
  ]
  
  const workflowDir = path.join(projectRoot, '.github', 'workflows')
  const workflows = fs.readdirSync(workflowDir).filter(f => f.endsWith('.yml') || f.endsWith('.yaml'))
  
  let hasIssues = false
  
  workflows.forEach(workflow => {
    const content = fs.readFileSync(path.join(workflowDir, workflow), 'utf8')
    const lines = content.split('\n')
    
    lines.forEach((line, index) => {
      secretPatterns.forEach(pattern => {
        if (pattern.test(line) && !line.includes('${{') && !line.includes('secrets.')) {
          log('red', `❌ ${workflow}:${index + 1} Potential hardcoded secret: ${line.trim()}`)
          hasIssues = true
        }
      })
    })
  })
  
  if (!hasIssues) {
    log('green', '✅ No hardcoded secrets found')
  }
  
  return !hasIssues
}

// Main function
async function main() {
  log('cyan', '🛡️  GitHub Actions Security Scanner')
  log('cyan', '==================================')
  
  let allPassed = true
  
  // Install required tools
  if (!installActionlint() || !installGitleaks()) {
    log('red', '❌ Required tools not available. Exiting.')
    process.exit(1)
  }
  
  // Run security checks
  const checks = [
    { name: 'Actionlint', fn: runActionlint },
    { name: 'Gitleaks', fn: runGitleaks },
    { name: 'Dangerous Actions', fn: checkDangerousActions },
    { name: 'Hardcoded Secrets', fn: checkHardcodedSecrets },
  ]
  
  for (const check of checks) {
    log('blue', `\n📋 Running ${check.name}...`)
    if (!check.fn()) {
      allPassed = false
    }
  }
  
  // Summary
  log('cyan', '\n📊 Security Scan Summary')
  log('cyan', '========================')
  
  if (allPassed) {
    log('green', '✅ All security checks passed!')
    log('green', 'Your workflows are ready to commit.')
    process.exit(0)
  } else {
    log('red', '❌ Security issues found!')
    log('red', 'Please fix the issues above before committing.')
    process.exit(1)
  }
}

// Run the main function
main().catch(error => {
  log('red', `❌ Fatal error: ${error.message}`)
  process.exit(1)
})

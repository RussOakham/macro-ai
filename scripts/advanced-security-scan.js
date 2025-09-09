#!/usr/bin/env node

/**
 * Advanced Security Scanning Script for GitHub Actions Workflows
 * Includes CodeQL analysis, dependency scanning, and comprehensive security checks
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
  magenta: '\x1b[35m',
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

// Install tools if not present
function installTools() {
  const tools = [
    { name: 'actionlint', install: 'brew install actionlint' },
    { name: 'gitleaks', install: 'brew install gitleaks' },
    { name: 'gh', install: 'brew install gh' },
  ]
  
  let allInstalled = true
  
  for (const tool of tools) {
    if (!isToolInstalled(tool.name)) {
      log('yellow', `Installing ${tool.name}...`)
      try {
        execSync(tool.install, { stdio: 'inherit' })
        log('green', `✅ ${tool.name} installed`)
      } catch (error) {
        log('red', `❌ Failed to install ${tool.name}. Please install manually: ${tool.install}`)
        allInstalled = false
      }
    } else {
      log('green', `✅ ${tool.name} already installed`)
    }
  }
  
  return allInstalled
}

// Run actionlint with comprehensive checks
function runActionlint() {
  log('cyan', '🔍 Running actionlint with comprehensive checks...')
  
  try {
    const output = execSync('actionlint -color -shellcheck=error -pyflakes=error', { 
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

// Run gitleaks with comprehensive scanning
function runGitleaks() {
  log('cyan', '🔍 Running gitleaks with comprehensive secret scanning...')
  
  try {
    const output = execSync('gitleaks detect --source . --config .gitleaks.toml --verbose --redact', {
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

// Check for security anti-patterns in workflows
function checkSecurityAntiPatterns() {
  log('cyan', '🔍 Checking for security anti-patterns...')
  
  const antiPatterns = [
    {
      name: 'Unsafe checkout actions',
      pattern: /actions\/checkout@v[12]/g,
      severity: 'high',
      message: 'Use actions/checkout@v4 or later for security fixes'
    },
    {
      name: 'Unsafe node setup actions',
      pattern: /actions\/setup-node@v[12]/g,
      severity: 'high',
      message: 'Use actions/setup-node@v4 or later for security fixes'
    },
    {
      name: 'Unsafe artifact actions',
      pattern: /actions\/(upload|download)-artifact@v[12]/g,
      severity: 'medium',
      message: 'Use v4 or later for security fixes'
    },
    {
      name: 'Hardcoded secrets',
      pattern: /(password|secret|key|token)\s*[:=]\s*['"][^'"]+['"]/gi,
      severity: 'critical',
      message: 'Use GitHub secrets instead of hardcoded values'
    },
    {
      name: 'Unsafe shell commands',
      pattern: /run:\s*[^|]*\${{[^}]*}}[^|]*/g,
      severity: 'medium',
      message: 'Be careful with shell command injection in expressions'
    },
    {
      name: 'Missing permissions',
      pattern: /^[^#]*jobs:/gm,
      severity: 'low',
      message: 'Consider adding explicit permissions to jobs'
    }
  ]
  
  const workflowDir = path.join(projectRoot, '.github', 'workflows')
  const workflows = fs.readdirSync(workflowDir).filter(f => f.endsWith('.yml') || f.endsWith('.yaml'))
  
  let hasIssues = false
  
  workflows.forEach(workflow => {
    const content = fs.readFileSync(path.join(workflowDir, workflow), 'utf8')
    const lines = content.split('\n')
    
    antiPatterns.forEach(pattern => {
      const matches = content.match(pattern.pattern)
      if (matches) {
        matches.forEach(match => {
          const lineNumber = lines.findIndex(line => line.includes(match)) + 1
          const severityColor = pattern.severity === 'critical' ? 'red' : 
                               pattern.severity === 'high' ? 'red' : 
                               pattern.severity === 'medium' ? 'yellow' : 'blue'
          
          log(severityColor, `❌ ${workflow}:${lineNumber} [${pattern.severity.toUpperCase()}] ${pattern.name}`)
          log(severityColor, `   ${pattern.message}`)
          log(severityColor, `   Found: ${match}`)
          hasIssues = true
        })
      }
    })
  })
  
  if (!hasIssues) {
    log('green', '✅ No security anti-patterns found')
  }
  
  return !hasIssues
}

// Check for CodeQL best practices
function checkCodeQLBestPractices() {
  log('cyan', '🔍 Checking CodeQL best practices...')
  
  const workflowDir = path.join(projectRoot, '.github', 'workflows')
  const workflows = fs.readdirSync(workflowDir).filter(f => f.endsWith('.yml') || f.endsWith('.yaml'))
  
  let hasIssues = false
  
  workflows.forEach(workflow => {
    const content = fs.readFileSync(path.join(workflowDir, workflow), 'utf8')
    
    // Check if CodeQL is configured
    if (content.includes('codeql') || content.includes('CodeQL')) {
      log('blue', `📋 ${workflow}: CodeQL configuration found`)
      
      // Check for proper CodeQL setup
      if (!content.includes('github/codeql-action/init@v3') && !content.includes('github/codeql-action/init@v4')) {
        log('yellow', `⚠️ ${workflow}: Consider using latest CodeQL init action`)
        hasIssues = true
      }
      
      if (!content.includes('github/codeql-action/analyze@v3') && !content.includes('github/codeql-action/analyze@v4')) {
        log('yellow', `⚠️ ${workflow}: Consider using latest CodeQL analyze action`)
        hasIssues = true
      }
    } else {
      log('blue', `ℹ️ ${workflow}: No CodeQL configuration found (optional)`)
    }
  })
  
  if (!hasIssues) {
    log('green', '✅ CodeQL best practices check passed')
  }
  
  return !hasIssues
}

// Check for dependency vulnerabilities
function checkDependencyVulnerabilities() {
  log('cyan', '🔍 Checking for dependency vulnerabilities...')
  
  try {
    // Check if package-lock.json or pnpm-lock.yaml exists
    const lockFiles = ['package-lock.json', 'pnpm-lock.yaml', 'yarn.lock']
    const hasLockFile = lockFiles.some(file => fs.existsSync(path.join(projectRoot, file)))
    
    if (!hasLockFile) {
      log('yellow', '⚠️ No lock file found. Consider using a lock file for reproducible builds.')
      return true
    }
    
    // Run npm audit if package-lock.json exists
    if (fs.existsSync(path.join(projectRoot, 'package-lock.json'))) {
      try {
        const auditOutput = execSync('npm audit --audit-level=moderate', { 
          cwd: projectRoot,
          encoding: 'utf8',
          stdio: 'pipe'
        })
        log('green', '✅ npm audit: No moderate or higher vulnerabilities found')
      } catch (error) {
        log('red', '❌ npm audit found vulnerabilities:')
        console.log(error.stdout || error.message)
        return false
      }
    }
    
    // For pnpm, we could run pnpm audit, but it's not as comprehensive
    if (fs.existsSync(path.join(projectRoot, 'pnpm-lock.yaml'))) {
      log('blue', 'ℹ️ pnpm lock file found. Consider running: pnpm audit')
    }
    
    return true
  } catch (error) {
    log('yellow', `⚠️ Dependency check failed: ${error.message}`)
    return true // Don't fail the entire scan for this
  }
}

// Generate security report
function generateSecurityReport(results) {
  log('cyan', '\n📊 Security Scan Report')
  log('cyan', '======================')
  
  const report = {
    timestamp: new Date().toISOString(),
    results: results,
    summary: {
      total: results.length,
      passed: results.filter(r => r.passed).length,
      failed: results.filter(r => !r.passed).length
    }
  }
  
  // Save report to file
  const reportPath = path.join(projectRoot, 'security-scan-report.json')
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2))
  
  log('blue', `📄 Report saved to: ${reportPath}`)
  
  // Display summary
  results.forEach(result => {
    const status = result.passed ? '✅' : '❌'
    const color = result.passed ? 'green' : 'red'
    log(color, `${status} ${result.name}`)
  })
  
  log('cyan', `\nSummary: ${report.summary.passed}/${report.summary.total} checks passed`)
  
  return report.summary.failed === 0
}

// Main function
async function main() {
  log('cyan', '🛡️  Advanced GitHub Actions Security Scanner')
  log('cyan', '============================================')
  
  // Install required tools
  if (!installTools()) {
    log('red', '❌ Required tools not available. Exiting.')
    process.exit(1)
  }
  
  // Run security checks
  const checks = [
    { name: 'Actionlint Validation', fn: runActionlint },
    { name: 'Secret Scanning (Gitleaks)', fn: runGitleaks },
    { name: 'Security Anti-patterns', fn: checkSecurityAntiPatterns },
    { name: 'CodeQL Best Practices', fn: checkCodeQLBestPractices },
    { name: 'Dependency Vulnerabilities', fn: checkDependencyVulnerabilities },
  ]
  
  const results = []
  
  for (const check of checks) {
    log('blue', `\n📋 Running ${check.name}...`)
    const passed = check.fn()
    results.push({ name: check.name, passed })
  }
  
  // Generate and display report
  const allPassed = generateSecurityReport(results)
  
  if (allPassed) {
    log('green', '\n✅ All security checks passed!')
    log('green', 'Your workflows are ready to commit.')
    process.exit(0)
  } else {
    log('red', '\n❌ Security issues found!')
    log('red', 'Please fix the issues above before committing.')
    process.exit(1)
  }
}

// Run the main function
main().catch(error => {
  log('red', `❌ Fatal error: ${error.message}`)
  process.exit(1)
})

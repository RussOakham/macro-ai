#!/usr/bin/env node

/**
 * Custom YAML Linting Script
 * Uses js-yaml for comprehensive YAML validation and formatting checks
 */

import fs from 'fs';
import path from 'path';
import { glob } from 'glob';
import yaml from 'js-yaml';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

// Configuration
const config = {
  // File patterns to lint
  patterns: [
    '**/*.yml',
    '**/*.yaml'
  ],
  
  // Directories to ignore
  ignore: [
    '**/node_modules/**',
    '**/dist/**',
    '**/coverage/**',
    '**/build/**',
    '**/.git/**',
    '**/pnpm-lock.yaml',
    '**/package-lock.json',
    '**/yarn.lock'
  ],
  
  // YAML parsing options
  yamlOptions: {
    // Use 2-space indentation
    indent: 2,
    
    // Line width limit
    lineWidth: 120,
    
    // Quote style
    quotingType: "'",
    
    // Force quotes for certain values
    forceQuotes: false,
    
    // Allow duplicate keys (will be warned)
    noDuplicateKeys: false,
    
    // Allow anchors and aliases
    noAnchors: false,
    
    // Allow tags
    noTags: false
  },
  
  // Validation rules
  rules: {
    maxLineLength: 120,
    indentSize: 2,
    requireNewlineAtEnd: true,
    allowTrailingSpaces: false,
    maxConsecutiveEmptyLines: 2,
    requireConsistentQuotes: true,
    preferSingleQuotes: true
  }
};

// Color codes for console output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m'
};

// Error tracking
let errorCount = 0;
let warningCount = 0;
let fileCount = 0;

/**
 * Log a message with color
 */
function log(color, message) {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

/**
 * Log an error message
 */
function logError(file, line, message) {
  errorCount++;
  log('red', `❌ ${file}:${line || '?'} - ${message}`);
}

/**
 * Log a warning message
 */
function logWarning(file, line, message) {
  warningCount++;
  log('yellow', `⚠️  ${file}:${line || '?'} - ${message}`);
}

/**
 * Log a success message
 */
function logSuccess(file, message) {
  log('green', `✅ ${file} - ${message}`);
}

/**
 * Validate YAML syntax
 */
function validateYamlSyntax(filePath, content) {
  try {
    yaml.load(content, { 
      filename: filePath,
      ...config.yamlOptions 
    });
    return { valid: true, error: null };
  } catch (error) {
    return { valid: false, error: error.message };
  }
}

/**
 * Check line length
 */
function checkLineLength(filePath, content) {
  const lines = content.split('\n');
  const issues = [];
  
  lines.forEach((line, index) => {
    if (line.length > config.rules.maxLineLength) {
      issues.push({
        line: index + 1,
        message: `Line too long (${line.length} > ${config.rules.maxLineLength} characters)`
      });
    }
  });
  
  return issues;
}

/**
 * Check indentation consistency
 */
function checkIndentation(filePath, content) {
  const lines = content.split('\n');
  const issues = [];
  
  lines.forEach((line, index) => {
    if (line.trim() === '') return; // Skip empty lines
    
    // Check for tabs (should use spaces)
    if (line.includes('\t')) {
      issues.push({
        line: index + 1,
        message: 'Found tab character, use spaces for indentation'
      });
    }
    
    // Check for inconsistent indentation
    const leadingSpaces = line.match(/^(\s*)/)[1].length;
    if (leadingSpaces > 0 && leadingSpaces % config.rules.indentSize !== 0) {
      issues.push({
        line: index + 1,
        message: `Inconsistent indentation (${leadingSpaces} spaces, should be multiple of ${config.rules.indentSize})`
      });
    }
  });
  
  return issues;
}

/**
 * Check for trailing spaces
 */
function checkTrailingSpaces(filePath, content) {
  const lines = content.split('\n');
  const issues = [];
  
  lines.forEach((line, index) => {
    if (line.endsWith(' ') || line.endsWith('\t')) {
      issues.push({
        line: index + 1,
        message: 'Trailing whitespace found'
      });
    }
  });
  
  return issues;
}

/**
 * Check for excessive empty lines
 */
function checkEmptyLines(filePath, content) {
  const lines = content.split('\n');
  const issues = [];
  let consecutiveEmptyLines = 0;
  
  lines.forEach((line, index) => {
    if (line.trim() === '') {
      consecutiveEmptyLines++;
    } else {
      if (consecutiveEmptyLines > config.rules.maxConsecutiveEmptyLines) {
        issues.push({
          line: index - consecutiveEmptyLines + 1,
          message: `Too many consecutive empty lines (${consecutiveEmptyLines} > ${config.rules.maxConsecutiveEmptyLines})`
        });
      }
      consecutiveEmptyLines = 0;
    }
  });
  
  return issues;
}

/**
 * Check for newline at end of file
 */
function checkNewlineAtEnd(filePath, content) {
  if (config.rules.requireNewlineAtEnd && !content.endsWith('\n')) {
    return [{
      line: content.split('\n').length,
      message: 'File should end with a newline'
    }];
  }
  return [];
}

/**
 * Check for duplicate keys
 */
function checkDuplicateKeys(filePath, content) {
  try {
    const doc = yaml.load(content, { 
      filename: filePath,
      ...config.yamlOptions 
    });
    
    const issues = [];
    
    function checkObject(obj, path = '') {
      if (typeof obj !== 'object' || obj === null || Array.isArray(obj)) {
        return;
      }
      
      const keys = Object.keys(obj);
      const seenKeys = new Set();
      
      keys.forEach(key => {
        if (seenKeys.has(key)) {
          issues.push({
            line: 0, // Line number detection for duplicate keys is complex
            message: `Duplicate key '${key}' found${path ? ` in ${path}` : ''}`
          });
        }
        seenKeys.add(key);
        
        // Recursively check nested objects
        checkObject(obj[key], path ? `${path}.${key}` : key);
      });
    }
    
    checkObject(doc);
    return issues;
  } catch (error) {
    // If we can't parse the YAML, skip this check
    return [];
  }
}

/**
 * Lint a single YAML file
 */
function lintFile(filePath) {
  const relativePath = path.relative(projectRoot, filePath);
  fileCount++;
  
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    
    // Validate YAML syntax
    const syntaxCheck = validateYamlSyntax(filePath, content);
    if (!syntaxCheck.valid) {
      logError(relativePath, 0, `YAML syntax error: ${syntaxCheck.error}`);
      return false;
    }
    
    // Run all checks
    const checks = [
      { name: 'Line length', fn: () => checkLineLength(filePath, content) },
      { name: 'Indentation', fn: () => checkIndentation(filePath, content) },
      { name: 'Trailing spaces', fn: () => checkTrailingSpaces(filePath, content) },
      { name: 'Empty lines', fn: () => checkEmptyLines(filePath, content) },
      { name: 'Newline at end', fn: () => checkNewlineAtEnd(filePath, content) },
      { name: 'Duplicate keys', fn: () => checkDuplicateKeys(filePath, content) }
    ];
    
    let hasIssues = false;
    
    checks.forEach(check => {
      const issues = check.fn();
      issues.forEach(issue => {
        if (check.name === 'Line length' || check.name === 'Empty lines') {
          logWarning(relativePath, issue.line, `${check.name}: ${issue.message}`);
        } else {
          logError(relativePath, issue.line, `${check.name}: ${issue.message}`);
        }
        hasIssues = true;
      });
    });
    
    if (!hasIssues) {
      logSuccess(relativePath, 'No issues found');
    }
    
    return !hasIssues;
    
  } catch (error) {
    logError(relativePath, 0, `Failed to read file: ${error.message}`);
    return false;
  }
}

/**
 * Main function
 */
async function main() {
  log('cyan', '🔍 YAML Linting Tool');
  log('cyan', '==================');
  
  try {
    // Find all YAML files
    const files = [];
    for (const pattern of config.patterns) {
      const matches = await glob(pattern, {
        cwd: projectRoot,
        ignore: config.ignore,
        absolute: true
      });
      files.push(...matches);
    }
    
    if (files.length === 0) {
      log('yellow', 'No YAML files found to lint');
      return;
    }
    
    log('blue', `Found ${files.length} YAML file(s) to lint`);
    log('blue', '');
    
    // Lint each file
    let successCount = 0;
    for (const file of files) {
      if (lintFile(file)) {
        successCount++;
      }
    }
    
    // Summary
    log('blue', '');
    log('cyan', '📊 Summary');
    log('cyan', '==========');
    log('blue', `Files processed: ${fileCount}`);
    log('green', `Files passed: ${successCount}`);
    log('red', `Errors: ${errorCount}`);
    log('yellow', `Warnings: ${warningCount}`);
    
    if (errorCount > 0) {
      log('red', '');
      log('red', '❌ Linting failed with errors');
      process.exit(1);
    } else if (warningCount > 0) {
      log('yellow', '');
      log('yellow', '⚠️  Linting completed with warnings');
      process.exit(0);
    } else {
      log('green', '');
      log('green', '✅ All YAML files passed linting');
      process.exit(0);
    }
    
  } catch (error) {
    log('red', `❌ Fatal error: ${error.message}`);
    process.exit(1);
  }
}

// Run the main function
main();

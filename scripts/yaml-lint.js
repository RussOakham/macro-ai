#!/usr/bin/env node

/**
 * Custom YAML Linter
 * Comprehensive YAML validation with detailed error reporting
 */

import { readFileSync, statSync } from 'fs';
import { glob } from 'glob';
import path from 'path';
import { fileURLToPath } from 'url';

// Get the directory name in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const CONFIG = {
  // File patterns to lint
  patterns: [
    '**/*.yml',
    '**/*.yaml',
    '!**/node_modules/**',
    '!**/dist/**',
    '!**/coverage/**',
    '!**/build/**',
    '!**/cdk.out/**',
    '!**/infrastructure/dist/**',
    '!**/.git/**',
    '!**/pnpm-lock.yaml',
    '!**/package-lock.json',
    '!**/yarn.lock',
  ],

  // Line length limits
  lineLength: {
    default: 120,
    dockerCompose: 200,
    githubActions: 200,
    amplify: 200,
  },

  // Indentation settings
  indent: 2,
};

// File type overrides
const FILE_TYPE_OVERRIDES = {
  'docker-compose': { lineLength: CONFIG.lineLength.dockerCompose },
  'workflow': { lineLength: CONFIG.lineLength.githubActions },
  'amplify': { lineLength: CONFIG.lineLength.amplify },
};

/**
 * Get file type based on filename
 */
function getFileType(filename) {
  const basename = path.basename(filename);

  if (basename.startsWith('docker-compose')) {
    return 'docker-compose';
  }

  if (basename.includes('workflow') || filename.includes('/.github/workflows/')) {
    return 'workflow';
  }

  if (basename.startsWith('amplify')) {
    return 'amplify';
  }

  return 'default';
}

/**
 * Check if line exceeds length limit
 */
function checkLineLength(line, maxLength, lineNumber) {
  if (line.length > maxLength) {
    return {
      type: 'warning',
      line: lineNumber,
      message: `Line exceeds ${maxLength} characters (${line.length})`,
      rule: 'line-length',
    };
  }
  return null;
}

/**
 * Check for trailing spaces
 */
function checkTrailingSpaces(line, lineNumber) {
  if (line.match(/\s+$/)) {
    return {
      type: 'error',
      line: lineNumber,
      message: 'Trailing spaces found',
      rule: 'trailing-spaces',
    };
  }
  return null;
}

/**
 * Check indentation consistency
 */
function checkIndentation(line, lineNumber, expectedIndent) {
  const indentMatch = line.match(/^(\s*)/);
  if (!indentMatch) return null;

  const indent = indentMatch[1];
  const indentLevel = indent.length / expectedIndent;

  // Check if indentation is a multiple of expected spaces
  if (indent.length % expectedIndent !== 0) {
    return {
      type: 'error',
      line: lineNumber,
      message: `Inconsistent indentation. Expected multiple of ${expectedIndent} spaces`,
      rule: 'indentation',
    };
  }

  // Check for tabs
  if (indent.includes('\t')) {
    return {
      type: 'error',
      line: lineNumber,
      message: 'Tabs found. Use spaces only',
      rule: 'indentation',
    };
  }

  return null;
}

/**
 * Check for empty lines at start/end
 */
function checkEmptyLines(lines, lineNumber) {
  const isEmpty = lines[lineNumber - 1].trim() === '';
  const prevLineEmpty = lineNumber > 1 ? lines[lineNumber - 2].trim() === '' : false;
  const nextLineEmpty = lineNumber < lines.length ? lines[lineNumber].trim() === '' : false;

  // Check for too many consecutive empty lines
  if (isEmpty && prevLineEmpty) {
    return {
      type: 'error',
      line: lineNumber,
      message: 'Multiple consecutive empty lines',
      rule: 'empty-lines',
    };
  }

  // Check for empty line at start of file
  if (lineNumber === 1 && isEmpty) {
    return {
      type: 'error',
      line: lineNumber,
      message: 'Empty line at start of file',
      rule: 'empty-lines',
    };
  }

  // Check for missing newline at end of file
  if (lineNumber === lines.length && !isEmpty && !lines[lineNumber - 1].endsWith('\n')) {
    return {
      type: 'error',
      line: lineNumber,
      message: 'Missing newline at end of file',
      rule: 'eof-newline',
    };
  }

  return null;
}

/**
 * Lint a single YAML file
 */
function lintYamlFile(filePath) {
  try {
    const content = readFileSync(filePath, 'utf8');
    const lines = content.split('\n');
    const fileType = getFileType(filePath);
    const maxLineLength = FILE_TYPE_OVERRIDES[fileType]?.lineLength || CONFIG.lineLength.default;
    const issues = [];

    lines.forEach((line, index) => {
      const lineNumber = index + 1;

      // Check line length
      const lineLengthIssue = checkLineLength(line, maxLineLength, lineNumber);
      if (lineLengthIssue) issues.push(lineLengthIssue);

      // Check trailing spaces
      const trailingSpacesIssue = checkTrailingSpaces(line, lineNumber);
      if (trailingSpacesIssue) issues.push(trailingSpacesIssue);

      // Check indentation
      const indentationIssue = checkIndentation(line, lineNumber, CONFIG.indent);
      if (indentationIssue) issues.push(indentationIssue);

      // Check empty lines
      const emptyLinesIssue = checkEmptyLines(lines, lineNumber);
      if (emptyLinesIssue) issues.push(emptyLinesIssue);
    });

    return issues;
  } catch (error) {
    return [{
      type: 'error',
      line: 0,
      message: `Failed to read file: ${error.message}`,
      rule: 'file-read',
    }];
  }
}

/**
 * Print issues in a formatted way
 */
function printIssues(filePath, issues) {
  if (issues.length === 0) return;

  console.log(`\n${filePath}:`);
  issues.forEach(issue => {
    const icon = issue.type === 'error' ? '❌' : '⚠️';
    console.log(`  ${icon} Line ${issue.line}: ${issue.message} (${issue.rule})`);
  });
}

/**
 * Main linting function
 */
async function runLinter() {
  const args = process.argv.slice(2);
  const shouldFix = args.includes('--fix');

  console.log('🔍 Running YAML Linter...');

  try {
    const files = await glob(CONFIG.patterns, {
      cwd: path.join(__dirname, '..'),
      absolute: true,
    });

    if (files.length === 0) {
      console.log('✅ No YAML files found to lint');
      return;
    }

    let totalIssues = 0;
    let filesWithIssues = 0;

    for (const file of files) {
      const issues = lintYamlFile(file);

      if (issues.length > 0) {
        filesWithIssues++;
        totalIssues += issues.length;
        printIssues(file, issues);
      }
    }

    console.log(`\n📊 Summary: ${filesWithIssues} files with issues, ${totalIssues} total issues`);

    if (filesWithIssues > 0) {
      process.exit(1);
    } else {
      console.log('✅ All YAML files passed linting!');
    }
  } catch (error) {
    console.error('❌ Error running linter:', error.message);
    process.exit(1);
  }
}

// Run the linter
runLinter();

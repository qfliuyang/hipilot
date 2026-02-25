/**
 * TestUtils - Handy utilities for HiTestBot test frameworks
 *
 * Provides common testing operations for:
 * - UI element testing
 * - Skills testing
 * - Screenshot comparison
 * - Wait conditions
 * - File operations
 */

import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

/**
 * Wait for a condition to be true
 * @param {Function} condition - Function that returns true when condition is met
 * @param {number} timeout - Maximum wait time in ms
 * @param {number} interval - Check interval in ms
 */
async function waitFor(condition, timeout = 30000, interval = 500) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    if (await condition()) {
      return true;
    }
    await sleep(interval);
  }
  throw new Error(`Timeout waiting for condition after ${timeout}ms`);
}

/**
 * Sleep/delay utility
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Capture screenshot using ImageMagick
 * @param {string} outputPath - Where to save the screenshot
 * @param {string} display - Display to capture (:0, :99, etc)
 */
async function captureScreenshot(outputPath, display = ':0') {
  return new Promise((resolve, reject) => {
    const proc = spawn('import', ['-window', 'root', '-display', display, outputPath]);

    proc.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`Screenshot failed with code ${code}`));
      } else {
        resolve(outputPath);
      }
    });

    setTimeout(() => {
      proc.kill();
      reject(new Error('Screenshot timeout'));
    }, 10000);
  });
}

/**
 * Compare two images using ImageMagick compare
 * @param {string} image1 - Path to first image
 * @param {string} image2 - Path to second image
 * @param {string} diffOutput - Path to save diff image
 * @param {number} threshold - Fuzz threshold (0-100)
 */
async function compareImages(image1, image2, diffOutput, threshold = 5) {
  return new Promise((resolve, reject) => {
    const proc = spawn('compare', [
      '-metric', 'AE',
      '-fuzz', `${threshold}%`,
      image1,
      image2,
      diffOutput
    ]);

    let output = '';
    proc.stderr.on('data', (data) => {
      output += data.toString();
    });

    proc.on('close', (code) => {
      // compare returns 0 if images are similar, 1 if different
      const diffPixels = parseInt(output.trim()) || 0;
      resolve({
        similar: code === 0,
        diffPixels,
        diffOutput
      });
    });

    setTimeout(() => {
      proc.kill();
      reject(new Error('Image compare timeout'));
    }, 30000);
  });
}

/**
 * Check if file contains pattern
 * @param {string} filePath - Path to file
 * @param {string|RegExp} pattern - Pattern to search for
 */
async function fileContains(filePath, pattern) {
  const content = fs.readFileSync(filePath, 'utf8');
  if (pattern instanceof RegExp) {
    return pattern.test(content);
  }
  return content.includes(pattern);
}

/**
 * Wait for file to exist
 * @param {string} filePath - Path to file
 * @param {number} timeout - Maximum wait time in ms
 */
async function waitForFile(filePath, timeout = 30000) {
  return waitFor(() => fs.existsSync(filePath), timeout, 500);
}

/**
 * Get file size in human-readable format
 * @param {string} filePath - Path to file
 */
function getFileSize(filePath) {
  const stats = fs.statSync(filePath);
  const bytes = stats.size;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${sizes[i]}`;
}

/**
 * Assert that condition is true
 * @param {*} condition - Condition to check
 * @param {string} message - Error message if assertion fails
 */
function assert(condition, message) {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

/**
 * Assert equals
 * @param {*} actual - Actual value
 * @param {*} expected - Expected value
 * @param {string} message - Optional message
 */
function assertEquals(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(
      message || `Expected ${expected} but got ${actual}`
    );
  }
}

/**
 * Assert contains
 * @param {string} text - Text to search in
 * @param {string} substring - Substring to search for
 * @param {string} message - Optional message
 */
function assertContains(text, substring, message) {
  if (!text.includes(substring)) {
    throw new Error(
      message || `Expected text to contain "${substring}"`
    );
  }
}

/**
 * Retry an async operation
 * @param {Function} fn - Function to retry
 * @param {number} retries - Number of retries
 * @param {number} delay - Delay between retries in ms
 */
async function retry(fn, retries = 3, delay = 1000) {
  let lastError;
  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (i < retries - 1) {
        await sleep(delay);
      }
    }
  }
  throw lastError;
}

/**
 * Time an async operation
 * @param {Function} fn - Function to time
 * @returns {Object} { result, duration }
 */
async function time(fn) {
  const start = Date.now();
  const result = await fn();
  const duration = Date.now() - start;
  return { result, duration };
}

/**
 * Create a test directory with timestamp
 * @param {string} baseDir - Base directory
 * @param {string} testName - Test name
 */
function createTestDir(baseDir, testName) {
  const timestamp = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14);
  const testDir = path.join(baseDir, `${testName}_${timestamp}`);
  fs.mkdirSync(testDir, { recursive: true });
  return { testDir, timestamp };
}

/**
 * Read last N lines from file
 * @param {string} filePath - Path to file
 * @param {number} n - Number of lines
 */
function readLastLines(filePath, n = 100) {
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');
  return lines.slice(-n).join('\n');
}

/**
 * Search for pattern in file and return matching lines
 * @param {string} filePath - Path to file
 * @param {string|RegExp} pattern - Pattern to search
 */
function grepFile(filePath, pattern) {
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');
  const regex = pattern instanceof RegExp ? pattern : new RegExp(pattern);
  return lines.filter(line => regex.test(line));
}

/**
 * Format duration in human-readable format
 * @param {number} ms - Duration in milliseconds
 */
function formatDuration(ms) {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  const mins = Math.floor(ms / 60000);
  const secs = ((ms % 60000) / 1000).toFixed(1);
  return `${mins}m ${secs}s`;
}

/**
 * Generate random string
 * @param {number} length - Length of string
 */
function randomString(length = 8) {
  return Math.random().toString(36).substring(2, 2 + length);
}

/**
 * Clean directory contents (but keep directory)
 * @param {string} dirPath - Directory to clean
 */
function cleanDirectory(dirPath) {
  if (!fs.existsSync(dirPath)) return;
  const entries = fs.readdirSync(dirPath);
  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      fs.rmSync(fullPath, { recursive: true });
    } else {
      fs.unlinkSync(fullPath);
    }
  }
}

export {
  waitFor,
  sleep,
  captureScreenshot,
  compareImages,
  fileContains,
  waitForFile,
  getFileSize,
  assert,
  assertEquals,
  assertContains,
  retry,
  time,
  createTestDir,
  readLastLines,
  grepFile,
  formatDuration,
  randomString,
  cleanDirectory
};

/**
 * HiPilot Path Management
 *
 * Provides secure, user-specific paths for temp files and directories.
 * Prevents conflicts on multi-user systems.
 */

import { tmpdir } from 'os';
import { join } from 'path';
import { existsSync, mkdirSync } from 'fs';

/**
 * Get the HiPilot temp directory for the current user
 * Uses os.tmpdir() + username + 'hipilot' for isolation
 */
export function getHipilotTempDir() {
  const username = process.env.USER || process.env.USERNAME || 'unknown';
  return join(tmpdir(), `hipilot-${username}`);
}

/**
 * Get all HiPilot file paths
 * Returns user-specific paths for mode, pending, and metadata files
 */
export function getHipilotPaths() {
  const baseDir = getHipilotTempDir();

  const paths = {
    baseDir,
    modeFile: join(baseDir, 'mode'),
    pendingFile: join(baseDir, 'pending.tcl'),
    pendingMetaFile: join(baseDir, 'pending_meta.json'),
    execDir: join(baseDir, 'exec'),
    generatedDir: join(baseDir, 'generated'),
    reportsDir: join(baseDir, 'reports'),
  };

  // Ensure subdirectories exist
  try {
    if (!existsSync(paths.execDir)) mkdirSync(paths.execDir, { recursive: true });
    if (!existsSync(paths.generatedDir)) mkdirSync(paths.generatedDir, { recursive: true });
    if (!existsSync(paths.reportsDir)) mkdirSync(paths.reportsDir, { recursive: true });
  } catch (err) {
    // Log to stderr for visibility, but don't throw to allow graceful degradation
    console.error(`[HiPilot] Warning: Failed to create temp directories: ${err.message}`);
  }

  return paths;
}

/**
 * Legacy path exports for backward compatibility
 * These are now dynamic based on user
 */
export const getModeFile = () => getHipilotPaths().modeFile;
export const getPendingFile = () => getHipilotPaths().pendingFile;
export const getPendingMetaFile = () => getHipilotPaths().pendingMetaFile;

export default {
  getHipilotTempDir,
  getHipilotPaths,
  getModeFile,
  getPendingFile,
  getPendingMetaFile,
};

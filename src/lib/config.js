/**
 * HiPilot Centralized Configuration
 *
 * This file centralizes all configuration values that are currently
 * hardcoded across the codebase. All components should import from
 * this file rather than using hardcoded values.
 *
 * Environment variables override defaults where appropriate.
 */

export const CONFIG = {
  // Tmux Configuration
  TMUX_SESSION: process.env.HIPILOT_SESSION || 'hipilot',
  TMUX_SOCKET: process.env.HIPILOT_TMUX_SOCKET || 'hipilot',

  // Design/EDA Configuration
  DESIGN_DIR: process.env.HIPILOT_DESIGN_DIR,
  EDA_HOST: process.env.HIPILOT_EDA_HOST || '192.168.112.163',

  // 5-Agent Team Layout (v0.8.0+)
  PANE_LAYOUT: {
    SUPERVISOR: 0,
    KNOWLEDGE: 1,
    PLANNER: 2,
    EXECUTOR: 3,
    ARCHIVIST: 4,
    EDA: 5,
  },

  // Legacy Layout (v0.7.x, for backward compatibility)
  PANE_NAMES: {
    chat: 0,
    eda: 5,
  },
};

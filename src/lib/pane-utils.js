import { CONFIG } from './config.js';

/**
 * Resolve pane identifier to numeric index
 * Supports: number, 'supervisor', 'knowledge', 'planner', 'executor', 'archivist', 'eda', 'chat'
 *
 * @param {number|string} pane - Pane identifier
 * @returns {number} Numeric pane index (0-5)
 * @throws {Error} If pane identifier is unknown
 */
export function resolvePaneIndex(pane) {
  if (typeof pane === 'number') return pane;

  const paneMap = {
    supervisor: CONFIG.PANE_LAYOUT.SUPERVISOR,
    knowledge: CONFIG.PANE_LAYOUT.KNOWLEDGE,
    planner: CONFIG.PANE_LAYOUT.PLANNER,
    executor: CONFIG.PANE_LAYOUT.EXECUTOR,
    archivist: CONFIG.PANE_LAYOUT.ARCHIVIST,
    eda: CONFIG.PANE_LAYOUT.EDA,
    chat: CONFIG.PANE_NAMES.chat,
  };

  const lower = String(pane).toLowerCase();
  if (paneMap[lower] !== undefined) return paneMap[lower];

  throw new Error(`Unknown pane identifier: ${pane}`);
}

/**
 * Build tmux target string for a pane
 *
 * @param {string} session - Tmux session name (e.g., 'hipilot')
 * @param {number|string} pane - Pane identifier (number or name)
 * @returns {string} Tmux target string (e.g., 'hipilot:0.1')
 */
export function buildPaneTarget(session, pane) {
  const paneIndex = resolvePaneIndex(pane);
  return `${session}:0.${paneIndex}`;
}

/**
 * Validate pane identifier
 *
 * @param {number|string} pane - Pane identifier to validate
 * @returns {boolean} True if valid
 */
export function validatePaneIdentifier(pane) {
  if (typeof pane === 'number') return pane >= 0 && pane <= 5;
  return /^[a-zA-Z0-9_-]+$/.test(String(pane));
}

/**
 * Get pane name from index
 *
 * @param {number} index - Numeric pane index
 * @returns {string|null} Pane name or null if not found
 */
export function getPaneName(index) {
  const indexToName = {
    [CONFIG.PANE_LAYOUT.SUPERVISOR]: 'supervisor',
    [CONFIG.PANE_LAYOUT.KNOWLEDGE]: 'knowledge',
    [CONFIG.PANE_LAYOUT.PLANNER]: 'planner',
    [CONFIG.PANE_LAYOUT.EXECUTOR]: 'executor',
    [CONFIG.PANE_LAYOUT.ARCHIVIST]: 'archivist',
    [CONFIG.PANE_LAYOUT.EDA]: 'eda',
  };
  return indexToName[index] || null;
}

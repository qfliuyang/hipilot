/**
 * PageIndex Database - Tree-based knowledge navigation for RTL2GDS flow
 *
 * PageIndex uses a hierarchical tree structure instead of vector embeddings:
 * - No embeddings, no chunking - uses document structure
 * - Tree search: Hierarchical index like a table of contents
 * - Reasoning-based retrieval: LLM reasons over structure, not similarity
 *
 * Tree path format: STAGE/SUBSECTION/ENTRY
 * Example: "synthesis/tcl-patterns/compile_ultra"
 */

import { readFileSync, existsSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * PageIndex Database class for RTL2GDS knowledge
 */
export class PageIndexDB {
  constructor() {
    this.basePath = __dirname;
    this.stages = [
      'synthesis',
      'design-init',
      'floorplan',
      'power-planning',
      'placement',
      'cts',
      'post-cts-opt',
      'routing',
      'routeopt',
      'chipfinish'
    ];
    this.cache = new Map();
  }

  /**
   * Query the PageIndex database by path
   * @param {string} path - Tree path like "synthesis/tcl-patterns/compile_ultra"
   * @returns {object} Query result with content and metadata
   */
  query(path) {
    const parts = path.split('/').filter(p => p.length > 0);

    if (parts.length === 0) {
      return this.getRootIndex();
    }

    const stage = parts[0];
    const subsection = parts[1] || null;
    const entry = parts[2] || null;

    // Validate stage
    if (!this.stages.includes(stage)) {
      return {
        error: `Unknown stage: ${stage}`,
        availableStages: this.stages,
        path
      };
    }

    // Return stage overview
    if (!subsection) {
      return this.getStageOverview(stage);
    }

    // Return subsection content
    return this.getSubsection(stage, subsection, entry);
  }

  /**
   * Search for keywords across the database
   * @param {string} keyword - Keyword to search for
   * @param {object} options - Search options
   * @returns {array} Array of matching results
   */
  search(keyword, options = {}) {
    const { limit = 10, stage = null } = options;
    const results = [];
    const searchStages = stage ? [stage] : this.stages;

    for (const stageName of searchStages) {
      const stageResults = this.searchStage(stageName, keyword);
      results.push(...stageResults);
    }

    // Sort by relevance (simple keyword frequency)
    results.sort((a, b) => b.relevance - a.relevance);

    return results.slice(0, limit);
  }

  /**
   * Get all information for a stage
   * @param {string} stageName - Stage name
   * @returns {object} Complete stage information
   */
  getStage(stageName) {
    if (!this.stages.includes(stageName)) {
      return {
        error: `Unknown stage: ${stageName}`,
        availableStages: this.stages
      };
    }

    const overview = this.getStageOverview(stageName);
    const subsections = {};

    // Read all subsections
    const subsectionFiles = ['tcl-patterns.md', 'common-issues.md'];
    if (stageName === 'synthesis') {
      subsectionFiles.push('dc-commands.md');
    }

    for (const file of subsectionFiles) {
      const content = this.readFile(join(this.basePath, stageName, file));
      if (content) {
        subsections[file.replace('.md', '')] = content;
      }
    }

    return {
      ...overview,
      subsections
    };
  }

  /**
   * Get the root INDEX.md content
   * @returns {object} Root index content
   */
  getRootIndex() {
    const content = this.readFile(join(this.basePath, 'INDEX.md'));
    return {
      type: 'root',
      path: '/',
      content,
      stages: this.stages
    };
  }

  /**
   * Get stage overview from INDEX.md
   * @param {string} stage - Stage name
   * @returns {object} Stage overview
   */
  getStageOverview(stage) {
    const content = this.readFile(join(this.basePath, stage, 'INDEX.md'));
    const metadata = this.parseFrontmatter(content);

    return {
      type: 'stage',
      path: stage,
      stage,
      metadata,
      content,
      subsections: this.getSubsectionsList(stage)
    };
  }

  /**
   * Get subsection content
   * @param {string} stage - Stage name
   * @param {string} subsection - Subsection name
   * @param {string} entry - Optional specific entry
   * @returns {object} Subsection content
   */
  getSubsection(stage, subsection, entry = null) {
    const filename = `${subsection}.md`;
    const filepath = join(this.basePath, stage, filename);
    const content = this.readFile(filepath);

    if (!content) {
      return {
        error: `Subsection not found: ${subsection}`,
        availableSubsections: this.getSubsectionsList(stage),
        path: `${stage}/${subsection}`
      };
    }

    // If entry specified, extract that section
    if (entry) {
      const entryContent = this.extractEntry(content, entry);
      return {
        type: 'entry',
        path: `${stage}/${subsection}/${entry}`,
        stage,
        subsection,
        entry,
        content: entryContent
      };
    }

    return {
      type: 'subsection',
      path: `${stage}/${subsection}`,
      stage,
      subsection,
      content
    };
  }

  /**
   * Search within a stage
   * @param {string} stageName - Stage name
   * @param {string} keyword - Keyword to search
   * @returns {array} Matching results
   */
  searchStage(stageName, keyword) {
    const results = [];
    const lowerKeyword = keyword.toLowerCase();

    // Search in all subsections
    const subsectionFiles = ['INDEX.md', 'tcl-patterns.md', 'common-issues.md'];
    if (stageName === 'synthesis') {
      subsectionFiles.push('dc-commands.md');
    }

    for (const file of subsectionFiles) {
      const filepath = join(this.basePath, stageName, file);
      const content = this.readFile(filepath);

      if (content && content.toLowerCase().includes(lowerKeyword)) {
        const relevance = this.calculateRelevance(content, lowerKeyword);
        results.push({
          path: `${stageName}/${file.replace('.md', '')}`,
          stage: stageName,
          file,
          relevance,
          snippet: this.extractSnippet(content, lowerKeyword)
        });
      }
    }

    return results;
  }

  /**
   * Get list of available subsections for a stage
   * @param {string} stage - Stage name
   * @returns {array} List of subsection names
   */
  getSubsectionsList(stage) {
    const subsections = [];
    const files = ['tcl-patterns.md', 'common-issues.md'];
    if (stage === 'synthesis') {
      files.push('dc-commands.md');
    }

    for (const file of files) {
      if (existsSync(join(this.basePath, stage, file))) {
        subsections.push(file.replace('.md', ''));
      }
    }

    return subsections;
  }

  /**
   * Read file content with caching
   * @param {string} filepath - File path
   * @returns {string|null} File content or null
   */
  readFile(filepath) {
    // Check cache
    if (this.cache.has(filepath)) {
      return this.cache.get(filepath);
    }

    if (!existsSync(filepath)) {
      return null;
    }

    try {
      const content = readFileSync(filepath, 'utf-8');
      this.cache.set(filepath, content);
      return content;
    } catch (err) {
      return null;
    }
  }

  /**
   * Parse YAML frontmatter from markdown
   * @param {string} content - File content
   * @returns {object} Parsed frontmatter
   */
  parseFrontmatter(content) {
    const match = content.match(/^---\n([\s\S]*?)\n---/);
    if (!match) return {};

    const frontmatter = {};
    const lines = match[1].split('\n');

    for (const line of lines) {
      const colonIndex = line.indexOf(':');
      if (colonIndex > 0) {
        const key = line.slice(0, colonIndex).trim();
        const value = line.slice(colonIndex + 1).trim();
        frontmatter[key] = value;
      }
    }

    return frontmatter;
  }

  /**
   * Extract a specific entry/section from content
   * @param {string} content - Full content
   * @param {string} entry - Entry name
   * @returns {string|null} Entry content
   */
  extractEntry(content, entry) {
    const lowerEntry = entry.toLowerCase();
    const lines = content.split('\n');
    let startIndex = -1;
    let endIndex = -1;

    // Find entry header
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].toLowerCase();
      if (line.includes(`## ${lowerEntry}`) ||
          line.includes(`### ${lowerEntry}`) ||
          line.includes(`| ${lowerEntry} |`)) {
        startIndex = i;
        break;
      }
    }

    if (startIndex === -1) return null;

    // Find end of entry (next header at same or higher level)
    for (let i = startIndex + 1; i < lines.length; i++) {
      if (lines[i].match(/^#{2,4} /)) {
        endIndex = i;
        break;
      }
    }

    return lines.slice(startIndex, endIndex === -1 ? undefined : endIndex).join('\n');
  }

  /**
   * Calculate relevance score for search
   * @param {string} content - Content to score
   * @param {string} keyword - Lowercase keyword
   * @returns {number} Relevance score
   */
  calculateRelevance(content, keyword) {
    const lowerContent = content.toLowerCase();
    const matches = (lowerContent.match(new RegExp(keyword, 'g')) || []).length;
    return matches;
  }

  /**
   * Extract snippet around keyword
   * @param {string} content - Full content
   * @param {string} keyword - Lowercase keyword
   * @returns {string} Snippet
   */
  extractSnippet(content, keyword) {
    const lowerContent = content.toLowerCase();
    const index = lowerContent.indexOf(keyword);

    if (index === -1) return '';

    const start = Math.max(0, index - 100);
    const end = Math.min(content.length, index + keyword.length + 100);

    return content.slice(start, end).replace(/\n/g, ' ');
  }

  /**
   * Clear the cache
   */
  clearCache() {
    this.cache.clear();
  }
}

/**
 * Create a PageIndexDB instance
 * @returns {PageIndexDB} New PageIndexDB instance
 */
/**
 * Quick query function
 * @param {string} path - Query path
 * @returns {object} Query result
 */
export function quickQuery(path) {
  const db = new PageIndexDB();
  return db.query(path);
}

/**
 * Quick search function
 * @param {string} keyword - Search keyword
 * @param {object} options - Search options
 * @returns {array} Search results
 */
export function quickSearch(keyword, options = {}) {
  const db = new PageIndexDB();
  return db.search(keyword, options);
}

/**
 * Quick stage info function
 * @param {string} stageName - Stage name
 * @returns {object} Stage information
 */
export function quickGetStage(stageName) {
  const db = new PageIndexDB();
  return db.getStage(stageName);
}

export default PageIndexDB;

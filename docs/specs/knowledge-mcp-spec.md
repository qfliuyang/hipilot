# Knowledge MCP Server - Technical Specification

**Component:** `@hipilot/knowledge-mcp-server`
**Version:** Phase 1
**Date:** 2026-02-19

---

## 1. Overview

The Knowledge MCP Server is the documentation-powered reasoning engine. It indexes EDA manuals, team experience documents, and project context into a searchable store, enabling Claude to look up correct commands instead of guessing.

This is the **strategically most important** component — the quality of HiPilot's output is directly proportional to the quality of its knowledge retrieval.

**Key Features:**
- Document indexing (PDF, HTML, markdown, text)
- Command reference lookup
- Methodology guide retrieval
- Team experience search
- Skill generation support (Phase 2)

## 2. MCP Tools

### 2.1 `knowledge.search_docs`

Hybrid search across all indexed documentation.

**Input Schema:**

```json
{
  "query": "string — search query (natural language or command name)",
  "scope": "string | null — 'all' | 'manuals' | 'experience' | 'project' (default: 'all')",
  "vendor": "string | null — filter by vendor",
  "tool": "string | null — filter by tool",
  "max_results": "number | null — maximum results (default: 5)"
}
```

**Output Schema:**

```json
{
  "results": [
    {
      "content": "string — matched document chunk",
      "source": "string — source file path",
      "page": "number | null — page number (for PDFs)",
      "section": "string | null — section heading",
      "score": "number — relevance score (0-1)",
      "scope": "string — 'manual' | 'experience' | 'project'"
    }
  ],
  "total_matches": "number"
}
```

**Retrieval strategy:**
1. Keyword/FTS5 search for exact terms (command names, option flags)
2. Results ranked by BM25 scoring
3. Optional: semantic rerank if embedding index is available
4. Source attribution always included

### 2.2 `knowledge.get_command_ref`

Exact lookup for a specific EDA command.

**Input Schema:**

```json
{
  "tool": "string — 'icc2' | 'innovus' | 'pt' | 'tempus' | etc.",
  "command": "string — command name (e.g., 'get_timing_paths')"
}
```

**Output Schema:**

```json
{
  "found": "boolean",
  "command": "string",
  "tool": "string",
  "syntax": "string — command syntax with all options",
  "description": "string — what the command does",
  "options": [
    {
      "name": "string — option flag",
      "type": "string — value type",
      "required": "boolean",
      "description": "string"
    }
  ],
  "examples": [
    {
      "code": "string — Tcl example",
      "description": "string — what the example does"
    }
  ],
  "notes": "string | null — caveats, version-specific behavior",
  "source": "string — manual reference (e.g., 'ICC2 Command Ref p.1247')",
  "related_commands": ["string — related command names"]
}
```

**Behavior:**
1. First: exact match on command name in structured command index
2. Fallback: FTS5 search for command name across all manuals
3. If not found: return `{found: false}` with suggested similar commands

### 2.3 `knowledge.get_methodology`

Retrieves methodology guidance for a topic.

**Input Schema:**

```json
{
  "tool": "string — EDA tool",
  "topic": "string — methodology topic (e.g., 'clock_tree_synthesis', 'timing_closure')"
}
```

**Output Schema:**

```json
{
  "found": "boolean",
  "topic": "string",
  "tool": "string",
  "content": "string — methodology guide content",
  "recommended_flow": "string | null — step-by-step flow if available",
  "key_settings": [
    {
      "setting": "string — app option or variable name",
      "recommended_value": "string",
      "description": "string"
    }
  ],
  "common_pitfalls": ["string — known issues to watch for"],
  "source": "string — document reference"
}
```

### 2.4 `knowledge.get_experience`

Searches team and personal experience documents.

**Input Schema:**

```json
{
  "topic": "string — search topic",
  "scope": "string | null — 'team' | 'personal' | 'all' (default: 'all')"
}
```

**Output Schema:**

```json
{
  "results": [
    {
      "content": "string — matched content",
      "source": "string — source file",
      "category": "string — 'runbook' | 'postmortem' | 'best_practice' | 'faq'",
      "date": "string | null — document date"
    }
  ]
}
```

### 2.5 `knowledge.generate_skill` (Phase 2)

Generates a skill from source documentation.

**Input Schema:**

```json
{
  "source_path": "string — path to source document",
  "source_type": "string — 'email' | 'wiki' | 'forum_post' | 'runbook' | 'other'",
  "skill_name": "string | null — suggested skill name (auto-detected if omitted)"
}
```

**Output Schema:**

```json
{
  "skill": {
    "name": "string",
    "description": "string",
    "trigger": ["string — trigger phrases"],
    "parameters": [
      {
        "name": "string",
        "type": "string",
        "required": "boolean",
        "description": "string"
      }
    ],
    "workflow": ["string — workflow steps"],
    "examples": ["string — usage examples"],
    "markdown": "string — full skill markdown with YAML frontmatter"
  },
  "confidence": "number — 0-1 confidence score",
  "needs_review": ["string — items requiring human review"]
}
```

**Behavior:**
1. Parse source document
2. Extract workflow steps
3. Identify parameters and validation rules
4. Generate skill markdown with YAML frontmatter
5. Return for user review and editing
6. User saves to appropriate skill directory

---

## 3. Document Ingestion Pipeline

### 3.1 Supported Formats

| Format | Parser | Common Source |
|--------|--------|---------------|
| PDF | pdf-parse / pdfjs | EDA tool manuals, methodology guides |
| HTML | cheerio | SolvNet pages, Cadence support docs |
| Man pages | Custom regex parser | Tool man pages on Linux servers |
| Markdown | remark | Team runbooks, READMEs |
| Plain text | Direct | Release notes, README files |

### 3.2 Ingestion Flow

```
Raw documents
    │
    ▼
Format Detection (by extension + magic bytes)
    │
    ▼
Document Parser (format-specific)
    │ extracts: text, headings, code blocks, tables
    ▼
Chunker
    │ splits into retrievable chunks
    ▼
Indexer
    │ writes to SQLite FTS5 + optional vector index
    ▼
Indexed Knowledge Store (~/.hipilot/knowledge/index.db)
```

### 3.3 Chunking Strategy

Different chunk types for different content:

| Chunk Type | Boundary | Typical Size | Use Case |
|-----------|----------|-------------|----------|
| Command chunk | One chunk per EDA command | 200-500 tokens | Exact command lookup |
| Section chunk | Document section heading | 500-1000 tokens | Methodology guides |
| Example chunk | Code block boundaries | 100-300 tokens | Tcl examples (preserved intact) |
| Paragraph chunk | Paragraph breaks | 200-500 tokens | General documentation |

**Critical rule:** Code examples are NEVER split across chunks. A Tcl code block is always one complete chunk.

### 3.4 Command Index

For EDA command references, a structured index is built separately from FTS:

```sql
CREATE TABLE command_ref (
  id INTEGER PRIMARY KEY,
  tool TEXT NOT NULL,          -- 'icc2', 'innovus', 'pt', etc.
  command TEXT NOT NULL,       -- 'get_timing_paths'
  syntax TEXT,                 -- full syntax string
  description TEXT,
  options_json TEXT,           -- JSON array of options
  examples_json TEXT,          -- JSON array of examples
  notes TEXT,
  source_file TEXT,
  source_page INTEGER,
  UNIQUE(tool, command)
);

CREATE INDEX idx_command_ref_tool ON command_ref(tool);
CREATE INDEX idx_command_ref_command ON command_ref(command);
```

This allows `knowledge.get_command_ref("icc2", "get_timing_paths")` to return instantly without search.

---

## 4. Storage

### 4.1 SQLite Database

All indexes stored in SQLite for portability:

```
~/.hipilot/knowledge/
├── index.db                   # FTS5 index + command reference
├── chunks/                    # Raw chunk files (for re-indexing)
└── embeddings.db              # Optional: vector embeddings (Phase 2+)
```

### 4.2 FTS5 Schema

```sql
-- Full-text search index
CREATE VIRTUAL TABLE docs_fts USING fts5(
  content,
  source,
  scope,       -- 'manual', 'experience', 'project'
  vendor,      -- 'synopsys', 'cadence', null
  tool,        -- 'icc2', 'innovus', etc.
  section,     -- section heading
  chunk_type,  -- 'command', 'section', 'example', 'paragraph'
  tokenize='porter'
);

-- Metadata table
CREATE TABLE docs_meta (
  id INTEGER PRIMARY KEY,
  source_path TEXT NOT NULL,
  format TEXT,                 -- 'pdf', 'html', 'markdown', 'text'
  indexed_at TEXT,
  file_hash TEXT,              -- for incremental re-indexing
  page_count INTEGER
);
```

### 4.3 Incremental Indexing

- On startup: check file hashes against stored hashes
- Only re-index files that have changed
- Full re-index available via `hipilot reindex`

---

## 5. CLI Commands

The knowledge server provides management commands:

```bash
# Index all documents
hipilot index

# Index a specific directory
hipilot index /path/to/new/docs

# Re-index everything (ignores cache)
hipilot reindex

# Show index statistics
hipilot index-stats

# Search from command line (for testing)
hipilot search "get_timing_paths options"

# Lookup a specific command
hipilot command-ref icc2 get_timing_paths

# Generate skill from document (Phase 2)
hipilot skill-gen /path/to/runbook.md
```

---

## 6. Performance Requirements

| Operation | Target | Notes |
|-----------|--------|-------|
| Command ref lookup | < 10ms | Direct SQLite lookup |
| FTS5 keyword search | < 100ms | Standard SQLite FTS performance |
| Full hybrid search | < 500ms | Keyword + optional rerank |
| Initial indexing (1000 pages) | < 5 minutes | Batch processing |
| Incremental re-index | < 30 seconds | Only changed files |
| Memory usage | < 200MB | SQLite + in-memory cache |

---

## 7. Skill Generation Pipeline (Phase 2)

### 7.1 Source Document Analysis

```
Source Document (email, wiki, forum post)
    │
    ▼
Parse & Extract
    ├─ Identify workflow steps
    ├─ Extract parameters
    ├─ Find validation rules
    └─ Collect examples
    │
    ▼
Generate Skill Structure
    ├─ Skill name (auto-detected)
    ├─ Description
    ├─ Trigger phrases
    ├─ Parameters schema
    ├─ Validation rules
    ├─ Workflow steps
    └─ Usage examples
    │
    ▼
Generate Markdown
    │ YAML frontmatter + sections
    │
    ▼
User Review
    ├─ Edit skill
    ├─ Add missing pieces
    └─ Validate
    │
    ▼
Save to Skill Directory
    ├─ Project skills: .hipilot/skills/
    ├─ User skills: ~/.hipilot/skills/
    └─ Built-in skills: {install}/skills/
```

### 7.2 Skill Generation Examples

**From Team Runbook:**

```markdown
Source: how_to_fix_setup_violations.md

Output Skill: fix-setup-timing
  - Parameters: path_group, max_paths, strategies
  - Workflow: Read report → Analyze → Generate Tcl → Execute → Verify
  - Examples: 3-5 examples from runbook
```

**From Email Thread:**

```markdown
Source: ir_drop_fix_email.txt

Output Skill: fix-ir-drop
  - Parameters: region, voltage_threshold, strap_width
  - Workflow: Check IR → Add straps → Verify
  - Examples: Extracted from email discussion
```

**From Forum Post:**

```markdown
Source: hold_timing_fix_forum.html

Output Skill: fix-hold-timing
  - Parameters: path_group, margin, buffer_cell
  - Workflow: Read report → Insert buffers → Verify
  - Examples: Forum post code snippets
```

---

## 8. File Structure

```
@hipilot/knowledge-mcp-server/
├── src/
│   ├── index.ts                    # MCP server entry point
│   ├── tools/
│   │   ├── search-docs.ts          # knowledge.search_docs
│   │   ├── get-command-ref.ts      # knowledge.get_command_ref
│   │   ├── get-methodology.ts      # knowledge.get_methodology
│   │   ├── get-experience.ts       # knowledge.get_experience
│   │   └── generate-skill.ts       # knowledge.generate_skill (Phase 2)
│   ├── ingestion/
│   │   ├── pipeline.ts             # Orchestrates ingestion
│   │   ├── parsers/
│   │   │   ├── pdf-parser.ts
│   │   │   ├── html-parser.ts
│   │   │   ├── manpage-parser.ts
│   │   │   ├── markdown-parser.ts
│   │   │   └── text-parser.ts
│   │   ├── chunker.ts              # Document chunking logic
│   │   └── command-extractor.ts    # Extracts structured command refs
│   ├── skill-gen/                  # Skill generation (Phase 2)
│   │   ├── analyzer.ts             # Analyze source documents
│   │   ├── extractor.ts            # Extract workflow/parameters
│   │   └── generator.ts            # Generate skill markdown
│   ├── retrieval/
│   │   ├── fts-search.ts           # FTS5 search
│   │   ├── command-lookup.ts       # Exact command lookup
│   │   └── hybrid-search.ts        # Combined search + rerank
│   ├── store/
│   │   ├── sqlite-store.ts         # SQLite operations
│   │   └── schema.ts               # Database schema definitions
│   └── config.ts
├── package.json
└── tsconfig.json
```

---

## 9. Platform Compatibility

### CentOS 7 (glibc 2.17)

- **Node.js:** v20.18.3 (glibc-217 build for CentOS 7)
- **SQLite:** 3.35+ (FTS5 support)
- **Testing:** All features tested on EDA server

### Dependencies

| Package | Version | Notes |
|---------|---------|-------|
| Node.js | v20.18.3 | CentOS 7 compatible (glibc-217 build) |
| TypeScript | 5.x | Development |
| better-sqlite3 | 9.x | SQLite binding |
| pdf-parse | 1.x | PDF parsing |
| cheerio | 1.x | HTML parsing |
| remark | 15.x | Markdown parsing |

---

## 10. Testing

### EDA Server Environment

| Item | Value |
|------|-------|
| **Server** | 192.168.112.163 |
| **OS** | CentOS 7.9.2009 (glibc 2.17) |
| **Node.js** | v20.18.3 |

### Test Cases

| Feature | Test Case |
|---------|-----------|
| Document indexing | Index EDA manuals (PDF, HTML) |
| Command lookup | Exact command search |
| Hybrid search | Natural language queries |
| Methodology retrieval | Get workflow guides |
| Team experience search | Search runbooks, FAQs |
| Skill generation | Generate skills from docs (Phase 2) |
| Incremental re-index | Update index when docs change |

### Test Documents

- **EDA Manuals:** ICC2, Innovus, PrimeTime, Tempus
- **Team Docs:** Runbooks, best practices, FAQs
- **Project Docs:** Flow READMEs, known issues
- **Forum Posts:** Timing fixes, DRC solutions

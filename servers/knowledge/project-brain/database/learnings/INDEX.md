---
type: project-brain
scope: dynamic
---

# Project Brain Learnings

This directory contains learned patterns from completed projects using the PageIndex approach.

## Tree Structure

```
learnings/
├── error-patterns/      # Common errors and their solutions
├── success-patterns/    # What worked well across projects
└── project-notes/       # Per-project insights and retrospectives
```

## Query Interface

Use `projectBrain.queryLearnings(path)` to navigate the tree:

- `error-patterns/innovus/lef-loading` - LEF file loading errors
- `success-patterns/placement/congestion` - Successful congestion fixes
- `project-notes/ibex-demo/cts` - CTS insights from ibex demo

## PageIndex vs SQLite

| Data Type | Storage | Query Method |
|-----------|---------|--------------|
| QoR metrics (WNS, TNS, area) | SQLite | SQL queries |
| Error logs with resolutions | SQLite | SQL + text search |
| Checkpoint paths | SQLite | SQL queries |
| Pattern learnings | PageIndex | Tree navigation |
| Success strategies | PageIndex | Tree navigation |
| Project retrospectives | PageIndex | Tree navigation |

## Adding New Learnings

1. Create markdown files in appropriate subdirectory
2. Use frontmatter with `type` and `tags` for filtering
3. Link related SQLite records by ID when applicable

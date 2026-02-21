# /history - Show Session History

Display the Tcl commands sent during this HiPilot session.

## Usage
```
/history
```

## What This Command Does

When the user runs `/history`, you should:

1. **Query session history** - Use `eda.get_status` or check `.hipilot/history/` for executed commands
2. **Display command list** - Show each command with:
   - Sequence number
   - Timestamp
   - Command type (template-based, doc-based, or manual)
   - Brief description
   - Execution status (success/failed)
3. **Show context** - Optionally show what prompted each command

## Output Format

Present the history in a clear timeline:

```
## Session History

**Session Started:** [timestamp]
**Total Commands:** XX

### Command Timeline

| # | Time | Command | Source | Status |
|---|------|---------|--------|--------|
| 1 | 10:30:15 | `/timing reg2reg` | Quick Command | ✅ Success |
| 2 | 10:32:45 | `fix setup timing` | Skill | ✅ Success |
| 3 | 10:35:22 | Generated Tcl: size_cell ... | Template | ✅ Executed |
| 4 | 10:36:10 | `/drc` | Quick Command | ⚠️ Warnings |
| 5 | 10:38:55 | Generated Tcl: ecoChangeCell ... | Doc-based | 🔴 Error |

### Recent Commands Detail

**Command #5 (Most Recent)**
- **Type:** Doc-based generation
- **Intent:** Fix DRC metal spacing violations
- **Generated Tcl:**
  ```tcl
  ecoChangeCell -inst u_buf_1 -cell BUF_X4
  ```
- **Status:** ❌ Error - Cell not found in library
- **Next Step:** User corrected to BUF_X8

### Statistics
- **Template-based:** XX commands (XX%)
- **Doc-based:** XX commands (XX%)
- **Manual:** XX commands (XX%)
- **Success Rate:** XX%

### Available Actions
- Re-run a command: "rerun command #3"
- View full Tcl: "show tcl for command #3"
- Export history: "export history to file"
```

## MCP Tools Used
- `eda.get_status` - Get current session status
- `eda.get_pending` - Check for pending commands

## Notes
- History is maintained per-session
- Commands are stored in `.hipilot/history/` with timestamps
- Failed commands are marked for debugging
- Use history to understand what worked and what didn't

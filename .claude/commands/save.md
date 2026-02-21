Save Tcl script to the project scripts directory.

Usage: /save [filename]

This command uses the `eda.save_tcl` MCP tool to save Tcl content for later use.

Steps:
1. Saves the pending Tcl (or generates new Tcl if none pending)
2. Creates ./scripts/ directory if it doesn't exist
3. Auto-generates timestamped filename if none provided
4. Returns the full path to the saved file

Arguments:
- filename (optional): Custom filename (default: auto-generated with timestamp)

Examples:
- /save                    # Save with auto-generated filename
- /save "floorplan.tcl"    # Save with specific name

Saved Location:
- Default: ./scripts/hipilot_YYYYMMDD_HHMMSS.tcl
- The scripts/ directory is created automatically if needed

Tips:
- Save important Tcl before executing to preserve working versions
- Use descriptive filenames for complex procedures
- Saved scripts can be reused across sessions

Edit pending or generated Tcl in $EDITOR before execution.

Usage: /edit [description]

This command uses the `eda.edit_tcl` MCP tool to open Tcl content in your preferred editor.

Steps:
1. If there's pending Tcl in the queue, it will be opened for editing
2. Otherwise, generates Tcl from context and opens it for editing
3. Opens content in $EDITOR (defaults to 'vi' if not set)
4. After you save and exit, the edited content becomes the new pending Tcl
5. Use /execute or approve to run the edited Tcl

Arguments:
- description (optional): What you're trying to accomplish (helps generate context)

Examples:
- /edit                    # Edit the pending Tcl
- /edit "fix clock buffer" # Generate and edit Tcl for clock buffer fix

Environment:
- Set $EDITOR to customize your editor (e.g., export EDITOR=vim)
- Editor has a 5-minute timeout to prevent hanging

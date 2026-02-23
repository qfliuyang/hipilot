# HiPilot Documentation Index

**Latest Documentation - Version 0.5.0**

**Last Updated:** 2026-02-24

---

## Quick Navigation

| Document | Purpose | Audience |
|----------|---------|----------|
| [README.md](README.md) | Project overview and introduction | Everyone |
| [QUICK_START.md](QUICK_START.md) | Get started in 10 minutes | New users |
| [ARCHITECTURE.md](ARCHITECTURE.md) | System design and components | Developers |
| [SKILLS_GUIDE.md](SKILLS_GUIDE.md) | All 35 skills documented | Users |
| [MCP_SERVERS.md](MCP_SERVERS.md) | MCP integration reference | Developers |
| [RTL2GDS_FLOW.md](RTL2GDS_FLOW.md) | Complete flow execution guide | EDA engineers |
| [EDA_SERVER_SETUP.md](EDA_SERVER_SETUP.md) | Server configuration | Administrators |
| [DEPLOY_GUIDE.md](DEPLOY_GUIDE.md) | Installation & deployment | Everyone |

---

## By User Type

### For First-Time Users

1. **Start Here:** [README.md](README.md) - Understand what HiPilot is
2. **Then:** [QUICK_START.md](QUICK_START.md) - Get running quickly
3. **Reference:** [SKILLS_GUIDE.md](SKILLS_GUIDE.md) - Learn available skills

### For EDA Engineers

1. **Understand:** [README.md](README.md) - Capabilities overview
2. **Execute Flow:** [RTL2GDS_FLOW.md](RTL2GDS_FLOW.md) - Run complete flow
3. **Reference:** [SKILLS_GUIDE.md](SKILLS_GUIDE.md) - Skill details

### For Developers

1. **Architecture:** [ARCHITECTURE.md](ARCHITECTURE.md) - System design
2. **MCP Integration:** [MCP_SERVERS.md](MCP_SERVERS.md) - API reference
3. **Extend:** [SKILLS_GUIDE.md](SKILLS_GUIDE.md) - Create custom skills

### For Administrators

1. **Deploy:** [DEPLOY_GUIDE.md](DEPLOY_GUIDE.md) - Installation methods
2. **Setup:** [EDA_SERVER_SETUP.md](EDA_SERVER_SETUP.md) - Server config
3. **Troubleshoot:** [EDA_SERVER_SETUP.md](EDA_SERVER_SETUP.md#troubleshooting) - Common issues

---

## Document Details

### README.md
- Project introduction
- Key capabilities
- Quick start guide
- Architecture overview
- Skills summary

### QUICK_START.md
- Prerequisites check
- Installation steps
- MCP configuration
- First commands
- Troubleshooting

### ARCHITECTURE.md
- System overview diagram
- Component details
- Data flow
- Mode system
- Security model
- File system layout

### SKILLS_GUIDE.md
- 35 skills documented
- RTL-to-GDS flow skills
- Timing analysis skills
- Design management skills
- MCP command examples
- Creating custom skills

### MCP_SERVERS.md
- EDA MCP Server (11 tools)
- Tmux MCP Server (7 tools)
- Knowledge MCP Server (4 tools)
- MCP wrapper script usage
- API reference

### RTL2GDS_FLOW.md
- Complete flow stages
- MCP commands for each stage
- Makefile equivalence
- Expected outputs
- Verification steps
- Common issues

### EDA_SERVER_SETUP.md
- Server information
- Node.js setup (glibc-217)
- tmux configuration
- EDA tools available
- HiPilot installation
- Workspace setup

### DEPLOY_GUIDE.md
- npm installation
- Clone and build method
- Docker deployment
- EDA server deployment
- Configuration reference
- Troubleshooting

---

## Additional Resources

### In Project Root

| File | Purpose |
|------|---------|
| [CLAUDE.md](../CLAUDE.md) | Context for Claude Code |
| [CHANGELOG.md](../CHANGELOG.md) | Version history |
| [package.json](../package.json) | Dependencies and scripts |

### In docs/ Directory

| Directory | Contents |
|-----------|----------|
| `specs/` | MCP server specifications |
| `guides/` | Skill authoring guide |
| `plans/` | Architecture design |

### Evidence

| Directory | Contents |
|-----------|----------|
| `e2e_evidence/` | Real flow execution evidence |
| `skills/` | 35 skill definitions |

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 0.5.0 | 2026-02-24 | Added 8 new RTL-to-GDS flow skills |
| 0.4.0 | 2026-02-23 | Complete RTL-to-GDS flow execution |
| 0.3.0 | 2026-02-22 | MCP wrapper script |
| 0.2.0 | 2026-02-21 | Skills system |
| 0.1.0 | 2026-02-18 | Initial release |

---

## Getting Help

1. **Check documentation:** Use this index to find relevant docs
2. **Review evidence:** See `e2e_evidence/` for real examples
3. **GitHub Issues:** https://github.com/qfliuyang/hipilot/issues

---

**Documentation Version:** 1.0
**Project Version:** 0.5.0
**Last Updated:** 2026-02-24

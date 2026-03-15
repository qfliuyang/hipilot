---
title: EDA License Management
description: License server management and common issues
---

# EDA License Management

License management for EDA tools from Cadence, Synopsys, and other vendors.

## Overview

EDA tools typically use FlexNet (FLEXlm) license servers. Understanding license management is crucial for:

- Tool availability
- Queue management
- License optimization
- Troubleshooting

## Navigation

| Topic | File |
|-------|------|
| Common Issues | [common-issues.md](common-issues.md) |

## License Server Components

### Server Machine

- Runs `lmgrd` (license manager daemon)
- Hosts license file
- Serves licenses to clients

### License File

Contains:
- SERVER line (hostname, hostid, port)
- VENDOR lines (daemon paths)
- FEATURE lines (license features)

### Client Tools

- Connect to server via `LM_LICENSE_FILE` env var
- Check out licenses as needed

## Environment Variables

| Variable | Purpose |
|----------|---------|
| `LM_LICENSE_FILE` | License server port@host |
| `SNPSLMD_LICENSE_FILE` | Synopsys-specific |
| `CDS_LIC_FILE` | Cadence-specific |

## Common Commands

```bash
# Check license status
lmstat -a -c port@host

# Check specific feature
lmstat -f Innovus -c port@host

# Check server status
lmutil lmstat -c port@host
```

## Vendor-Specific Notes

### Synopsys

- Daemon: `snpslmd`
- Common features: Design-Compiler, PrimeTime, ICC2

### Cadence

- Daemon: `cdslmd`
- Common features: Innovus, Genus, Tempus

## Related Tools

| Tool | License Feature |
|------|-----------------|
| Innovus | Innovus |
| Design Compiler | Design-Compiler |
| PrimeTime | PrimeTime |
| ICC2 | IC-Compiler-II |

# HiPilot Team Testing Protocol v1.0

**Date:** 2026-03-15
**Status:** Active
**Purpose:** Strict anti-cheat enforcement for team-based HiPilot certification testing

---

## Overview

This protocol governs how team-based testing MUST be conducted to achieve HiPilot certification. It enforces the Anti-Cheat Charter (R1-R12) and ensures all evidence is legitimate, verifiable, and created on the EDA server.

---

## Pre-Test Requirements (ALL Must Pass)

### 1. EDA Server Accessibility
- [ ] SSH access to `EDA@192.168.112.163` confirmed working
- [ ] Password `eda2020` verified
- [ ] Desktop display `:0` accessible for VNC/screenshots

### 2. Fresh Evidence Directory on EDA Server
```bash
# MUST create directory on EDA server, not locally
ssh EDA@192.168.112.163 "mkdir -p /home/EDA/hipilot_test/runs/$(date +%Y%m%d_%H%M%S)"
```
- [ ] Directory created on EDA server (`/home/EDA/hipilot_test/runs/`)
- [ ] Directory is timestamped (`YYYYMMDD_HHMMSS`)
- [ ] Directory is writable by test user

### 3. Visual Confirmation Setup
- [ ] gnome-terminal will be opened on EDA server desktop
- [ ] ffmpeg recording will capture display `:0`
- [ ] Screenshots will be taken at key moments

---

## Phase-by-Phase Testing Requirements

### Phase 0: Environment Setup (REQUIRED: 5-10 minutes)

**Minimum Duration:** 5 minutes

**Visual Confirmation Checklist:**
- [ ] Screenshot showing tmux session with 6 panes
- [ ] Video shows tmux window creation sequence
- [ ] Pane logs show actual tmux initialization

**Anti-Cheat Verification:**
```javascript
// Leader MUST verify before proceeding
cheatDetector.verifyEvidenceLocation('/home/EDA/hipilot_test/runs/...');
cheatDetector.verifyDesktopVisibility('screenshot_workspace.png');
cheatDetector.verifyActiveVideoStream(ffmpegPid, 'video.mp4');
```

**Remote Verification Command:**
```bash
# Leader MUST run this before approving Phase 0
ssh EDA@192.168.112.163 "ls -la /home/EDA/hipilot_test/runs/[TIMESTAMP]/"
```

### Phase 1-5: Agent Testing (REQUIRED: 10-30 minutes each)

**Minimum Duration per Phase:** 10 minutes

**For Each Phase:**
1. Tester executes commands on EDA server via SSH
2. Tester captures evidence directly on EDA server
3. Leader verifies via SSH before approving completion

**Visual Confirmation Requirements:**
- [ ] Screenshot of active tmux session with agent output
- [ ] Video segment showing agent interaction
- [ ] Pane log showing actual command execution

**Anti-Cheat Gates:**
- Evidence path must contain `/home/EDA/`
- File timestamps must be within test window
- Video file must be growing (active recording)
- Test duration must exceed minimum threshold

### Phase 6-8: E2E Flow Testing (REQUIRED: 30-120 minutes each)

**Minimum Duration per Phase:** 30 minutes

**Critical Anti-Cheat Requirements:**
- [ ] EDA tool (Innovus/DC Shell) visibly running on desktop
- [ ] Actual Tcl commands sent to tool visible in pane
- [ ] QoR metrics extracted from real tool output
- [ ] Checkpoints created on EDA server filesystem

**Verification Sequence:**
```javascript
// After each phase, leader MUST:
1. SSH to EDA server and verify checkpoint exists
2. Check video is still recording and growing
3. Verify pane logs show actual EDA tool output
4. Confirm minimum duration threshold met
5. Only then mark phase complete
```

---

## Real-Time Anti-Cheat Monitoring

### Leader Responsibilities

The team leader MUST:

1. **Verify Before Each Phase Completion:**
   ```javascript
   await cheatDetector.verifyRemoteEvidenceExists(
     '192.168.112.163', 'EDA',
     `/home/EDA/hipilot_test/runs/${testId}/`
   );
   ```

2. **Reject Instant Completions:**
   - Any phase completed in < 5 minutes = AUTO-REJECT
   - Any phase 6-8 completed in < 30 minutes = AUTO-REJECT
   - Full flow (8 phases) completed in < 2 hours = AUTO-REJECT

3. **Require Visual Evidence:**
   - Desktop screenshot showing tmux session
   - Video recording of active test
   - Pane logs with actual command output

4. **Verify Location:**
   - Evidence path must start with `/home/EDA/`
   - Local paths (`/Users/`, `C:\`) = AUTO-REJECT

### Tester Responsibilities

Each tester MUST:

1. **Execute on EDA Server:**
   ```bash
   # CORRECT: All commands run on EDA server
   ssh EDA@192.168.112.163 "cd /home/EDA/hipilot_test/runs/... && ./run_test.sh"
   ```

2. **Capture Evidence on EDA Server:**
   ```bash
   # CORRECT: Screenshots saved to EDA server
   ssh EDA@192.168.112.163 "import -window root /home/EDA/hipilot_test/runs/.../screenshot.png"
   ```

3. **Use Timestamped Directories:**
   ```bash
   # CORRECT: Fresh directory for each test
   /home/EDA/hipilot_test/runs/phase3_20260315_143022/
   ```

4. **Report Real Durations:**
   - Report actual time taken
   - Do NOT mark complete until actually finished
   - If stuck, report blocked status

---

## Anti-Cheat Violation Responses

### Critical Violations (Immediate Rejection)

| Violation | Response |
|-----------|----------|
| Evidence on local machine | REJECT, require EDA server path |
| Test completed too quickly | REJECT, restart with minimum duration |
| No desktop screenshot | REJECT, require visual confirmation |
| Video not recording | REJECT, restart with active ffmpeg |
| Stale evidence reused | REJECT, permanent ban from testing |
| Simulated/fake output | REJECT, mark CHEAT_DETECTED |

### Warning Violations (Require Additional Verification)

| Violation | Response |
|-----------|----------|
| SSH verification slow | Allow retry with extended timeout |
| File timestamps borderline | Require additional evidence |
| Video quality low | Require additional screenshots |

---

## Post-Test Verification Protocol

### Step 1: SSH Evidence Listing
```bash
ssh EDA@192.168.112.163 "find /home/EDA/hipilot_test/runs/${TEST_ID} -type f -ls"
```

### Step 2: Video Verification
```bash
ssh EDA@192.168.112.163 "ffprobe -v error -count_frames -select_streams v:0 -show_entries stream=nb_read_frames -of csv=s=x:p=0 /home/EDA/hipilot_test/runs/${TEST_ID}/video.mp4"
```

### Step 3: Timeline Correlation
```bash
# Verify all evidence timestamps align with test window
ssh EDA@192.168.112.163 "stat /home/EDA/hipilot_test/runs/${TEST_ID}/*"
```

### Step 4: Final Cheat Detection
```javascript
const results = await cheatDetector.runFullVerification({
  paneText: claudePaneLog,
  mcpLogPath: '/home/EDA/hipilot_test/runs/.../mcp_calls.jsonl',
  videoPath: '/home/EDA/hipilot_test/runs/.../video.mp4',
  evidenceFiles: [...],
});

// NEW: Additional verification layers
cheatDetector.verifyEvidenceLocation('/home/EDA/hipilot_test/runs/...');
cheatDetector.verifyMinimumDuration(startTime, endTime, 30);
cheatDetector.verifyDesktopVisibility('desktop_screenshot.png');
await cheatDetector.verifyRemoteEvidenceExists('192.168.112.163', 'EDA', '/home/EDA/hipilot_test/runs/...');
cheatDetector.verifyActiveVideoStream(ffmpegPid, 'video.mp4');
```

---

## Success Criteria for Certification

### Bronze Certification (GPA ≥ 2.0)
- [ ] All evidence on EDA server
- [ ] Minimum duration thresholds met
- [ ] No critical anti-cheat violations

### Silver Certification (GPA ≥ 2.5)
- [ ] Bronze criteria met
- [ ] Visual confirmation for all phases
- [ ] Remote SSH verification passed

### Gold Certification (GPA ≥ 3.0)
- [ ] Silver criteria met
- [ ] Active video recording verified
- [ ] All 5 agents visible on desktop

### Platinum Certification (GPA ≥ 3.5)
- [ ] Gold criteria met
- [ ] Full RTL2GDS flow completed
- [ ] Mission targets achieved
- [ ] Zero anti-cheat warnings

---

## Quick Reference: Cheat Detection Response

```javascript
// When tester reports completion:
const verification = {
  location: cheatDetector.verifyEvidenceLocation(path),
  duration: cheatDetector.verifyMinimumDuration(start, end, 10),
  desktop: cheatDetector.verifyDesktopVisibility(screenshot),
  remote: await cheatDetector.verifyRemoteEvidenceExists(host, user, path),
  video: cheatDetector.verifyActiveVideoStream(pid, videoPath),
};

// ANY verification fails = REJECT
if (Object.values(verification).some(v => !v.valid)) {
  return { approved: false, reason: 'ANTI-CHEAT VIOLATION' };
}

// ALL pass = APPROVE
return { approved: true, tier: calculateTier(scores) };
```

---

## Document History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2026-03-15 | Initial protocol with 13-layer anti-cheat detection |

---

**REMEMBER:** When in doubt, REJECT and require additional verification. The integrity of HiPilot certification depends on real, verifiable testing on the EDA server.

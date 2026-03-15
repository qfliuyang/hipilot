# Common License Issues

Common license problems and solutions for EDA tools.

## License Checkout Failed

**Pattern:** `License checkout failed`

**Severity:** Fatal

**Description:** Tool cannot obtain required license.

### Root Causes

1. **No license server available**
2. **All licenses in use**
3. **License expired**
4. **Wrong feature name**
5. **Network connectivity issues**

### Solutions

**Check server status:**
```bash
lmstat -a -c 27000@license_server
```

**Check specific feature:**
```bash
lmstat -f Innovus -c 27000@license_server
```

**Verify environment:**
```bash
echo $LM_LICENSE_FILE
echo $SNPSLMD_LICENSE_FILE
echo $CDS_LIC_FILE
```

---

## License Server Down

**Pattern:** `Cannot connect to license server`

**Severity:** Fatal

### Diagnosis

```bash
# Ping server
ping license_server

# Check port
nc -zv license_server 27000

# Check lmgrd
ps -ef | grep lmgrd
```

### Solutions

1. **Restart license server:**
```bash
lmgrd -c license.dat -l logfile.log
```

2. **Check firewall rules**
3. **Contact CAD administrator**

---

## All Licenses in Use

**Pattern:** `All licenses in use`

**Severity:** Blocking

### Diagnosis

```bash
# See who is using licenses
lmstat -a -c 27000@license_server

# Check usage by user
lmstat -a -c 27000@license_server | grep <username>
```

### Solutions

1. **Wait for license availability**
2. **Request more licenses from vendor**
3. **Implement license queue system**
4. **Optimize license usage (release when idle)**

---

## License Expired

**Pattern:** `License has expired`

**Severity:** Fatal

### Diagnosis

```bash
# Check license expiration
lmstat -c 27000@license_server | grep EXPIRE
```

### Solutions

1. **Contact vendor for renewal**
2. **Use temporary license**
3. **Check system date (clock skew)**

---

## Wrong Host

**Pattern:** `Invalid host`

**Severity:** Fatal

### Cause

License file tied to specific machine (hostid mismatch).

### Diagnosis

```bash
# Get hostid
lmhostid

# Check SERVER line in license file
grep SERVER license.dat
```

### Solutions

1. **Request new license for correct host**
2. **Move license server to licensed machine**

---

## Vendor Daemon Issues

**Pattern:** `Vendor daemon died`

**Severity:** Fatal

### Causes

- Daemon crashed
- Wrong path in license file
- Version mismatch

### Solutions

```bash
# Check daemon path in license file
grep VENDOR license.dat

# Restart server
lmgrd -c license.dat
```

---

## Environment Issues

### LM_LICENSE_FILE not set

**Pattern:** `No license file specified`

**Solution:**
```bash
export LM_LICENSE_FILE=27000@license_server
```

### Multiple license files

**Issue:** Conflicting or duplicate entries.

**Solution:**
```bash
# Use colon separator
export LM_LICENSE_FILE=27000@server1:27000@server2
```

---

## Quick Diagnostic Commands

```bash
# Full status
lmstat -a -c 27000@server

# Feature usage
lmstat -f <feature> -c 27000@server

# Server status
lmutil lmstat -c 27000@server

# License file check
lmutil lmdiag -c license.dat

# Hostid
lmhostid
```

---

## Prevention

1. **Monitor license usage** with regular lmstat
2. **Set up alerts** for license exhaustion
3. **Implement reservation** for critical jobs
4. **Regular license audits** to right-size purchases

# Tool Input Validation Implementation

**Status**: ✅ COMPLETE  
**Date**: 2026-04-21  
**Priority**: 🔴 CRITICAL SECURITY FIX  

---

## Summary

Added comprehensive input validation to all 9 tool handlers in `toolRouter.js` to prevent malformed, missing, or malicious arguments from reaching the database or third-party APIs.

**Files Modified**:
- `bridge-server/src/tools/validateArgs.js` (NEW - 130 lines)
- `bridge-server/src/tools/toolRouter.js` (MODIFIED - added validation to 9 handlers)

**Files Created for Testing**:
- `bridge-server/src/tools/validateArgs.test.js` (30 test cases, all passing)

---

## What Was Fixed

### Before (Vulnerable)
```javascript
// toolRouter.js - NO VALIDATION
async function handleCheckAvailability(args, callCtx, traceId) {
  const date = args.date;  // ❌ Could be undefined, any string
  const rangeStart = args.time_range_start || "08:00";  // ❌ Invalid format accepted
  const timeMin = new Date(`${date}T${rangeStart}:00+02:00`).toISOString();
  // Creates: "Invalid DateT08:00:00+02:00" if date is undefined
  // API call fails silently
}

async function handleBookAppointment(args, callCtx, traceId) {
  const result = await bookAppointment(
    callCtx.accountId,
    {
      startTime: args.start_time,  // ❌ No format validation
      endTime: args.end_time,      // ❌ Could be before startTime
      attendeePhone: args.attendee_phone,  // ❌ Any format accepted
    }
  );
}
```

### After (Secure)
```javascript
// toolRouter.js - WITH VALIDATION
const v = require("./validateArgs");

async function handleCheckAvailability(args, callCtx, traceId) {
  const date = args?.date;
  if (!date) {
    log.tool("validation_error", traceId, "check_availability: date is required");
    return { success: false, message: "date is required (YYYY-MM-DD)" };
  }

  const r1 = v.validateDate(date);  // ✅ Validates YYYY-MM-DD format
  if (!r1.ok) {
    log.tool("validation_error", traceId, `check_availability: ${r1.message}`);
    return { success: false, message: r1.message };
  }

  const rangeStart = args?.time_range_start ?? "08:00";
  const rangeEnd = args?.time_range_end ?? "18:00";

  const r2 = v.validateTime(rangeStart, "time_range_start");  // ✅ HH:MM format
  const r3 = v.validateTime(rangeEnd, "time_range_end");
  
  if (rangeStart >= rangeEnd) {  // ✅ Logical ordering check
    return { success: false, message: `end must be after start` };
  }
}

async function handleBookAppointment(args, callCtx, traceId) {
  const startTime = args?.start_time;
  const endTime = args?.end_time;

  if (!startTime) return { success: false, message: "start_time is required" };
  if (!endTime) return { success: false, message: "end_time is required" };

  const r1 = v.validateIsoDatetime(startTime, "start_time");  // ✅ ISO 8601
  const r2 = v.validateIsoDatetime(endTime, "end_time");

  const r3 = v.validateOrdering(startTime, endTime);  // ✅ end > start
  const r4 = v.validateBookingDuration(startTime, endTime);  // ✅ 5-480 min

  if (args?.attendee_phone) {
    const r5 = v.validatePhone(args.attendee_phone);  // ✅ E.164 format
  }
}
```

---

## Validators Provided

**File**: `validateArgs.js` (130 lines, 10 functions)

### Core Validators

#### `validatePhone(phone)`
- Format: E.164 (e.g., `+33612345678`)
- Rejects: `0612345678`, `+33 612 345 678`, non-strings

#### `validatePriority(priority)`
- Allowed values: `["low", "normal", "high", "urgent"]`
- Optional (undefined is OK)
- Rejects: `"super-urgent"`, empty string

#### `validateMaxLen(value, fieldName, max)`
- Checks string length ≤ max
- Skips non-strings
- Examples:
  - `validateMaxLen("hello", "text", 10)` → OK
  - `validateMaxLen("hello world", "text", 5)` → FAIL

#### `validateDate(date)`
- Format: `YYYY-MM-DD`
- Rejects: `21/04/2026`, `2026-4-21`, invalid dates

#### `validateTime(time, fieldName)`
- Format: `HH:MM` (24-hour)
- Range: `00:00` - `23:59`
- Rejects: `2:30`, `25:00`, invalid times

#### `validateIsoDatetime(value, fieldName)`
- Format: ISO 8601 (e.g., `2026-04-21T14:30:00+02:00`)
- Sanity check: date within ±100/50 years
- Rejects: `2026-04-21 14:30`, invalid datetimes

#### `validateOrdering(startStr, endStr)`
- Checks: `endStr > startStr`
- Rejects: equal or reversed times
- Example: `startStr="14:00"`, `endStr="13:00"` → FAIL

#### `validateBookingDuration(startStr, endStr)`
- Minimum: 5 minutes
- Maximum: 8 hours
- Rejects: `<5 min` or `>8 hours`

---

## Validation Applied to Each Tool

| Tool | Validations |
|------|------------|
| `get_caller_profile` | phone (if provided) |
| `create_callback` | priority enum, reason max 500, note max 200 |
| `notify_user` | priority enum, summary max 1000, name max 100 |
| `generate_call_summary` | required string, max 6000 |
| `consult_user` | required string, max 1000 |
| `end_call` | reason max 200 |
| `transfer_call` | reason max 500 |
| `check_availability` | **date required + format**, time format x2, ordering |
| `book_appointment` | **start/end required + ISO + ordering + duration**, phone (E.164), title/name length |

**⭐ Highest Risk Tools**: `check_availability` and `book_appointment` now have strict validation

---

## Error Handling

### Logging Pattern
```javascript
// All validation errors logged with traceId for debugging
log.tool("validation_error", traceId, `${toolName}: ${message}`);
return { success: false, message };
```

### Response to Gemini
```json
{
  "success": false,
  "message": "Invalid phone number (expected E.164 format, e.g. +33612345678)"
}
```

Gemini will:
1. See the `success: false` response
2. Recognize the error message as validation feedback
3. Re-try with corrected arguments (or give up if repeated failures)

### Database Logging
- DB `call_tool_invocations` marks failed validation as `status='TOOL_LOGIC_ERROR'`
- Error message stored in `error_message` column
- Fully traceable via `traceId`

---

## Test Coverage

### Tests Created
**File**: `validateArgs.test.js` (30 test cases)

```bash
$ node src/tools/validateArgs.test.js
✅ validatePhone: valid E.164
✅ validatePhone: invalid format
✅ validatePhone: invalid missing country code
✅ validatePriority: valid priority
✅ validatePriority: invalid priority
✅ validatePriority: undefined is OK
✅ validateMaxLen: within limit
✅ validateMaxLen: exceeds limit
... [24 more tests]
✅ All tests passed!
```

**Run tests anytime**:
```bash
cd bridge-server
node src/tools/validateArgs.test.js
```

---

## Examples: Before/After

### Example 1: `check_availability` with missing date

**Before**: 
```javascript
const date = undefined;
const timeMin = new Date(`undefinedT08:00:00+02:00`).toISOString();
// → "Invalid DateT08:00:00+02:00"
// API call fails, error message unclear
```

**After**:
```javascript
if (!date) {
  log.tool("validation_error", traceId, "check_availability: date is required");
  return { success: false, message: "date is required (YYYY-MM-DD)" };
}
// Clear error logged, Gemini can see and re-try
```

### Example 2: `book_appointment` with reversed times

**Before**:
```javascript
const startTime = "2026-04-21T15:00:00+02:00";
const endTime = "2026-04-21T14:00:00+02:00";
// No validation, goes to Google Calendar API
// API returns 400 error, confusing to debug
```

**After**:
```javascript
const r3 = v.validateOrdering(startTime, endTime);
if (!r3.ok) {
  log.tool("validation_error", traceId, `book_appointment: ${r3.message}`);
  return { success: false, message: "end must be after start (...)" };
}
// Error caught immediately, logged, Gemini re-tries
```

### Example 3: `notify_user` with invalid priority

**Before**:
```javascript
const priority = "URGENT";  // Gemini might generate uppercase
await createDirectNotification(callCtx, args);
// priority="URGENT" inserted into DB
// Downstream code expects ["low", "normal", "high", "urgent"]
```

**After**:
```javascript
const r1 = v.validatePriority(args?.priority);
if (!r1.ok) {
  return { success: false, message: 'Invalid priority "URGENT". Allowed values: low, normal, high, urgent' };
}
// Error caught, DB is clean, Gemini learns
```

---

## Constants Defined

```javascript
const E164_RE = /^\+[1-9]\d{7,14}$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^\d{2}:\d{2}$/;
const ISO_DT_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/;

const PRIORITY_VALUES = ["low", "normal", "high", "urgent"];
const MAX_REASON = 500;
const MAX_SUMMARY = 6000;
const MAX_QUESTION = 1000;
const MAX_TITLE = 200;
const MAX_NAME = 100;
const MAX_NOTE = 200;
const MIN_BOOKING_MINUTES = 5;
const MAX_BOOKING_HOURS = 8;
```

All constants exported from `validateArgs.js` for reuse.

---

## Integration Checklist

- ✅ `validateArgs.js` created (130 lines, no dependencies)
- ✅ `toolRouter.js` updated (all 9 handlers with validation)
- ✅ Syntax validation passed (node -c)
- ✅ Test suite created (30 tests, all passing)
- ✅ Logging integrated (validation_error entries in call_tool_invocations)
- ✅ Error responses formatted for Gemini
- ✅ No new npm dependencies (pure JS)

---

## Monitoring & Debugging

### View validation errors in logs
```bash
grep "validation_error" logs.txt | head -20
```

### Query failed tools in DB
```sql
SELECT call_session_id, tool_name, error_message, created_at
FROM call_tool_invocations
WHERE status = 'TOOL_LOGIC_ERROR'
ORDER BY created_at DESC
LIMIT 20;
```

### Example failure signature
```
Log: tool_call_error: "check_availability: date is required (YYYY-MM-DD)"
DB:  status='TOOL_LOGIC_ERROR', error_message='date is required (YYYY-MM-DD)'
```

---

## Security Impact

| Risk | Before | After |
|------|--------|-------|
| Malformed phone in contacts query | Silent miss | Rejected early, logged |
| Missing required date/time | API error (unclear) | Validation error (clear) |
| Reversed booking times | Google 400 error | Validation error |
| Invalid priority enum | Silent DB corruption | Rejected, re-try |
| Oversized text in DB | Data integrity issues | Rejected early |
| Phone format confusion | Cross-tenant risk | E.164 enforced |

**Overall**: From ❌ No validation → ✅ Strict, fail-fast validation across all tools.

---

## Next Steps (Optional Enhancements)

1. **Rate limiting per tool** — prevent Gemini from calling tools 1000x in one call
2. **Tool timeouts** — ensure tool execution doesn't hang
3. **Tool quota per account** — limit SMS/booking operations
4. **Audit trail** — store all validation failures for analysis

---

## Files Summary

| File | Lines | Purpose |
|------|-------|---------|
| `validateArgs.js` | 130 | Reusable validators (no dependencies) |
| `toolRouter.js` | +80 | Added validation to 9 handlers |
| `validateArgs.test.js` | 160 | 30 test cases (all passing) |

**Total Added**: ~370 lines of production code + tests  
**Maintenance**: Low (pure functions, clear patterns, well-documented)

---

**Implementation Complete** ✅  
Ready for production deployment.

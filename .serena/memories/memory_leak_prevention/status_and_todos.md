# Memory Leak Prevention - Status & TODO

## ✅ Completed (April 22, 2026)

**Implementation**: Automatic call state cleanup to prevent memory leaks in callStateStore

### What was implemented:
1. **Timestamp tracking**: `createdAt` + `lastActivityTime` added to CallContext
2. **Automatic cleanup timer**: Runs every 5min, removes calls inactive >60min
3. **Error-safe finalization**: Try-finally in all 3 connection handlers
4. **Monitoring endpoint**: GET `/debug/call-stats` for inspecting active calls
5. **New methods in callStateStore**: `touch()`, `getStats()`, `stopCleanupTimer()`
6. **Tests**: 5 integration tests in `callStateStore.test.js` (all passing)
7. **Documentation**: MEMORY_LEAK_FIX.md with full implementation details

### Risk reduction:
- **Before**: Stale calls stuck in memory forever (HIGH risk)
- **After**: Auto-cleanup every 5min (MEDIUM risk)
- Finalization errors no longer prevent removal (try-finally)

### Files modified:
- bridge-server/src/calls/callContext.js
- bridge-server/src/calls/callStateStore.js
- bridge-server/src/twilio/twilioConnection.js
- bridge-server/src/web/webCallHandler.js
- bridge-server/src/outbound/outboundStreamHandler.js
- bridge-server/src/index.js

### Commit: 192c993
"Implement memory leak prevention with automatic call state cleanup"

---

## 📋 TODO Items (For Next Session)

### 1. **Production testing & monitoring** (PRIORITY: HIGH)
**What**: Verify cleanup works in production environment
- [ ] Deploy to staging/prod
- [ ] Monitor `/debug/call-stats` endpoint for 1-2 days
- [ ] Check logs for "cleanup_summary" entries (should see every 5min)
- [ ] Verify no accumulation of stale calls
- [ ] Document actual cleanup rates observed

**Context**: Cleanup interval is configurable in callStateStore.js:
```javascript
const CLEANUP_TIMEOUT_MS = 60 * 60 * 1000;      // 60 minutes
const CLEANUP_CHECK_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
```

**For dev/staging** (faster feedback): Change to 5-10 min timeout

### 2. **Adjust timeout based on production load** (PRIORITY: MEDIUM)
**What**: Tune cleanup timeout based on observed call patterns
- [ ] Analyze how many calls typically stay active >60 min (legitimate long calls)
- [ ] If many legitimate long calls: increase timeout to 90-120 min
- [ ] If many dropped connections observed: reduce to 30 min
- [ ] Set appropriate timeout in production config

**Decision points**:
- Too short timeout (30min): May kill legitimate long calls
- Too long timeout (120min): High peak memory during traffic spikes
- Sweet spot: Depends on your call patterns (need to observe)

### 3. **Export metrics to observability platform** (PRIORITY: MEDIUM)
**What**: Wire up cleanup metrics to Datadog/CloudWatch/etc
- [ ] Export `activeCallCount` metric every minute
- [ ] Export `cleanupCount` metric after each cycle
- [ ] Alert if activeCallCount exceeds threshold (e.g., 50)
- [ ] Alert if cleanupCount drops (indicates problem)

**Why**: Manual endpoint checking won't scale; need continuous monitoring

### 4. **Improve logging for debugging** (PRIORITY: LOW)
**What**: Add more detailed cleanup logs
- [ ] Log reason for cleanup (inactivity duration)
- [ ] Log if finalization errors occur (already in code)
- [ ] Consider per-call cleanup logs vs summary logs

**Note**: Already logs to structured logger, so grep by traceId works

### 5. **Add graceful shutdown support** (PRIORITY: LOW)
**What**: Ensure cleanup timer stops on process shutdown
- [ ] Call `callStore.stopCleanupTimer()` in SIGTERM handler
- [ ] Verify all active calls are finalized before exit
- [ ] Test with `kill -15` (SIGTERM)

**Current state**: Basic cleanup timer runs; no explicit shutdown handling

### 6. **Document in runbooks** (PRIORITY: LOW)
**What**: Add to operational documentation
- [ ] How to monitor active calls: GET `/debug/call-stats`
- [ ] How to interpret stats (durationMin, inactiveMin)
- [ ] What to do if activeCallCount is high
- [ ] Cleanup timeout tuning guide

### 7. **Future: Integrate with Call Session lifecycle** (PRIORITY: FUTURE)
**What**: More advanced cleanup strategies
- [ ] Call-specific cleanup hooks (close pending timers, release resources)
- [ ] Per-call cleanup logic when entering stale state
- [ ] Different timeout for different call types (outbound vs inbound)

---

## Quick Context for Next Time

**Project**: ai-call-companion-backend (Twilio + Gemini real-time voice bridge)

**The Problem**: CallStateStore (in-memory Map) held stale call contexts forever when:
- WebSocket connections dropped unexpectedly
- Finalization code threw errors

**The Solution**: 
- Timestamp-based automatic cleanup every 5 min (removes >60 min inactive)
- Try-finally in all finalizers to guarantee removal even on error
- Monitoring endpoint to watch active calls

**Key Files**:
- `callStateStore.js` - Cleanup logic, getStats()
- `callContext.js` - Timestamps (createdAt, lastActivityTime)
- `index.js` - Monitoring endpoint at `/debug/call-stats`

**Test Command**:
```bash
cd bridge-server && node src/calls/callStateStore.test.js
```

**Docs**: See `MEMORY_LEAK_FIX.md` for full implementation details

---

**Last Updated**: April 22, 2026 14:33 UTC

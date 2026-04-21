# Architecture Decision Records (ADR)

## ADR-001: WebSocket-Based Real-Time Audio Pipeline

**Status**: Adopted  
**Date**: Pre-project  
**Context**: Need low-latency bidirectional audio streaming between Twilio and Gemini API

**Decision**: Use raw WebSocket connections instead of REST polling or message queues

**Rationale**:
- Twilio Media Streams natively uses WebSocket for audio
- Gemini Live API uses WebSocket for real-time interaction
- Direct connection minimizes latency (critical for voice)
- No need for message queue (data flows in real-time)

**Alternatives Considered**:
1. REST API with polling (high latency, not viable for voice)
2. gRPC (complexity, not needed for 1:1 connections)
3. Event queue (Kafka/RabbitMQ) - adds latency, not suitable

**Consequences**:
- ✅ Low latency, native support in both Twilio & Gemini
- ⚠️ Requires connection pooling management
- ⚠️ More complex error handling (connection drops)
- ⚠️ Doesn't scale to 1000s of concurrent calls without optimization

**Follow-up**: Consider gRPC migration or regional WebSocket servers for large scale

---

## ADR-002: In-Memory Call Context Store

**Status**: Adopted  
**Date**: Pre-project  
**Context**: Need to maintain call state (audio state, tool invocations, user consult flow) during active call

**Decision**: Store `callContext` in in-memory Map (`callStateStore`) keyed by `traceId`

**Rationale**:
- Call state is transient (only needed during active call)
- Database queries for every audio frame = too slow
- State is not shared between instances (single instance deployment V1)
- Fast lookup by `traceId` required

**Alternatives Considered**:
1. Store in Supabase (slow for real-time, not designed for this)
2. Store in Redis (good for multi-instance, overkill for single instance)
3. File-based state (slower than memory, not real-time)

**Consequences**:
- ✅ Minimal latency for state access
- ✅ Simple implementation
- ⚠️ Lost on process restart
- ⚠️ Memory leak risk if not cleaned up
- ⚠️ Cannot scale to multiple instances without Redis

**Follow-up Needed**:
1. Add timeout-based cleanup (prevent memory leaks)
2. If multi-instance required: migrate to Redis

---

## ADR-003: Repository Pattern for Database Access

**Status**: Adopted  
**Date**: Pre-project  
**Context**: Multiple areas of code need to read/write call data, caller profiles, tool invocations, etc.

**Decision**: Create one `*Repo.js` file per entity with CRUD functions

**Files**:
- `callSessionsRepo.js` - Call session lifecycle
- `callMessagesRepo.js` - Turn-by-turn transcripts
- `toolInvocationsRepo.js` - Tool execution logs
- `callSummaryRepo.js` - Summary generation
- etc.

**Rationale**:
- Centralizes database access (single place to query)
- Easy to add caching layer later
- Consistent error handling
- Clear separation from business logic

**Alternatives Considered**:
1. Direct Supabase calls everywhere (no abstraction)
2. ORM (Prisma, Sequelize) - overkill for this use case
3. GraphQL (adds complexity)

**Consequences**:
- ✅ Maintainable, consistent database access
- ✅ Easy to add logging/caching
- ⚠️ Slight performance overhead vs direct calls (negligible)
- ⚠️ More files to maintain

---

## ADR-004: Async Fire-and-Forget for Post-Call Operations

**Status**: Adopted  
**Date**: Pre-project  
**Context**: After call ends, need to generate summary and finalize session, but don't want to block call cleanup

**Decision**: Call finalization synchronously, summary generation async (fire-and-forget)

```javascript
// In twilioConnection.js
await finalizeCallSession(callCtx);  // Sync
generateAndSaveSummary(...).catch(() => {});  // Async, fire-and-forget
```

**Rationale**:
- Finalizing session must complete (saves call metadata)
- Summary is nice-to-have, non-critical
- Don't block user experience waiting for summary

**Alternatives Considered**:
1. Wait for both (slower, unnecessary)
2. Async for both (risk losing call session data)
3. Queue to message broker (overkill)

**Consequences**:
- ✅ Fast call finalization
- ⚠️ Summary may not generate if process crashes
- ⚠️ Error in summary generation is silently ignored

**Monitoring**: Add alert if `call_summaries` generation rate drops

---

## ADR-005: Polling-Based Outbound Mission Processing

**Status**: Adopted  
**Date**: Pre-project  
**Context**: Outbound missions are queued in Supabase, need to detect and execute them

**Decision**: Implement `outboundPoller` that polls database every 5 seconds

```javascript
setInterval(async () => {
  const missions = await supabaseAdmin
    .from("outbound_missions")
    .select("*")
    .eq("status", "queued")
    .or(`scheduled_at.is.null,scheduled_at.lte.${now}`)
    .order("created_at")
    .limit(1);

  if (missions.length > 0) {
    executeOutboundMission(missions[0]);
  }
}, 5000);
```

**Rationale**:
- Supabase doesn't have webhooks for row inserts (at time of decision)
- Polling is simple, reliable, and self-healing
- 5-second interval = ~10-second average latency (acceptable for scheduled calls)
- Prevents concurrent execution with boolean flag

**Alternatives Considered**:
1. Supabase webhooks (not available in product tier)
2. Message queue (Kafka, RabbitMQ) - overkill, adds infrastructure
3. Scheduled Cloud Function (Google Cloud Tasks) - external dependency
4. Database triggers → HTTP webhook (complex setup)

**Consequences**:
- ✅ No external dependencies
- ✅ Self-contained, easy to reason about
- ⚠️ Polling latency (5s default)
- ⚠️ Database load (1 query every 5s)
- ⚠️ Single mission per cycle (V1 limitation)
- ⚠️ If multi-instance: needs Redis-based locking

**Follow-up Needed**:
1. If mission volume > 100/day: reduce poll interval or increase batch size
2. If multi-instance: implement Redis locking

---

## ADR-006: Structured Logging with Categories

**Status**: Adopted  
**Date**: Pre-project  
**Context**: Need to track call events, errors, tool invocations across the system

**Decision**: Custom logger that logs with `(category, traceId, message)` tuple

```javascript
log.call("event_name", traceId, "details");
log.error("error_type", context, error.message);
log.tool("tool_execution", traceId, `${toolName} ${JSON.stringify(args)}`);
log.gemini("stage", traceId, "status");
```

**Rationale**:
- Searchable logs (grep by traceId, category)
- No external logging dependency
- Lightweight (single file, ~50 lines)
- Easy to extend (add new categories)

**Alternatives Considered**:
1. Winston/Pino (better, but adds dependency)
2. Console.log everywhere (no structure)
3. External service (Datadog, CloudWatch) - adds cost/complexity

**Consequences**:
- ✅ Simple, zero dependencies
- ✅ Logs are searchable
- ⚠️ No automatic log aggregation (need to pipe to service later)
- ⚠️ No log levels/severity (basic implementation)

**Follow-up Needed**:
1. Add log levels (info, warn, error)
2. Pipe logs to CloudWatch or Datadog in production
3. Add request ID / correlation ID for distributed tracing

---

## ADR-007: Gemini Context Injection via Text Input

**Status**: Adopted  
**Date**: Pre-project  
**Context**: Need to provide Gemini with call context (mission objective, caller profile, etc.)

**Decision**: Build context string and send as text input (not in system prompt)

```javascript
const contextBlock = `
  Account: ${callCtx.accountId}
  Caller: ${callCtx.callerNumber}
  Objective: ${objective}
  Flexible Context: ${contextFlexible}
  Secret Context: ${contextSecret}
`;

ws.send(JSON.stringify({
  realtimeInput: { text: contextBlock }
}));
```

**Rationale**:
- Gemini Live API doesn't support explicit system prompts
- Text input is the only way to inject context
- Avoids prompt injection (if using concatenation)
- Can be updated mid-call

**Alternatives Considered**:
1. Tools only (no context injection, AI has to ask for everything)
2. Stored in Gemini's conversation history (works, but adds latency)
3. Message-level context (harder to implement)

**Consequences**:
- ✅ AI has full context immediately
- ✅ Minimal latency
- ⚠️ Risk of prompt injection if user input not sanitized
- ⚠️ Context is conversational (Gemini might acknowledge it)

**Security Note**: Always sanitize user data before injecting into context

---

## ADR-008: Tool Validation & Error Handling Strategy

**Status**: Adopted with Issues  
**Date**: Pre-project  
**Context**: Gemini can call tools with arbitrary arguments

**Current Implementation**:
```javascript
async function handleToolCall(call, traceId, callCtx) {
  try {
    switch (call.name) {
      case "send_sms":
        // Minimal validation!
        const result = await n8nSms(call.args.number, call.args.message);
        return { success: true, message: "SMS sent" };
    }
  } catch (err) {
    log.error("tool_error", traceId, err.message);
    return { success: false, message: err.message };
  }
}
```

**Issues**:
- ⚠️ No input validation (phone format, message length)
- ⚠️ No type checking
- ⚠️ Assumes tool args always exist

**Recommendation** (ADR-008 revision):
```javascript
const validatePhoneNumber = (num) => /^\+?[0-9]{10,15}$/.test(num);
const validateSmsText = (txt) => txt && txt.length <= 160;

case "send_sms":
  if (!call.args?.number || !validatePhoneNumber(call.args.number)) {
    return { success: false, message: "Invalid phone number" };
  }
  if (!call.args?.message || !validateSmsText(call.args.message)) {
    return { success: false, message: "Invalid message" };
  }
  // ... proceed with send
```

**Status**: Should be implemented in next sprint

---

## ADR-009: Audio Codec Selection (μ-law vs PCM vs Opus)

**Status**: Adopted  
**Date**: Pre-project  
**Context**: Need to handle audio from Twilio (8 kHz μ-law) and send to Gemini (16 kHz PCM)

**Decision**: Implement μ-law ↔ PCM conversion on-the-fly

**Why μ-law?**
- Twilio Media Streams uses μ-law (industry standard for telecom)
- Already compressed (lower bandwidth)
- Simple 8-bit to 16-bit conversion

**Why PCM for Gemini?**
- Gemini Live expects 16-bit PCM at 16 kHz
- Higher fidelity for AI processing
- Standard format

**Alternatives Considered**:
1. Opus (better compression, higher complexity)
2. AAC (not suitable for real-time)
3. Keep μ-law (lower quality for Gemini)

**Consequences**:
- ✅ Works with Twilio & Gemini without recoding
- ✅ Minimal processing overhead
- ⚠️ No echo cancellation, noise suppression
- ⚠️ Quality could be improved with better codecs

**Follow-up**: Consider Opus transcoding if bandwidth becomes issue

---

## ADR-010: No Explicit State Machine for Call Lifecycle

**Status**: Adopted with Concerns  
**Date**: Pre-project  
**Context**: Call has multiple states (connecting, streaming, finalizing, closed)

**Current Implementation**:
- Implicit state tracking through WebSocket readyState
- Boolean flags (`finalized`, `geminiReady`, etc.)
- No state machine

**Consequences**:
- ✅ Simple, minimal code
- ⚠️ Hard to reason about valid state transitions
- ⚠️ Race conditions possible (e.g., finalize called twice)
- ⚠️ Unidirectional state changes not enforced

**Mitigation**: `finalizeOnce()` function prevents double-finalization

**Follow-up for Large Codebase**: Consider explicit state machine (e.g., `xstate` library)

---

## ADR-011: Single-Instance Deployment (V1)

**Status**: Adopted  
**Date**: Pre-project  
**Context**: Current architecture supports single server instance

**Limitations**:
- In-memory state lost on restart
- Outbound polling not distributed (race conditions with multiple instances)
- No session affinity needed

**Multi-Instance Requirements** (Future):
1. Redis for call state storage
2. Redis locking for outbound poller
3. Load balancer with connection reuse
4. Graceful connection draining on shutdown

**Current Status**: Works for up to ~100 concurrent calls on typical server

---

## ADR-012: No Database Transactions

**Status**: Adopted  
**Date**: Pre-project  
**Context**: Call data written to multiple tables (sessions, messages, invocations)

**Current Implementation**:
- Separate calls to Supabase for each table
- No transaction wrapping
- Risk of partial writes if process crashes

**Example**:
```javascript
await supabaseAdmin.from("call_sessions").insert(session);  // Wrote
await supabaseAdmin.from("call_messages").insert(messages);  // Crash here?
```

**Consequences**:
- ✅ Simpler code
- ⚠️ Data inconsistency possible (rare)
- ⚠️ No rollback capability

**Mitigation**: 
- Most critical data (sessions) written first
- Non-critical data (summaries) written async
- Monitoring for orphaned records

**Follow-up**: If data consistency becomes issue, implement transaction wrapper

---

## ADR-013: Direct Supabase Admin Calls (No Abstraction)

**Status**: Adopted  
**Date**: Pre-project  
**Context**: All database access uses service role key

**Why Service Role?**:
- Needs to write to multiple tables
- Not user-specific (system account)
- Simplest approach for V1

**Security Implication**:
- Service role can access all data (by design)
- Should add Row-Level Security (RLS) at database layer
- No per-user filtering in code

**Future**: 
- Enable RLS policies in Supabase
- Add `account_id` WHERE clause to all queries (even with service role)
- Move to fine-grained access control

---

## ADR-014: Synchronous Tool Execution

**Status**: Adopted  
**Date**: Pre-project  
**Context**: When Gemini calls a tool, must wait for response before continuing

**Current Implementation**:
```javascript
const result = await handleToolCall(call, traceId, callCtx);
// Send result back to Gemini immediately
```

**Rationale**:
- Tools must complete before Gemini can proceed
- Asynchronous execution would require callbacks (complexity)
- Real-time nature of voice calls requires synchronous response

**Consequences**:
- ✅ Simpler implementation
- ✅ Immediate response to Gemini
- ⚠️ Slow tool = entire call slows down
- ⚠️ Database latency directly impacts call quality

**Monitoring**: Track tool execution time, alert if > 2 seconds

---

## Summary of Key Decisions

| ADR | Decision | Status | Risk Level |
|-----|----------|--------|-----------|
| 001 | WebSocket for audio | ✅ | Low |
| 002 | In-memory call store | ✅ | Medium |
| 003 | Repository pattern | ✅ | Low |
| 004 | Async finalization | ✅ | Low |
| 005 | Polling outbound | ✅ | Medium |
| 006 | Structured logging | ✅ | Low |
| 007 | Context injection | ✅ | Medium |
| 008 | Tool validation | ⚠️ | **HIGH** |
| 009 | Audio codecs | ✅ | Low |
| 010 | No state machine | ⚠️ | Medium |
| 011 | Single instance | ✅ | Medium |
| 012 | No transactions | ⚠️ | Medium |
| 013 | Direct Supabase | ⚠️ | **HIGH** |
| 014 | Sync tool exec | ✅ | Medium |

**Highest Priority Fixes**:
1. **ADR-008**: Add input validation to all tools
2. **ADR-013**: Enable RLS in Supabase database

---

**Last Updated**: 2026-04-21

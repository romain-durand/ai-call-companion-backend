# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**ai-call-companion-backend** is a WebSocket-based real-time audio bridge that connects Twilio Media Streams with Google Gemini Live API. It enables AI-powered voice conversations with tool integration, calendar management, and outbound call capabilities.

**Key Tech Stack**: Node.js, WebSocket, Supabase (database), Gemini Live API, Twilio Media Streams

## Development Setup

### Install dependencies
```bash
cd bridge-server
npm install
```

### Run the server
```bash
npm start
# Runs src/index.js on port 8081
# Requires environment variables: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, etc.
```

### Run tests
```bash
# Input validation tests
node src/tools/validateArgs.test.js
```

### Build and run with Docker
```bash
docker build -t twilio-gemini-bridge bridge-server/
docker run -p 8081:8081 --env-file .env twilio-gemini-bridge
```

## Architecture

### High-Level Data Flow

```
Twilio Media Stream (WebSocket)
  ↓
[twilioConnection] → Audio codec conversion (μ-law → 16-bit PCM)
  ↓
[geminiConnection] → Real-time audio to Gemini Live API
  ↓
Tool execution (calendar, SMS, transfers, etc.)
  ↓
Database writes (Supabase) via repository pattern
```

### Directory Structure

| Directory | Purpose |
|-----------|---------|
| `src/calls/` | Call lifecycle: state store (`callStateStore.js`), context (`callContext.js`) |
| `src/db/` | Database access layer - one `*Repo.js` per entity (sessions, messages, summaries, tool invocations) |
| `src/gemini/` | Gemini Live API integration - connection management, config, context injection |
| `src/outbound/` | Outbound mission execution: poller, executor, Gemini config for outbound calls |
| `src/tools/` | Tool handlers: validation, routing to n8n/Google Calendar/Twilio APIs |
| `src/audio/` | Audio codec handling (μ-law/PCM conversion) |
| `src/integrations/` | Third-party clients (n8n SMS, etc.) |
| `src/auth/` | OAuth flows (Google, Google Contacts) |
| `src/calendar/` | Google Calendar client integration |
| `src/observability/` | Structured logging by category |
| `src/config/` | Environment and config management |

### Core Architectural Patterns

**Repository Pattern** (`src/db/*Repo.js`)
- All database access goes through repo functions: `callSessionsRepo`, `callMessagesRepo`, `toolInvocationsRepo`, etc.
- Centralizes Supabase queries and enables consistent error handling
- Use repos instead of direct Supabase calls

**In-Memory Call State Store** (`src/calls/callStateStore.js`)
- `callStateStore` is a Map keyed by `traceId`
- Stores active call context (audio state, tool results, user info)
- Fast lookup for real-time audio processing
- **Note**: State is lost on process restart; no Redis persistence in V1

**WebSocket Architecture**
- Three WebSocket servers on different paths:
  - `POST /twilio-connection` - Inbound calls from Twilio
  - `POST /outbound-stream` - Outbound call audio handling
  - `POST /web-call-connection` - Web client calls
- Each maintains bidirectional audio streams (Twilio ↔ Gemini)

**Tool Execution Flow**
- Gemini calls tools via `serverContent` messages
- Handler validates inputs (see `validateArgs.js`)
- Result sent back to Gemini synchronously
- Logged to database asynchronously

### Important Architecture Decisions

See `ARCHITECTURE_DECISIONS.md` for detailed ADRs. Key decisions:

| ADR | Decision | Status | Note |
|-----|----------|--------|------|
| 001 | WebSocket for audio | ✅ Adopted | Low latency, native support in Twilio & Gemini |
| 002 | In-memory call store | ✅ Adopted | Fast, single-instance only (need Redis for scale) |
| 003 | Repository pattern | ✅ Adopted | One file per entity, consistent DB access |
| 005 | Polling for outbound | ✅ Adopted | Polls Supabase every 5s for queued missions |
| 008 | Tool validation | ✅ Adopted | Input validation added in `validateArgs.js` |
| 010 | No explicit state machine | ⚠️ Concern | Works but prone to race conditions |
| 011 | Single-instance deployment | ✅ By design | Multi-instance needs Redis + distributed locking |

## Key Files and Responsibilities

### Entry Point
- **`src/index.js`** - HTTP server setup, WebSocket upgrade handlers for three connection types

### Call Handling (Inbound)
- **`src/calls/callContext.js`** - Defines CallContext structure (metadata, state)
- **`src/calls/callStateStore.js`** - Map-based store for active calls
- **`src/gemini/geminiConnection.js`** - Manages Gemini Live WebSocket, audio streaming, tool routing

### Outbound Calls
- **`src/outbound/outboundPoller.js`** - Polls `outbound_missions` table every 5s
- **`src/outbound/outboundCallExecutor.js`** - Executes a mission (makes outbound call)
- **`src/outbound/outboundGeminiConnection.js`** - Gemini connection for outbound calls

### Tools and Routing
- **`src/tools/toolRouter.js`** - Routes Gemini tool calls to handlers (check availability, book appointment, etc.)
- **`src/tools/validateArgs.js`** - Input validation for all tool arguments (dates, times, phone numbers, etc.)
- **`src/tools/consultUserFlow.js`** - Handles "transfer to human" logic

### Audio Processing
- **`src/audio/codec.js`** - Converts between μ-law (Twilio) and 16-bit PCM (Gemini)

### Database
- **`src/db/supabaseAdmin.js`** - Supabase client singleton (service role)
- **`src/db/callSessionsRepo.js`** - CRUD for call sessions
- **`src/db/callMessagesRepo.js`** - Turn-by-turn transcripts
- **`src/db/toolInvocationsRepo.js`** - Tool execution logs
- **`src/db/callSummaryRepo.js`** - Call summary generation and storage

## Common Development Tasks

### Adding a New Tool
1. Add handler in `src/tools/toolRouter.js` with input validation (use `validateArgs.js`)
2. Define Gemini tool schema in `src/gemini/geminiConfig.js`
3. Test with `validateArgs.test.js` to ensure validators work
4. Log invocations via `toolInvocationsRepo`

### Debugging a Call
1. Search logs by `traceId` (unique per call)
2. Check `callStateStore` contents during call lifecycle
3. Monitor Gemini messages in `geminiConnection.js` with structured logs
4. Verify tool arguments reach handlers via `validateArgs` checks

### Adding Database Schema Changes
1. Modify Supabase schema via dashboard
2. Update corresponding `*Repo.js` CRUD functions
3. Test with Supabase admin client (service role key in env)

### Testing Tool Validation
```bash
node src/tools/validateArgs.test.js
# Runs 30+ test cases for all validators
```

### Handling Errors and Logging
- All structured logs use `log.category(name, traceId, message)`
- Categories: `log.call()`, `log.error()`, `log.tool()`, `log.gemini()`
- Logs are text-based; pipe to CloudWatch/Datadog in production

## Critical Implementation Notes

### Audio Pipeline
- Twilio sends μ-law (8 kHz, 8-bit)
- Converted to 16-bit PCM (16 kHz) for Gemini
- Codec: See `src/audio/codec.js` for conversion logic

### Call Finalization
- Finalization is **synchronous** (saves session metadata)
- Summary generation is **async fire-and-forget** (won't block call cleanup)
- If process crashes during summary, data is lost

### Outbound Call Polling
- Polls every 5 seconds (configurable in `outboundPoller.js`)
- Processes one mission per cycle
- Requires distributed locking if multi-instance deployment planned

### Security Considerations
- **All database access uses service role** (no per-user filtering in code) - add RLS policies at DB layer
- **Tool input validation is mandatory** - use validators in `validateArgs.js`, never trust Gemini args
- **Context injection risk** - sanitize user data before sending to Gemini

## Testing and Verification

### Unit Tests
- **Tool validation**: `node src/tools/validateArgs.test.js` (30 test cases)
- No other automated tests currently in place

### Manual Testing
- Use Postman/cURL to test WebSocket endpoints
- Monitor logs in real-time: `grep traceId <logfile>`
- Check Supabase dashboard for data persistence

## Environment Variables

See `.env` file. Required:
- `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`
- `TWILIO_AUTH_TOKEN` (for validation)
- `GEMINI_API_KEY`
- `N8N_SMS_WEBHOOK_URL` (for SMS integration)

## Known Limitations and Risks

1. **Memory leaks possible** - Call state not cleaned up if connection drops unexpectedly
2. **No state machine** - Race conditions possible during call finalization
3. **Single-instance only** - In-memory state lost on restart
4. **Async summary generation** - Can fail silently if process crashes
5. **No database transactions** - Risk of partial writes across multiple tables
6. **All database access as service role** - Should add RLS policies

See `ARCHITECTURE_DECISIONS.md` for mitigation strategies.

## Deployment

- **Port**: 8081 (HTTP/WebSocket)
- **Dockerfile**: Available in `bridge-server/`
- **Health Check**: GET `/health` (if implemented)
- **Graceful Shutdown**: Drain connections on SIGTERM (not fully implemented)

## Admin Endpoints (DEBUG_SECRET Required)

These endpoints are protected by the `DEBUG_SECRET` environment variable for development/testing only.

### DELETE /admin/users/:userId
**Delete a user and all associated data**

Removes user account, profile, and all related data across ~25 tables. Useful for test user cleanup.

```bash
curl -X DELETE https://bridgeserver2.ted.paris/admin/users/{userId} \
  -H "Authorization: Bearer {DEBUG_SECRET}"
```

**Response:**
```json
{
  "userId": "05089e64-4058-478c-ac0e-d6fb91149255",
  "accountId": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "success": true
}
```

**Implementation details:**
- Deletes `outbound_missions` (manual, no ON DELETE CASCADE)
- Deletes related data (contacts, rules, memberships)
- Deletes account (cascades to ~25 tables)
- Deletes auth user (cascades to profiles)
- Note: `caller_groups` are left orphaned due to `prevent_system_group_deletion` trigger — they're isolated by account_id and don't interfere

---

### GET /debug/call-stats
**Retrieve active call statistics**

Shows current WebSocket connections and in-memory call state.

```bash
curl -H "Authorization: Bearer {DEBUG_SECRET}" \
  https://bridgeserver2.ted.paris/debug/call-stats
```

**Response:**
```json
{
  "totalConnections": 3,
  "activeCallsByType": {
    "inbound": 2,
    "outbound": 1
  },
  "callStoreSize": 3,
  "details": [
    {
      "traceId": "abc123",
      "callType": "inbound",
      "duration_ms": 45000,
      "state": "connected"
    }
  ]
}
```

---

**Last Updated**: April 23, 2026  
**For architecture deep-dives**: See `ARCHITECTURE_DECISIONS.md`

const crypto = require("crypto");

function createCallContext() {
  return {
    traceId: crypto.randomUUID().slice(0, 8),
    streamSid: null,
    callerNumber: "unknown",
    geminiReady: false,
    providerCallId: null,    // future: Twilio CallSid
    callSessionId: null,     // future: DB call_sessions.id
  };
}

module.exports = { createCallContext };

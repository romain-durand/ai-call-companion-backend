const crypto = require("crypto");

function createCallContext() {
  return {
    traceId: crypto.randomUUID().slice(0, 8),
    streamSid: null,
    callerNumber: "unknown",
    callerNameRaw: null,
    geminiReady: false,
    providerCallId: null,
    callSessionId: null,
    accountId: null,
    phoneNumberId: null,
    profileId: null,
    activeModeId: null,
    messageSeqNo: 0,
    startedAt: null,
    finalized: false,
    _txBuffer: null, // set by twilioConnection after creation
  };
}

module.exports = { createCallContext };

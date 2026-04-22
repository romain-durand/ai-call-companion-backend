const crypto = require("crypto");
const { createConsultUserFlowState } = require("../tools/consultUserFlow");

function createCallContext() {
  let _seqNo = 0;
  const now = Date.now();

  const ctx = {
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
    controlMode: "strict_policy",
    startedAt: null,
    finalized: false,
    _txBuffer: null,
    consultUserFlow: createConsultUserFlowState(),
    awaitingOutboundFirstTurn: false,
    outboundFirstTurnTriggered: false,
    pendingCallerTurnText: "",
    firstCallerTurnObservedAt: null,
    lastAssistantActivityAt: 0,
    _hangupRequested: false,
    _hangupWatcher: null,
    _firstCallerTurnTimer: null,
    createdAt: now,
    lastActivityTime: now,

    /** Returns the next unique seq_no for this call. */
    nextSeqNo() {
      _seqNo += 1;
      return _seqNo;
    },
  };

  return ctx;
}

module.exports = { createCallContext };

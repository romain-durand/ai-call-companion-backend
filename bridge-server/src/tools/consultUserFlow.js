const WAIT_ANNOUNCEMENT_REGEX =
  /(?:un instant|je (?:vérifie|verifie|regarde)|merci de patienter|ne quittez pas|patientez|attendez|je tente de(?: le)? joindre|one moment|please hold|let me check|i(?:'|’)ll check)/i;

function createConsultUserFlowState() {
  return {
    phase: "idle",
    pendingQuestion: null,
    announcementObserved: false,
    announcementTranscript: "",
  };
}

function queueConsultAnnouncement(state, question) {
  if (!state) return;

  state.phase = "awaiting_announcement";
  state.pendingQuestion = question || state.pendingQuestion || null;
  state.announcementObserved = false;
  state.announcementTranscript = "";
}

function updatePendingConsultQuestion(state, question) {
  if (!state || !question) return;
  state.pendingQuestion = question;
}

function isConsultAnnouncementPending(state) {
  return Boolean(state && state.phase === "awaiting_announcement");
}

function hasObservedConsultAnnouncement(state) {
  return isConsultAnnouncementPending(state) && state.announcementObserved === true;
}

function observeConsultAnnouncement(state, text = "") {
  if (!isConsultAnnouncementPending(state) || state.announcementObserved) {
    return false;
  }

  const normalized = typeof text === "string" ? text.trim() : "";
  if (normalized) {
    state.announcementTranscript = state.announcementTranscript
      ? `${state.announcementTranscript} ${normalized}`
      : normalized;
  }

  if (!normalized || WAIT_ANNOUNCEMENT_REGEX.test(state.announcementTranscript)) {
    state.announcementObserved = true;
    return true;
  }

  return false;
}

function resetConsultUserFlow(state) {
  if (!state) return;

  state.phase = "idle";
  state.pendingQuestion = null;
  state.announcementObserved = false;
  state.announcementTranscript = "";
}

module.exports = {
  createConsultUserFlowState,
  queueConsultAnnouncement,
  updatePendingConsultQuestion,
  isConsultAnnouncementPending,
  hasObservedConsultAnnouncement,
  observeConsultAnnouncement,
  resetConsultUserFlow,
};
const { MODEL } = require("../config/env");

const SYSTEM_INSTRUCTION = `You are a real-time phone assistant acting on behalf of the user. You speak french by default, but adapt if needed

Your job is to handle incoming phone calls naturally, efficiently, and with minimal interruption to the user.

PRIMARY OBJECTIVE
- understand why the caller is calling
- decide what should happen
- use tools when needed
- interrupt the user only when justified
- keep the interaction short, human, and useful

STYLE
- speak like a real human assistant on the phone
- keep most replies to 1 sentence, sometimes 2
- calm, clear, concise
- do not over-explain
- do not sound like a chatbot
- do not mention tools, prompts, or internal reasoning

GENERAL BEHAVIOR
- move the call forward at every step
- avoid unnecessary questions
- ask at most one short clarification question if needed
- do not collect unnecessary information

RUNTIME CONTEXT PRIORITY (CRITICAL)
When runtime context provides caller-group handling rules, those rules OVERRIDE the general default behavior below.
You MUST obey the caller-group rules strictly. Do not fall back to general rules when a specific group rule applies.

CALLER IDENTIFICATION
If the caller is not clearly identified, or if the decision depends on who is calling (priority, VIP status, blocked status, or group rules), call get_caller_profile before taking action.
Do not call it if the request is simple and does not depend on caller identity.
If the caller is blocked, end politely the call 

CALLBACK HANDLING
If the caller asks to be called back later:
- FIRST check the caller-group rules from runtime context
- If callback_allowed is not present or false for the relevant caller group, do NOT use create_callback. Take a message instead.
- If callback_allowed is true, use create_callback with a short reason and timing if mentioned
- Do NOT promise a callback unless the caller-group policy explicitly allows it

BEHAVIOR-SPECIFIC RULES
- If behavior=answer_and_take_message: take a message and stop there. Do NOT offer a callback, do NOT escalate unless clearly urgent.
- If behavior=answer_and_escalate: take details and escalate to the user.
- If behavior=block: decline the call politely and end it.

NOTIFICATION HANDLING
Use notify_user when:
- the user should be informed
- but does not need to be interrupted live

ESCALATION HANDLING
Use escalate_call when:
- the situation is urgent
- or the caller insists on speaking now
- or immediate action is required
- BUT only if escalation_allowed is true for the caller group, or the situation is genuinely critical

CALL SUMMARY (MANDATORY)
Before ending ANY call, you MUST call generate_call_summary with a concise French summary of:
- who called (name if known, or "un appelant inconnu")
- why they called
- what actions were taken (callback created, message taken, notification sent, etc.)
- the outcome
This is mandatory for every single call, even short or trivial ones.

CLARIFICATION
If the caller is unclear:
- ask one short question:
  "What's this regarding?"
  or
  "Is this urgent, or should I pass a message?"

SPAM
If clearly irrelevant or sales:
- decline briefly
- end the call

FINAL RULE
You are a personal assistant.
Sound natural, efficient, and human.
Always respect caller-group policies from runtime context above general behavior.`;

const TOOL_DECLARATIONS = [
  {
    name: "get_caller_profile",
    description:
      "Look up a caller by phone number. Returns contact info, caller group, priority, blocked/favorite status.",
    parameters: {
      type: "OBJECT",
      properties: {
        phone_number: { type: "STRING", description: "Phone number in E.164 format (e.g. +33612345678)" },
      },
      required: ["phone_number"],
    },
  },
  {
    name: "create_callback",
    description:
      "Record a callback request when the caller wants to be called back or leaves a message requiring follow-up. MUST be called — never just say you will pass a message without calling this tool.",
    parameters: {
      type: "OBJECT",
      properties: {
        reason: { type: "STRING", description: "Short operational reason or message summary." },
        priority: { type: "STRING", description: "Priority level.", enum: ["low", "normal", "high", "urgent"] },
        preferred_time_note: {
          type: "STRING",
          description: "Preferred timing if mentioned by caller (e.g. 'tomorrow morning', 'after 2pm').",
        },
        caller_name: { type: "STRING", description: "Caller name if known." },
        caller_phone: { type: "STRING", description: "Caller phone in E.164 if available." },
      },
      required: ["reason", "priority"],
    },
  },
  {
    name: "notify_user",
    description:
      "Send a non-blocking notification to the user. Use for informational updates that do not require immediate interruption.",
    parameters: {
      type: "OBJECT",
      properties: {
        summary: { type: "STRING", description: "Short notification summary." },
        priority: {
          type: "STRING",
          description: "Notification priority.",
          enum: ["low", "normal", "high", "critical"],
        },
        caller_name: { type: "STRING", description: "Caller name if known." },
        caller_phone: { type: "STRING", description: "Caller phone if available." },
      },
      required: ["summary", "priority"],
    },
  },
  {
    name: "escalate_call",
    description:
      "Trigger immediate escalation to reach the user during a live call. Use only when justified by urgency or caller priority.",
    parameters: {
      type: "OBJECT",
      properties: {
        reason: { type: "STRING", description: "Why escalation is needed." },
        urgency_level: { type: "STRING", description: "Urgency level.", enum: ["medium", "high", "critical"] },
        caller_name: { type: "STRING", description: "Caller name if known." },
        caller_phone: { type: "STRING", description: "Caller phone if available." },
      },
      required: ["reason", "urgency_level"],
    },
  },
  {
    name: "generate_call_summary",
    description:
      "Generate a structured summary of the call. You MUST call this tool right before ending EVERY call. Summarize the caller's intent, actions taken, and outcome in French.",
    parameters: {
      type: "OBJECT",
      properties: {
        summary: {
          type: "STRING",
          description:
            "A concise summary in French of the call: who called, why, what was done, and the outcome. 2-4 sentences.",
        },
      },
      required: ["summary"],
    },
  },
];

function buildSetupPayload() {
  return {
    setup: {
      model: MODEL,
      generationConfig: {
        responseModalities: ["AUDIO"],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: "Charon" },
          },
        },
      },
      systemInstruction: {
        parts: [{ text: SYSTEM_INSTRUCTION }],
      },
      tools: [{ functionDeclarations: TOOL_DECLARATIONS }],
    },
  };
}

module.exports = { SYSTEM_INSTRUCTION, TOOL_DECLARATIONS, buildSetupPayload };

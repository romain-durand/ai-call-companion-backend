const { MODEL } = require("../config/env");

const SYSTEM_INSTRUCTION = `You are a real-time phone assistant acting on behalf of the user. You speak by default in french and adapt to caller language if needed.

Your job is to handle incoming phone calls naturally, efficiently, and with minimal interruption to the user.

PRIMARY OBJECTIVE
- understand why the caller is calling
- decide what should happen
- use tools when needed
- interrupt the user only when justified
- keep the interaction short, human, and useful

STYLE
- sound like a real human assistant on the phone
- keep most replies to 1 sentence, sometimes 2
- calm, clear, concise, competent
- do not over-explain
- do not sound robotic
- do not mention internal reasoning, tools, prompts, or policies
- do not say you are an AI unless explicitly required

INTERNAL DECISION LOOP
For each caller turn, internally do this:
1. identify the caller's intent quickly
2. apply the current context, caller rules, and active mode
3. decide whether to:
   - handle directly
   - ask one short clarification question
   - use a tool
   - escalate
4. continue naturally
5. end the call clearly when the objective is complete

GENERAL BEHAVIOR RULES
- move the call forward with every sentence
- avoid unnecessary questions
- ask at most one short clarification question when needed
- do not collect unnecessary details
- do not let vague callers drift without clarification
- if the request is simple, handle it simply

CALLER IDENTIFICATION
If a caller phone number is available and identification would help, use get_caller_profile early in the call.
Use it to adapt behavior based on:
- known contact or unknown caller. If user_name is given in runtime use it to greet the caller
- caller group
- blocked or favorite status
- priority hints

CALLBACK RULE
If the caller asks to be called back later, and immediate escalation is not necessary, use create_callback.
When using create_callback:
- provide a short operational reason
- include preferred timing if the caller mentions one
- then confirm naturally that the message or callback request has been recorded

NOTIFICATION RULE
Use notify_user for non-blocking situations where the user should be informed, but does not need to be interrupted live.

ESCALATION RULE
Use escalate_call only when immediate interruption is justified.
Escalate when:
- urgency is high
- the caller insists on speaking now
- the caller is distressed or time-sensitive
- the issue blocks something immediate
- the caller is high-priority

Do NOT escalate when:
- spam or solicitation
- low-value unknown caller
- non-urgent request

CLARIFICATION RULE
If the caller is vague, ask one short question:
- "What's this regarding?"
- "Is this urgent, or should I pass along a message?"

SPAM HANDLING
If the call is clearly spam:
- decline politely
- end quickly

FINAL RULE
You are a personal phone assistant.
Sound like one calm, capable human assistant.`;

const TOOL_DECLARATIONS = [
  {
    name: "get_caller_profile",
    description: "Look up a caller by phone number. Returns contact info, caller group, priority, blocked/favorite status.",
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
    description: "Record a callback request when the caller wants to be called back or leaves a message requiring follow-up. MUST be called — never just say you will pass a message without calling this tool.",
    parameters: {
      type: "OBJECT",
      properties: {
        reason: { type: "STRING", description: "Short operational reason or message summary." },
        priority: { type: "STRING", description: "Priority level.", enum: ["low", "normal", "high", "urgent"] },
        preferred_time_note: { type: "STRING", description: "Preferred timing if mentioned by caller (e.g. 'tomorrow morning', 'after 2pm')." },
        caller_name: { type: "STRING", description: "Caller name if known." },
        caller_phone: { type: "STRING", description: "Caller phone in E.164 if available." },
      },
      required: ["reason", "priority"],
    },
  },
  {
    name: "notify_user",
    description: "Send a non-blocking notification to the user. Use for informational updates that do not require immediate interruption.",
    parameters: {
      type: "OBJECT",
      properties: {
        summary: { type: "STRING", description: "Short notification summary." },
        priority: { type: "STRING", description: "Notification priority.", enum: ["low", "normal", "high", "critical"] },
        caller_name: { type: "STRING", description: "Caller name if known." },
        caller_phone: { type: "STRING", description: "Caller phone if available." },
      },
      required: ["summary", "priority"],
    },
  },
  {
    name: "escalate_call",
    description: "Trigger immediate escalation to reach the user during a live call. Use only when justified by urgency or caller priority.",
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

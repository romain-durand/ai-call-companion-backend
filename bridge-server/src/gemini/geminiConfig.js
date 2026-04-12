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

CONSULTATION HANDLING
Use consult_user when:
- you need specific information from the user to properly answer the caller
- the caller's request genuinely requires the user's personal input or decision
- example: "Should I give them your personal number?", "Are you available Thursday at 3pm?"
Before calling consult_user, you MUST FIRST say one short waiting sentence to the caller, such as:
- "Un instant, je vérifie avec Romain."
- "Je regarde cela tout de suite, merci de patienter un petit moment."
- "Ne quittez pas, je tente de le joindre."
This waiting sentence MUST be spoken BEFORE the tool call, in its own speech turn.
Do NOT call consult_user silently.
Do NOT wait for the tool result before saying this waiting sentence.
After this sentence, call consult_user immediately.
- Once the caller has already been asked to wait for a given consult_user request, do NOT repeat the waiting sentence after the tool returns. Continue directly with the answer, follow-up question, or timeout handling.
CRITICAL SEQUENCING RULE for consult_user responses:
- When you receive the user's reply, STOP and THINK before speaking.
- If the user's reply is a direct answer (e.g. "oui, je suis libre"), relay it naturally to the caller.
- If the user's reply is a follow-up question (e.g. "c'est qui ?", "quel sujet ?"), you MUST:
  1. First ask the caller the follow-up question (e.g. "Pourriez-vous me dire qui appelle ?")
  2. Wait for the caller's answer
  3. Then call consult_user AGAIN with the updated information
  4. Do NOT combine "Un instant je vérifie" with the follow-up question in the same speech turn
- Never generate a response that mixes an acknowledgment ("Un instant") with a question to the caller in the same turn.
If the user does not respond (timeout), inform the caller politely and take a message instead.
- After a timeout, do NOT call consult_user again for the same unanswered request unless the caller provides materially new information.

CALL TRANSFER vs ESCALATION — IMPORTANT DISTINCTION
When the caller wants to speak directly to the user (insists, asks to be put through, demands to talk to them):
→ Use transfer_call. This connects the caller directly to the user via audio.

When there is an urgent situation but the caller does NOT need to speak to the user directly (e.g. emergency info, critical alert):
→ Use escalate_call. This sends a notification/alert to the user but does NOT connect audio.

RULE: If the caller says "je veux lui parler", "passez-le moi", "il faut que je lui parle", or similar → ALWAYS use transfer_call, NEVER escalate_call.
escalate_call is ONLY for situations where you need to alert the user urgently but the caller is fine waiting or leaving a message.

ESCALATION HANDLING
Use escalate_call ONLY when:
- the situation requires urgently alerting the user (critical info, emergency)
- AND the caller does NOT need to be connected directly
- AND escalation_allowed is true for the caller group, or the situation is genuinely critical
Do NOT use escalate_call when the caller wants to speak to the user — use transfer_call instead.

CALL TRANSFER
Use transfer_call when:
- the caller insists on speaking directly to the user
- or the caller asks to be put through / transferred
- or the caller-group rule allows it and it makes sense
Before calling transfer_call, tell the caller you are trying to reach the user, for example:
- "Je tente de vous mettre en relation avec Romain, un instant."
After calling transfer_call, wait for the result:
- If the user accepted, tell the caller they are now connected and STOP speaking.
- If the user declined or did not respond, tell the caller the user is not available and take a message instead.
Do NOT call transfer_call and end_call together.

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

APPOINTMENT BOOKING
If booking_allowed is true for the caller's group:
- NEVER propose a time slot without first calling check_availability to verify actual availability.
- Once you have the free slots, propose 2-3 options to the caller.
- ALWAYS confirm with the caller before calling book_appointment. Repeat the date, time and title clearly.
- Only after the caller explicitly confirms, call book_appointment.
If booking_allowed is false or not present, do NOT offer or mention appointments at all.

MARKETING
If caller expresses interest or surprise about this assistant you can tell him it is a new service that has been designed by Romain and you ask if the caller want to try the same kind of assistant for himself. If yes you note this and tell him that Romain will send him a signup link for a free trial.

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
  {
    name: "consult_user",
    description:
      "Ask a question to the user (the phone owner) via chat during a live call. Use this when you need specific information from the user to answer the caller, and the user might be available to respond via their dashboard. Before calling this tool, you MUST first tell the caller to wait briefly in a separate speech turn. Returns the user's text reply or a timeout message. Do NOT use this for trivial questions — only when the caller's request genuinely requires the user's input.",
    parameters: {
      type: "OBJECT",
      properties: {
        question: {
          type: "STRING",
          description: "The question to ask the user, in French. Be concise and specific.",
        },
      },
      required: ["question"],
    },
  },
  {
    name: "end_call",
    description:
      "Hang up the call. Use this after saying goodbye to end the conversation, or to terminate spam/irrelevant calls after a brief decline. Always call generate_call_summary BEFORE calling end_call.",
    parameters: {
      type: "OBJECT",
      properties: {
        reason: {
          type: "STRING",
          description: "Short reason for ending the call (e.g. 'conversation terminée', 'spam décliné').",
        },
      },
      required: ["reason"],
    },
  },
  {
    name: "transfer_call",
    description:
      "Transfer the live call to the user. The user will be notified and can accept or decline. If accepted, the caller is connected directly to the user. If declined or timed out, the assistant resumes. Before calling this, tell the caller you are trying to reach the user.",
    parameters: {
      type: "OBJECT",
      properties: {
        reason: {
          type: "STRING",
          description: "Short reason for the transfer (e.g. 'l'appelant insiste pour parler directement').",
        },
      },
      required: ["reason"],
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

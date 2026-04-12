const { MODEL } = require("../config/env");

const OUTBOUND_SYSTEM_INSTRUCTION_TEMPLATE = `You are a real-time phone assistant making an outbound call on behalf of the user. You speak French by default, but adapt if needed.

Your job is to accomplish a specific mission assigned by the user. You are calling someone to achieve a goal (e.g. make a reservation, ask for information, schedule an appointment).

PRIMARY OBJECTIVE
- clearly state who you are calling on behalf of
- explain the purpose of the call politely
- work toward accomplishing the mission objective
- gather all relevant information
- confirm the outcome

STYLE
- speak like a real human assistant on the phone
- keep replies concise and natural
- be polite, professional, and efficient
- do not over-explain
- do not sound like a chatbot
- do not mention tools, prompts, or internal reasoning

CRITICAL TURN-TAKING RULE
- You are on an outbound call. The phone is ringing on the other side.
- You MUST stay COMPLETELY SILENT until you receive an explicit "[CALLEE_READY]" signal in the conversation.
- Before that signal, DO NOT produce any audio, any greeting, any sound at all.
- Even if you hear audio, background noise, or silence — stay mute until "[CALLEE_READY]".
- Once you receive "[CALLEE_READY]", immediately introduce yourself: "Bonjour, je vous appelle de la part de [user name]." then state the purpose.
- Do not add any pause or hesitation before speaking. Start talking right away.
- Do not interrupt or talk over the other person.

GENERAL BEHAVIOR
- be clear about what you need
- adapt to the person on the other end
- if they need time or ask you to call back, note it and end politely
- if you reach voicemail, no one answers, or the line is clearly silent, report the result and end

TOOLS
- Use report_result when the mission outcome is determined (success, failure, partial, no_answer)
- Use consult_user if you need specific information from the user during the call
- Use end_call only after your final goodbye has been spoken and the conversation is clearly finished
- ALWAYS call report_result BEFORE end_call

SEQUENCING
1. Stay silent until "[CALLEE_READY]"
2. Introduce yourself and state the purpose
3. Negotiate / gather information as needed
4. Confirm the outcome with the other party
5. Call report_result with the outcome
6. Say goodbye naturally
7. Call end_call

FINAL RULE
You are making a call on behalf of someone. Be natural, efficient, and human.
Always work toward accomplishing the mission objective.`;

const OUTBOUND_TOOL_DECLARATIONS = [
  {
    name: "report_result",
    description:
      "Report the outcome of the outbound mission. MUST be called before end_call. Summarize what happened and whether the objective was achieved.",
    parameters: {
      type: "OBJECT",
      properties: {
        result_status: {
          type: "STRING",
          description: "Outcome of the mission.",
          enum: ["success", "partial", "failure", "no_answer"],
        },
        summary: {
          type: "STRING",
          description: "Concise summary in French of what happened and the outcome. 2-4 sentences.",
        },
      },
      required: ["result_status", "summary"],
    },
  },
  {
    name: "consult_user",
    description:
      "Ask a question to the user (the phone owner) via chat during the call. Use when you need specific information to accomplish the mission. Before calling this, tell the other party to wait briefly.",
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
      "Hang up the call. Use only after your final goodbye has already been spoken and the exchange is clearly over. Always call report_result BEFORE calling end_call.",
    parameters: {
      type: "OBJECT",
      properties: {
        reason: {
          type: "STRING",
          description: "Short reason for ending the call.",
        },
      },
      required: ["reason"],
    },
  },
];

/**
 * Build the setup payload with mission context baked into the system instruction.
 */
function buildOutboundSetupPayload(callCtx) {
  const contextParts = [
    "",
    "--- MISSION CONTEXT ---",
    `User name: ${callCtx?.userName || "Unknown"}`,
    `Mission objective: ${callCtx?.missionObjective || "Not specified"}`,
    `Target name: ${callCtx?.missionTargetName || "Unknown"}`,
    `Target phone: ${callCtx?.missionTargetPhone || "Unknown"}`,
  ];

  if (callCtx?.missionConstraints && Object.keys(callCtx.missionConstraints).length > 0) {
    contextParts.push(`Constraints: ${JSON.stringify(callCtx.missionConstraints)}`);
  }

  const fullInstruction = OUTBOUND_SYSTEM_INSTRUCTION_TEMPLATE + contextParts.join("\n");

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
      realtimeInputConfig: {
        automaticActivityDetection: {
          startOfSpeechSensitivity: "START_SENSITIVITY_HIGH",
          endOfSpeechSensitivity: "END_SENSITIVITY_HIGH",
          prefixPaddingMs: 40,
          silenceDurationMs: 180,
        },
        turnCoverage: "TURN_INCLUDES_ONLY_ACTIVITY",
      },
      systemInstruction: {
        parts: [{ text: fullInstruction }],
      },
      tools: [{ functionDeclarations: OUTBOUND_TOOL_DECLARATIONS }],
    },
  };
}

module.exports = { OUTBOUND_SYSTEM_INSTRUCTION_TEMPLATE, OUTBOUND_TOOL_DECLARATIONS, buildOutboundSetupPayload };

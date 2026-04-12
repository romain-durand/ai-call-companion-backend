const { MODEL } = require("../config/env");

const OUTBOUND_SYSTEM_INSTRUCTION = `You are a real-time phone assistant making an outbound call on behalf of the user. You speak French by default, but adapt if needed.

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

GENERAL BEHAVIOR
- introduce yourself: "Bonjour, je vous appelle de la part de [user name]. [objective]"
- be clear about what you need
- adapt to the person on the other end
- if they need time or ask you to call back, note it and end politely
- if you reach voicemail or no one answers after the greeting plays, report the result and end

TOOLS
- Use report_result when the mission outcome is determined (success, failure, partial, no_answer)
- Use consult_user if you need specific information from the user during the call
- Use end_call after reporting the result to hang up
- ALWAYS call report_result BEFORE end_call

SEQUENCING
1. Introduce yourself and state the purpose
2. Negotiate / gather information as needed
3. Confirm the outcome with the other party
4. Call report_result with the outcome
5. Say goodbye
6. Call end_call

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
      "Hang up the call. Use after saying goodbye. Always call report_result BEFORE calling end_call.",
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

function buildOutboundSetupPayload() {
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
        parts: [{ text: OUTBOUND_SYSTEM_INSTRUCTION }],
      },
      tools: [{ functionDeclarations: OUTBOUND_TOOL_DECLARATIONS }],
    },
  };
}

module.exports = { OUTBOUND_SYSTEM_INSTRUCTION, OUTBOUND_TOOL_DECLARATIONS, buildOutboundSetupPayload };

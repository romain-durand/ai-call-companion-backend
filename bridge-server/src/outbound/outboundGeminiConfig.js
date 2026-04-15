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

TURN TAKING
- NEVER speak first on an outbound call
- wait until the other person says something first, even if it is only "allô" or the business name
- wait for a natural pause before replying
- after they speak, introduce yourself: "Bonjour, je vous appelle de la part de [user name]. [objective]"
- do not interrupt or talk over them

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
1. Wait for the callee to answer and speak first
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

function buildOutboundSetupPayload(missionContext, options = {}) {
  const { allowConsultUser = false } = options;
  const systemParts = [{ text: OUTBOUND_SYSTEM_INSTRUCTION }];
  if (missionContext) {
    systemParts.push({ text: missionContext });
  }

  // Conditionally include consult_user tool
  const toolDeclarations = allowConsultUser
    ? OUTBOUND_TOOL_DECLARATIONS
    : OUTBOUND_TOOL_DECLARATIONS.filter((t) => t.name !== "consult_user");

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
        parts: systemParts,
      },
      tools: [{ functionDeclarations: toolDeclarations }],
    },
  };
}

module.exports = { OUTBOUND_SYSTEM_INSTRUCTION, OUTBOUND_TOOL_DECLARATIONS, buildOutboundSetupPayload };

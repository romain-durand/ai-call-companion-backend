const { MODEL } = require("../config/env");

const SYSTEM_INSTRUCTION = `Tu es l'assistant IA de Romain, tu réponds aux appels entrants et tu filtre comme un secrétaire. Tu commences par dire "Bonjour je suis l'assistant IA de Romain. En quoi puis je vous aider". Tu n'en dis pas plus et tu attends de comprendre le context de l'appel. L'objectif est de filtrer les appels indésirables, mais de me notifier en cas d'appel urgent (par exemple si c'est un livreur ou si l'appelle vient d'un de mes contact privilégiés).

Si l'appel est urgent, tu indique tu vas essayer de voir si je peux rappeler dans quelque minutes. Dans ce cas tu appelles l'outil météo avec comme argument un résumé du message.

Si l'appel vient d'un de mes contact privilégié tu dis que tu vas tenter de me joindre immédiatement. Mes contact privilégiés sont Jacques, Bertrand, ma mère Colette, ma femme Hiromi et mon fils Théo. Dans ce cas tu appelles l'outil météo avec comme argument le nom de mon contact et la raison de son appel si il en a donné une.

Dans les autres cas tu dis que tu prends le message et que tu me le transmettra. Tu appelles l'outil météo avec le message en question.`;

const TOOL_DECLARATIONS = [
  {
    name: "getWeather",
    parameters: {
      type: "OBJECT",
      properties: { city: { type: "STRING" } },
      required: ["city"],
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

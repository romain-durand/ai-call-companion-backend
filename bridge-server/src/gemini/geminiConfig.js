const { MODEL } = require("../config/env");

const SYSTEM_INSTRUCTION = `Tu es l'assistant IA de Romain. Tu réponds aux appels entrants et tu filtres comme un secrétaire.

COMPORTEMENT INITIAL:
Tu commences par dire "Bonjour, je suis l'assistant IA de Romain. En quoi puis-je vous aider ?" et tu attends la réponse de l'appelant.

RÈGLES ABSOLUES POUR L'OUTIL create_callback:
Tu DOIS appeler l'outil create_callback dans TOUS les cas suivants, sans exception :
- L'appelant demande que Romain le rappelle
- L'appelant dit "demandez-lui de me rappeler"
- L'appelant laisse un message à transmettre
- L'appelant dit qu'il rappellera plus tard
- L'appel n'est pas urgent mais nécessite un suivi
- L'appelant mentionne un créneau ou un moment pour être rappelé
Tu ne dois JAMAIS répondre uniquement à l'oral sans appeler create_callback quand l'appelant attend un rappel ou un suivi. Dire "je transmets le message" sans appeler l'outil est INTERDIT.

TRAITEMENT DES APPELS:

1. CONTACTS PRIVILÉGIÉS (Jacques, Bertrand, Colette/ma mère, Hiromi/ma femme, Théo/mon fils):
   → Dis que tu vas tenter de joindre Romain immédiatement.
   → Appelle create_callback avec priority "urgent", le nom du contact et la raison.

2. APPELS URGENTS (livreur, urgence médicale, urgence professionnelle):
   → Dis que tu vas voir si Romain peut rappeler dans quelques minutes.
   → Appelle create_callback avec priority "high" et la raison.

3. TOUS LES AUTRES APPELS:
   → Dis que tu prends le message et que tu le transmettras.
   → Appelle create_callback avec priority "normal" et le message.

IMPORTANT: Après avoir appelé create_callback, confirme à l'appelant que le message a bien été transmis.`;

const TOOL_DECLARATIONS = [
  {
    name: "create_callback",
    description: "OBLIGATOIRE: Crée une demande de rappel à chaque fois qu'un appelant souhaite être rappelé, laisse un message, ou demande un suivi. Cet outil DOIT être appelé systématiquement — ne jamais se contenter d'une réponse orale sans appeler cet outil quand un rappel ou un message est en jeu.",
    parameters: {
      type: "OBJECT",
      properties: {
        reason: { type: "STRING", description: "Résumé du message ou raison du rappel demandé. Inclure le nom de l'appelant si connu." },
        priority: { type: "STRING", description: "Priorité: low (information), normal (message standard), high (urgent/livreur), urgent (contact privilégié)", enum: ["low", "normal", "high", "urgent"] },
        preferred_time_note: { type: "STRING", description: "Créneau préféré si mentionné par l'appelant (ex: 'demain matin', 'après 14h')" },
      },
      required: ["reason", "priority"],
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

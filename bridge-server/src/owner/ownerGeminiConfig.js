/**
 * Gemini setup payload for OWNER mode (user calling their own assistant).
 *
 * The owner can:
 *  - Get help / explanations about the product
 *  - Query account info (recent calls, missions, contacts, groups)
 *  - Configure things vocally:
 *      • Special instructions per contact / group
 *      • "About me" (4 fields: about_shareable, about_confidential,
 *        current_note_shareable, current_note_confidential)
 *      • Create outbound missions
 */

const OWNER_SYSTEM_PROMPT = `Tu es l'assistant personnel vocal de l'utilisateur. Tu lui parles DIRECTEMENT — ce n'est pas un appelant externe, c'est le propriétaire du compte.

Tu peux :
1) **Aide en ligne** : expliquer tes fonctionnalités, comment configurer l'assistant, comment fonctionnent les modes, groupes, missions, etc.
2) **Consultation** : répondre à des questions sur son compte (qui a appelé, missions en cours, callbacks à traiter, contacts, groupes).
3) **Configuration vocale** :
   • Définir/modifier les instructions spéciales d'un CONTACT (ex: "Quand Marie appelle, dis-lui que je la rappelle dans la soirée").
   • Définir/modifier les instructions spéciales d'un GROUPE (ex: "Pour le groupe Travail, sois plus formel").
   • Mettre à jour son "À propos de moi" — 4 champs distincts :
       - about_shareable : info générale partageable (révélable si pertinent)
       - about_confidential : info générale STRICTEMENT confidentielle (jamais révélée)
       - current_note_shareable : note ponctuelle partageable
       - current_note_confidential : note ponctuelle STRICTEMENT confidentielle
   • Créer une mission d'appel sortant (objectif, numéro, contexte).

RÈGLES STRICTES :
- AVANT toute modification, REFORMULE clairement la valeur cible et demande confirmation explicite ("Tu veux que j'enregistre : « ... ». Je confirme ?").
- Pour une mission : confirme objectif + nom + numéro avant de créer.
- Si l'utilisateur n'est pas sûr, propose, ne décide pas pour lui.
- Réponses orales courtes, naturelles, en français.
- Ne lis jamais les outils ou les IDs techniques à voix haute.
- Si l'utilisateur veut raccrocher ou dit au revoir, appelle end_call.
`;

const OWNER_TOOL_DECLARATIONS = [
  {
    name: "get_account_overview",
    description: "Récupère les statistiques du jour : nombre d'appels reçus, callbacks en attente, missions en cours.",
    parameters: { type: "object", properties: {} },
  },
  {
    name: "list_recent_calls",
    description: "Liste les derniers appels reçus avec leur résumé court.",
    parameters: {
      type: "object",
      properties: {
        limit: { type: "number", description: "Nombre d'appels à retourner (défaut 5, max 20)." },
      },
    },
  },
  {
    name: "list_contacts_and_groups",
    description: "Liste les contacts et groupes du compte (pour pouvoir y faire référence).",
    parameters: { type: "object", properties: {} },
  },
  {
    name: "set_contact_instructions",
    description: "Met à jour les instructions spéciales pour un contact (recherche par nom).",
    parameters: {
      type: "object",
      properties: {
        contact_query: { type: "string", description: "Nom (ou bout de nom) du contact." },
        instructions: { type: "string", description: "Texte des instructions à enregistrer. Vide = effacer." },
      },
      required: ["contact_query", "instructions"],
    },
  },
  {
    name: "set_group_instructions",
    description: "Met à jour les instructions spéciales pour un groupe d'appelants (recherche par nom).",
    parameters: {
      type: "object",
      properties: {
        group_query: { type: "string", description: "Nom du groupe." },
        instructions: { type: "string", description: "Texte des instructions. Vide = effacer." },
      },
      required: ["group_query", "instructions"],
    },
  },
  {
    name: "set_about_me",
    description: "Met à jour un des 4 champs « À propos de moi » du compte.",
    parameters: {
      type: "object",
      properties: {
        field: {
          type: "string",
          enum: ["about_shareable", "about_confidential", "current_note_shareable", "current_note_confidential"],
          description: "Champ cible.",
        },
        content: { type: "string", description: "Contenu à enregistrer. Vide = effacer." },
        expires_at: { type: "string", description: "ISO date d'expiration (uniquement pour current_note_*). Optionnel." },
      },
      required: ["field", "content"],
    },
  },
  {
    name: "create_outbound_mission",
    description: "Crée une nouvelle mission d'appel sortant (l'assistant appellera quelqu'un pour le compte de l'utilisateur).",
    parameters: {
      type: "object",
      properties: {
        objective: { type: "string", description: "Objectif principal de l'appel." },
        target_phone: { type: "string", description: "Numéro à appeler (format E.164 si possible)." },
        target_name: { type: "string", description: "Nom de la personne à appeler (optionnel)." },
        context_flexible: { type: "string", description: "Contexte partageable avec l'interlocuteur (optionnel)." },
        context_secret: { type: "string", description: "Contexte STRICTEMENT confidentiel à ne jamais révéler (optionnel)." },
        allow_consult_user: { type: "boolean", description: "Autoriser l'assistant à consulter l'utilisateur en cours d'appel ?" },
        scheduled_at: { type: "string", description: "ISO date pour planifier l'appel (sinon : dès que possible)." },
      },
      required: ["objective", "target_phone"],
    },
  },
  {
    name: "end_call",
    description: "Raccrocher la session vocale.",
    parameters: {
      type: "object",
      properties: {
        reason: { type: "string", description: "Raison brève (ex: 'user_goodbye')." },
      },
    },
  },
];

function buildOwnerSetupPayload() {
  return {
    setup: {
      model: "models/gemini-2.5-flash-native-audio-preview-09-2025",
      generationConfig: {
        responseModalities: ["AUDIO"],
        speechConfig: {
          voiceConfig: { prebuiltVoiceConfig: { voiceName: "Puck" } },
          languageCode: "fr-FR",
        },
      },
      systemInstruction: { parts: [{ text: OWNER_SYSTEM_PROMPT }] },
      tools: [{ functionDeclarations: OWNER_TOOL_DECLARATIONS }],
      inputAudioTranscription: {},
      outputAudioTranscription: {},
    },
  };
}

module.exports = { buildOwnerSetupPayload, OWNER_SYSTEM_PROMPT };

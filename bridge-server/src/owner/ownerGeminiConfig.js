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

1) **Aide en ligne** : expliquer tes fonctionnalités, comment fonctionnent les modes, groupes, missions, etc.

Voici les principales fonctionnalités :

**Filtrage & gestion d'appels entrants** : tu réponds à la place de l'utilisateur (tu remplaces sa messagerie vocale). Tu sais identifier l'appelant s'il est enregistré dans ses contacts et tu sais l'associer à un groupe (ex: famille, amis, travail, inconnus). Tu sais appliquer des règles selon les groupes.

**Comportements possibles** : tu sais prendre un message, transférer en direct un appel, consulter l'utilisateur par chat en direct, prendre un RDV ou bloquer l'appel. Si des instructions personnalisées sont associées au contact ou au groupe, tu sais prendre en compte ces instructions spéciales.

**Groupes d'appelants** : des groupes existent par défaut et on peut les modifier, en effacer ou en ajouter.

**Contacts** : il y a une fiche par personne (nom, numéro, instructions spéciales personnalisées, appartenance à un ou plusieurs groupes).

**Modes assistant** : Travail, Personnel, Concentration — un seul actif à la fois ; chaque mode définit comment chaque groupe est traité avec des règles spéciales (par exemple en mode Personnel, un appelant du groupe Travail ne sera pas transféré en direct). Il y a aussi un mode par défaut « Autonomie totale » où c'est l'assistant qui prend les décisions au mieux.

**Calendrier** : prise de RDV automatique avec consultation et gestion du calendrier Google. Il faut au préalable avoir connecté son calendrier Google dans les réglages. Si on a plusieurs calendriers, on peut choisir dans les réglages les calendriers à utiliser pour vérifier la disponibilité et celui à utiliser pour la prise de rendez-vous.

**Historique & résumés** : chaque appel a un résumé court + long généré automatiquement, consultable. La transcription complète de la conversation est aussi consultable dans l'historique.

**Missions sortantes** : cette fonctionnalité te permet d'appeler quelqu'un pour le compte de l'utilisateur (ex: réservation d'un restaurant, ou appeler un proche pendant une réunion — par exemple demander à son conjoint d'aller chercher l'enfant à la crèche). Il faut au minimum préciser un objectif et un destinataire (contact existant ou numéro de téléphone). En option : un **contexte partageable** (infos que tu peux révéler si nécessaire mais pas systématiquement), un **contexte secret** (infos que tu connais mais ne dois JAMAIS révéler), et la possibilité pour l'utilisateur de demander à être consulté par chat en cours d'appel (utile s'il ne peut pas parler).

**Contexte utilisateur ("À propos de moi")** : l'utilisateur peut définir un contexte le concernant pour que tes réponses soient plus pertinentes. Il y a deux temporalités et deux niveaux de confidentialité, soit 4 champs :
   - **À propos de moi — partageable** (about_shareable) : info GÉNÉRALE et DURABLE sur l'utilisateur que tu peux révéler à un appelant si c'est pertinent (ex: "Je suis avocat en droit du travail, basé à Paris"). Ne la révèle pas systématiquement, mais utilise-la pour donner du contexte aux interlocuteurs quand utile.
   - **À propos de moi — confidentielle** (about_confidential) : info GÉNÉRALE et DURABLE que tu dois CONNAÎTRE pour mieux servir l'utilisateur, mais que tu ne révèles JAMAIS à personne (ex: "Mon associé principal est X", "J'évite les commerciaux après 18h pour raisons familiales"). Sert à mieux décider sans exposer.
   - **Note actuelle — partageable** (current_note_shareable) : info PONCTUELLE / TEMPORAIRE partageable, optionnellement avec une date d'expiration (ex: "Je suis en déplacement à Lyon cette semaine, joignable par mail").
   - **Note actuelle — confidentielle** (current_note_confidential) : info PONCTUELLE / TEMPORAIRE strictement secrète (ex: "Je négocie un deal sensible avec X — ne mentionne aucun rendez-vous lié"). Permet d'éviter des bourdes contextuelles.

   Quand l'utilisateur te demande "qu'est-ce que je dois mettre ?", propose des exemples adaptés et explique clairement la différence entre les 4 champs (durable vs ponctuel, partageable vs confidentiel).

2) **Consultation** : répondre à des questions sur son compte (qui a appelé, missions en cours, callbacks à traiter, contacts, groupes).

3) **Configuration vocale** :
   • Définir/modifier les instructions spéciales d'un CONTACT (ex: "Quand Marie appelle, dis-lui que je la rappelle dans la soirée").
   • Définir/modifier les instructions spéciales d'un GROUPE (ex: "Pour le groupe Travail, sois plus formel").
   • Mettre à jour un des 4 champs « À propos de moi » (cf. ci-dessus).
   • Créer une mission d'appel sortant (objectif, numéro, contexte).

RÈGLES STRICTES :
- AVANT toute modification, REFORMULE clairement la valeur cible et demande confirmation explicite ("Tu veux que j'enregistre : « ... ». Je confirme ?").
- Pour une mission : confirme objectif + nom + numéro avant de créer. Demande TOUJOURS si la mission doit être lancée immédiatement (dès que possible) ou programmée à une date/heure précise. Si immédiat, n'envoie PAS scheduled_at. Si programmée, convertis en ISO 8601 avec le fuseau de l'utilisateur et passe-la dans scheduled_at.
- ÉPELLATION DES NUMÉROS DE TÉLÉPHONE : quand tu énonces un numéro à voix haute pour confirmation, lis-le à la française si c'est un numéro français (commençant par +33 ou 0). Convertis +33 en 0 puis groupe par paires : par exemple "+33663859064" se dit « zéro six, soixante-trois, quatre-vingt-cinq, quatre-vingt-dix, soixante-quatre ». Pour les autres pays, énonce le code pays puis groupe les chiffres de manière naturelle pour la langue.
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

// Mock data for the SaaS dashboard

export interface Call {
  id: string;
  callerName: string;
  callerNumber: string;
  group: CallerGroupType;
  timestamp: Date;
  duration: number;
  status: "answered" | "missed" | "blocked" | "voicemail";
  summary: string;
  transcript?: string;
  actions: CallAction[];
  urgent: boolean;
  reasoning?: string;
}

export interface CallAction {
  type: "appointment" | "message" | "escalation" | "callback" | "info" | "blocked";
  description: string;
  timestamp: Date;
}

export type CallerGroupType = "family" | "clients" | "unknown" | "deliveries" | "vip";
export type ProfileMode = "work" | "personal" | "night" | "focus";

export type BehaviorType =
  | "always_let_through"
  | "assistant_first"
  | "take_message"
  | "propose_meeting"
  | "notify_urgent"
  | "never_interrupt";

export interface BehaviorOption {
  id: BehaviorType;
  label: string;
  description: string;
  emoji: string;
  preview: string;
}

export const behaviorOptions: BehaviorOption[] = [
  {
    id: "always_let_through",
    label: "Laisser passer",
    description: "L'appel vous est transféré directement",
    emoji: "📞",
    preview: "vous seront transférés immédiatement, sans filtrage.",
  },
  {
    id: "assistant_first",
    label: "L'assistant répond",
    description: "Aria décroche, vous décidez ensuite",
    emoji: "🤖",
    preview: "seront d'abord accueillis par Aria. Vous recevrez un résumé pour décider.",
  },
  {
    id: "take_message",
    label: "Prendre un message",
    description: "Aria prend un message et vous le transmet",
    emoji: "✉️",
    preview: "seront invités à laisser un message. Vous le recevrez par notification.",
  },
  {
    id: "propose_meeting",
    label: "Proposer un RDV",
    description: "Aria propose un créneau depuis votre agenda",
    emoji: "📅",
    preview: "se verront proposer un rendez-vous selon vos disponibilités.",
  },
  {
    id: "notify_urgent",
    label: "Seulement si urgent",
    description: "Vous n'êtes notifié que si c'est important",
    emoji: "🔔",
    preview: "ne vous dérangeront que si Aria détecte une urgence.",
  },
  {
    id: "never_interrupt",
    label: "Ne jamais déranger",
    description: "Aucune interruption, aucune notification",
    emoji: "🔇",
    preview: "seront entièrement gérés par Aria, sans vous déranger.",
  },
];

export interface CallerGroup {
  id: CallerGroupType;
  label: string;
  emoji: string;
  description: string;
  defaultBehavior: BehaviorType;
  memberCount: number;
  color: string;
}

export interface Profile {
  id: ProfileMode;
  label: string;
  emoji: string;
  description: string;
  active: boolean;
  rules: ProfileRule[];
}

export interface ProfileRule {
  group: CallerGroupType;
  action: "answer" | "voicemail" | "block" | "escalate";
}

export interface SmartScenario {
  id: string;
  label: string;
  emoji: string;
  description: string;
  preview: string;
  enabled: boolean;
  configurable: boolean;
  config?: Record<string, string>;
}

export type UrgencyLevel = "low" | "normal" | "high";
export type EscalationBehavior = "call_immediately" | "send_notification" | "ignore_unless_critical";

export interface UrgencyConfig {
  level: UrgencyLevel;
  escalation: EscalationBehavior;
}

export const urgencyLevels: { id: UrgencyLevel; label: string; emoji: string; description: string; example: string }[] = [
  {
    id: "low",
    label: "Détendu",
    emoji: "😌",
    description: "Très peu d'interruptions",
    example: "Seuls les appels répétés de vos proches déclenchent une alerte",
  },
  {
    id: "normal",
    label: "Équilibré",
    emoji: "⚖️",
    description: "Alerte pour les situations raisonnablement urgentes",
    example: "Un médecin qui rappelle, un client insistant, une livraison bloquée",
  },
  {
    id: "high",
    label: "Vigilant",
    emoji: "🚨",
    description: "Soyez alerté au moindre doute",
    example: "Tout appel jugé potentiellement important déclenche une notification",
  },
];

export const escalationOptions: { id: EscalationBehavior; label: string; emoji: string; description: string }[] = [
  {
    id: "call_immediately",
    label: "M'appeler immédiatement",
    emoji: "📱",
    description: "Aria vous appelle directement pour vous transférer l'appel",
  },
  {
    id: "send_notification",
    label: "Envoyer une notification",
    emoji: "🔔",
    description: "Vous recevez une alerte avec le résumé de la situation",
  },
  {
    id: "ignore_unless_critical",
    label: "Ignorer sauf urgence vitale",
    emoji: "🛡️",
    description: "Seules les urgences médicales ou de sécurité passent",
  },
];

export const smartScenarios: SmartScenario[] = [
  {
    id: "delivery",
    label: "Appel de livraison",
    emoji: "📦",
    description: "Un livreur appelle pour votre colis",
    preview: "Aria donne le code d'accès et les instructions automatiquement.",
    enabled: true,
    configurable: true,
    config: { code: "4521B", floor: "3e étage, porte droite" },
  },
  {
    id: "urgent_repeat",
    label: "Appelant insistant",
    emoji: "🔁",
    description: "Quelqu'un vous appelle plusieurs fois de suite",
    preview: "Après 2 appels en 10 minutes, Aria vous alerte immédiatement.",
    enabled: true,
    configurable: false,
  },
  {
    id: "family_emergency",
    label: "Urgence familiale",
    emoji: "🚑",
    description: "Un proche mentionne une urgence",
    preview: "Si un membre de votre famille dit « urgence » ou « hôpital », vous êtes alerté immédiatement.",
    enabled: true,
    configurable: false,
  },
  {
    id: "new_client",
    label: "Nouveau prospect",
    emoji: "💼",
    description: "Un potentiel client appelle pour la première fois",
    preview: "Aria qualifie la demande, prend les coordonnées et propose un créneau.",
    enabled: true,
    configurable: false,
  },
  {
    id: "after_hours",
    label: "Appels hors horaires",
    emoji: "🌙",
    description: "Appels reçus en dehors de vos heures de travail",
    preview: "Aria explique poliment vos horaires et propose de rappeler ou laisser un message.",
    enabled: false,
    configurable: true,
    config: { hours: "09:00 - 18:00" },
  },
];

export const callerGroups: CallerGroup[] = [
  { id: "family", label: "Proches", emoji: "👨‍👩‍👧‍👦", description: "Famille et amis proches", defaultBehavior: "always_let_through", memberCount: 8, color: "hsl(170 65% 47%)" },
  { id: "vip", label: "VIP", emoji: "⭐", description: "Contacts prioritaires", defaultBehavior: "assistant_first", memberCount: 5, color: "hsl(45 85% 55%)" },
  { id: "clients", label: "Clients", emoji: "💼", description: "Clients et partenaires", defaultBehavior: "propose_meeting", memberCount: 23, color: "hsl(220 65% 58%)" },
  { id: "deliveries", label: "Livreurs", emoji: "📦", description: "Livraisons et services", defaultBehavior: "assistant_first", memberCount: 4, color: "hsl(152 55% 45%)" },
  { id: "unknown", label: "Inconnus", emoji: "❓", description: "Numéros non identifiés", defaultBehavior: "notify_urgent", memberCount: 0, color: "hsl(0 0% 45%)" },
];

export const profiles: Profile[] = [
  {
    id: "work",
    label: "Travail",
    emoji: "💼",
    description: "Heures de bureau — priorise les clients et VIP",
    active: true,
    rules: [
      { group: "family", action: "escalate" },
      { group: "vip", action: "answer" },
      { group: "clients", action: "answer" },
      { group: "deliveries", action: "voicemail" },
      { group: "unknown", action: "voicemail" },
    ],
  },
  {
    id: "personal",
    label: "Personnel",
    emoji: "🏠",
    description: "Temps libre — famille et amis en priorité",
    active: false,
    rules: [
      { group: "family", action: "answer" },
      { group: "vip", action: "answer" },
      { group: "clients", action: "voicemail" },
      { group: "deliveries", action: "answer" },
      { group: "unknown", action: "block" },
    ],
  },
  {
    id: "night",
    label: "Nuit",
    emoji: "🌙",
    description: "Ne déranger qu'en cas d'urgence",
    active: false,
    rules: [
      { group: "family", action: "escalate" },
      { group: "vip", action: "voicemail" },
      { group: "clients", action: "voicemail" },
      { group: "deliveries", action: "block" },
      { group: "unknown", action: "block" },
    ],
  },
  {
    id: "focus",
    label: "Focus",
    emoji: "🎯",
    description: "Concentration totale — tout en messagerie",
    active: false,
    rules: [
      { group: "family", action: "voicemail" },
      { group: "vip", action: "voicemail" },
      { group: "clients", action: "voicemail" },
      { group: "deliveries", action: "voicemail" },
      { group: "unknown", action: "block" },
    ],
  },
];

const now = new Date();
const hours = (h: number) => new Date(now.getTime() - h * 3600000);
const mins = (m: number) => new Date(now.getTime() - m * 60000);

export const recentCalls: Call[] = [
  {
    id: "c1",
    callerName: "Marie Dupont",
    callerNumber: "+33 6 12 34 56 78",
    group: "family",
    timestamp: mins(12),
    duration: 45,
    status: "answered",
    summary: "Marie a demandé si vous étiez disponible ce weekend pour un dîner. Aria a vérifié votre calendrier et confirmé samedi soir.",
    reasoning: "Appelante identifiée comme « Proches ». Profil Travail actif → comportement escalade. L'appel ne semble pas urgent, j'ai vérifié le calendrier et répondu directement.",
    transcript: "Aria: Bonjour, vous êtes sur la ligne de Romain. Je suis Aria, son assistante. Comment puis-je vous aider ?\n\nMarie: Salut Aria ! C'est Marie, sa sœur. Est-ce qu'il est libre ce weekend pour dîner ?\n\nAria: Bonjour Marie ! Laissez-moi vérifier son calendrier... Romain est disponible samedi soir à partir de 19h. Souhaitez-vous que je réserve ce créneau ?\n\nMarie: Oui, parfait ! On se retrouve chez moi à 19h30.\n\nAria: C'est noté — dîner chez Marie, samedi à 19h30. Je préviens Romain. Bonne journée Marie !",
    actions: [
      { type: "appointment", description: "Dîner samedi 19h30 chez Marie — ajouté au calendrier", timestamp: mins(11) },
      { type: "message", description: "Notification envoyée à Romain avec le résumé", timestamp: mins(11) },
    ],
    urgent: false,
  },
  {
    id: "c2",
    callerName: "Dr. Laurent",
    callerNumber: "+33 1 45 67 89 00",
    group: "vip",
    timestamp: mins(47),
    duration: 120,
    status: "answered",
    summary: "Appel urgent du Dr. Laurent concernant des résultats d'analyses à communiquer rapidement. Escaladé immédiatement.",
    reasoning: "Contact VIP. Le Dr. Laurent a mentionné « résultats importants » et « rappeler rapidement ». Mots-clés d'urgence détectés → escalade immédiate.",
    transcript: "Aria: Bonjour, ligne de Romain, Aria à votre service.\n\nDr. Laurent: Bonjour Aria, c'est le Dr. Laurent. J'ai des résultats d'analyses importants pour Romain, il faut que je lui parle rapidement.\n\nAria: Bien sûr docteur, je détecte que c'est urgent. Je transfère l'appel immédiatement.\n\n[Transfert en cours...]\n\nAria: Romain, le Dr. Laurent est en ligne avec des résultats d'analyses urgents.",
    actions: [
      { type: "escalation", description: "Appel transféré immédiatement — urgence médicale détectée", timestamp: mins(46) },
    ],
    urgent: true,
  },
  {
    id: "c3",
    callerName: "Sophie Martin",
    callerNumber: "+33 6 98 76 54 32",
    group: "clients",
    timestamp: hours(2),
    duration: 90,
    status: "answered",
    summary: "Sophie souhaite reprogrammer la réunion de mercredi. Aria a trouvé un créneau jeudi 14h et confirmé la modification.",
    reasoning: "Contact « Clients ». Demande de reprogrammation de réunion → vérification du calendrier. Créneau jeudi 14h disponible, confirmation envoyée aux deux parties.",
    transcript: "Aria: Bonjour, cabinet de Romain, Aria à votre service.\n\nSophie: Bonjour Aria, c'est Sophie Martin de chez Nexus Digital. Je voulais reprogrammer notre réunion de mercredi, un imprévu.\n\nAria: Pas de souci Sophie. Voyons les disponibilités... Romain est libre jeudi à 10h, 14h ou vendredi matin. Quelle option vous convient ?\n\nSophie: Jeudi 14h, c'est parfait.\n\nAria: C'est confirmé. Je mets à jour les calendriers et je vous envoie une confirmation. À jeudi Sophie !",
    actions: [
      { type: "appointment", description: "Réunion replanifiée — mercredi → jeudi 14h", timestamp: hours(2) },
      { type: "message", description: "Confirmation envoyée par email à Sophie et Romain", timestamp: hours(2) },
    ],
    urgent: false,
  },
  {
    id: "c4",
    callerName: "DPD Livraison",
    callerNumber: "+33 9 69 39 10 00",
    group: "deliveries",
    timestamp: hours(3),
    duration: 35,
    status: "answered",
    summary: "Livreur DPD avec un colis. Aria a communiqué le code d'accès et les instructions de livraison automatiquement.",
    reasoning: "Numéro identifié comme service de livraison. Scénario « Appel de livraison » activé → transmission automatique du code et des instructions.",
    transcript: "Aria: Bonjour, ligne de Romain. Aria, assistante personnelle.\n\nLivreur: Bonjour, DPD livraison, j'ai un colis pour M. Romain au 42 rue des Lilas. Je suis en bas de l'immeuble.\n\nAria: Parfait ! Le code de l'immeuble est 4521B. Montez au 3e étage, porte de droite. Vous pouvez laisser le colis devant la porte si personne ne répond.\n\nLivreur: Super, merci beaucoup !\n\nAria: Bonne journée !",
    actions: [
      { type: "info", description: "Code immeuble 4521B et étage communiqués au livreur", timestamp: hours(3) },
    ],
    urgent: false,
  },
  {
    id: "c5",
    callerName: "Spam — Assurance auto",
    callerNumber: "+33 1 00 00 00 00",
    group: "unknown",
    timestamp: hours(4),
    duration: 0,
    status: "blocked",
    summary: "Numéro identifié comme démarchage commercial (base de signalements). Appel bloqué automatiquement.",
    reasoning: "Numéro inconnu figurant dans la base de signalements de spam. Aucune action requise → bloqué silencieusement.",
    actions: [
      { type: "blocked", description: "Numéro signalé comme spam — bloqué automatiquement", timestamp: hours(4) },
    ],
    urgent: false,
  },
  {
    id: "c6",
    callerName: "Papa",
    callerNumber: "+33 6 11 22 33 44",
    group: "family",
    timestamp: hours(5),
    duration: 55,
    status: "answered",
    summary: "Votre père a appelé pour confirmer le déjeuner familial de dimanche midi. Aria a confirmé votre présence.",
    reasoning: "Contact « Proches ». Pas d'urgence détectée. Demande simple de confirmation → vérification calendrier et confirmation directe.",
    transcript: "Aria: Bonjour, c'est Aria sur la ligne de Romain.\n\nPapa: Bonjour Aria ! C'est son père. Je voulais confirmer qu'on se voit dimanche midi pour le déjeuner ?\n\nAria: Bonjour ! Romain est bien disponible dimanche. À quelle heure souhaitez-vous ?\n\nPapa: 12h30 comme d'habitude, chez nous.\n\nAria: Parfait, c'est noté dans son agenda. Déjeuner familial dimanche 12h30. Il sera là !",
    actions: [
      { type: "appointment", description: "Déjeuner familial dimanche 12h30 — confirmé", timestamp: hours(5) },
    ],
    urgent: false,
  },
  {
    id: "c7",
    callerName: "Alexandre Petit",
    callerNumber: "+33 6 55 44 33 22",
    group: "clients",
    timestamp: hours(8),
    duration: 0,
    status: "voicemail",
    summary: "Alexandre a laissé un message vocal détaillé demandant un devis pour un projet de refonte web. Budget estimé 15-20k€.",
    reasoning: "Contact « Clients ». Romain indisponible → messagerie. Le message contient une demande de devis qualifiée avec un budget mentionné. Priorité : rappel suggéré.",
    actions: [
      { type: "callback", description: "Rappel prioritaire suggéré — prospect qualifié, devis 15-20k€", timestamp: hours(8) },
      { type: "message", description: "Transcription vocale envoyée par notification", timestamp: hours(8) },
    ],
    urgent: false,
  },
  {
    id: "c8",
    callerName: "Maman",
    callerNumber: "+33 6 77 88 99 00",
    group: "family",
    timestamp: hours(24),
    duration: 180,
    status: "answered",
    summary: "Votre mère a discuté des vacances d'été. Aria a pris note des dates proposées (15-30 août) et les a ajoutées en brouillon.",
    reasoning: "Contact « Proches ». Conversation longue, sujet non urgent. Prise de notes automatique des informations clés mentionnées.",
    actions: [
      { type: "message", description: "Note créée : vacances proposées du 15 au 30 août en Bretagne", timestamp: hours(24) },
    ],
    urgent: false,
  },
  {
    id: "c9",
    callerName: "Cabinet dentaire",
    callerNumber: "+33 1 42 55 66 77",
    group: "unknown",
    timestamp: hours(26),
    duration: 40,
    status: "answered",
    summary: "Rappel de rendez-vous dentaire mardi prochain 10h. Aria a confirmé et ajouté un rappel au calendrier.",
    reasoning: "Numéro inconnu mais l'appelant s'est identifié comme cabinet médical. Contenu non urgent. Confirmation automatique et ajout calendrier.",
    transcript: "Aria: Bonjour, ligne de Romain.\n\nSecrétaire: Bonjour, c'est le cabinet dentaire du Dr. Benoit. Je vous appelle pour confirmer votre rendez-vous mardi prochain à 10h.\n\nAria: Bonjour, laissez-moi vérifier... Oui, c'est bien noté. Je confirme la présence de Romain mardi à 10h.\n\nSecrétaire: Parfait, merci et bonne journée !",
    actions: [
      { type: "appointment", description: "RDV dentaire mardi 10h — confirmé avec rappel J-1", timestamp: hours(26) },
    ],
    urgent: false,
  },
  {
    id: "c10",
    callerName: "Numéro masqué",
    callerNumber: "Numéro masqué",
    group: "unknown",
    timestamp: hours(30),
    duration: 8,
    status: "missed",
    summary: "Appel depuis un numéro masqué. L'appelant a raccroché après 8 secondes sans laisser de message.",
    reasoning: "Numéro masqué, aucune identification possible. L'appelant n'a pas souhaité interagir avec l'assistante. Aucune action requise.",
    actions: [],
    urgent: false,
  },
];

export const dashboardStats = {
  callsToday: 6,
  callsThisWeek: 28,
  appointmentsBooked: 4,
  escalations: 1,
  blocked: 3,
  averageDuration: 65,
  messagesLeft: 7,
  satisfactionRate: 96,
};

export const bookingRules = {
  minNotice: 2,
  maxPerDay: 4,
  slotDuration: 30,
  workingHours: { start: "09:00", end: "18:00" },
  workingDays: [1, 2, 3, 4, 5],
  bufferBetween: 15,
};

// Test scenarios for the "Test my assistant" feature
export interface TestScenario {
  id: string;
  label: string;
  emoji: string;
  description: string;
  callerGroup: CallerGroupType;
  isUrgent: boolean;
  simulatedDialogue: { speaker: "caller" | "aria"; text: string }[];
  expectedActions: string[];
}

export const testScenarios: TestScenario[] = [
  {
    id: "test_delivery",
    label: "Un livreur sonne",
    emoji: "📦",
    description: "Un livreur Amazon appelle pour déposer un colis",
    callerGroup: "deliveries",
    isUrgent: false,
    simulatedDialogue: [
      { speaker: "aria", text: "Bonjour, vous êtes sur la ligne de Romain. Je suis Aria, son assistante." },
      { speaker: "caller", text: "Bonjour, c'est Amazon. J'ai un colis pour M. Romain, je suis en bas." },
      { speaker: "aria", text: "Le code de l'immeuble est 4521B. Montez au 3e étage, porte de droite." },
      { speaker: "caller", text: "Merci !" },
      { speaker: "aria", text: "Bonne journée ! Je notifie Romain de votre passage." },
    ],
    expectedActions: ["Code d'accès communiqué", "Notification envoyée"],
  },
  {
    id: "test_urgent_family",
    label: "Urgence familiale",
    emoji: "🚑",
    description: "Votre mère appelle en mentionnant une urgence",
    callerGroup: "family",
    isUrgent: true,
    simulatedDialogue: [
      { speaker: "aria", text: "Bonjour, ligne de Romain." },
      { speaker: "caller", text: "Aria, c'est sa mère ! C'est urgent, son père est à l'hôpital !" },
      { speaker: "aria", text: "Je comprends l'urgence. Je transfère immédiatement l'appel à Romain." },
    ],
    expectedActions: ["Urgence détectée — mots-clés : hôpital", "Appel transféré immédiatement"],
  },
  {
    id: "test_new_client",
    label: "Nouveau prospect",
    emoji: "💼",
    description: "Un potentiel client appelle pour la première fois",
    callerGroup: "clients",
    isUrgent: false,
    simulatedDialogue: [
      { speaker: "aria", text: "Bonjour, cabinet de Romain. Je suis Aria, son assistante. Comment puis-je vous aider ?" },
      { speaker: "caller", text: "Bonjour, je suis Thomas de StartupXYZ. On cherche un freelance pour un projet d'app mobile." },
      { speaker: "aria", text: "Merci Thomas ! Pouvez-vous me donner plus de détails sur le projet et votre budget approximatif ?" },
      { speaker: "caller", text: "On vise une app iOS/Android, budget autour de 25k€, livraison en 3 mois." },
      { speaker: "aria", text: "Parfait. Je note tout ça et je propose un créneau cette semaine. Jeudi 15h vous conviendrait ?" },
      { speaker: "caller", text: "Jeudi 15h, c'est parfait !" },
      { speaker: "aria", text: "C'est noté ! Vous recevrez une confirmation par email. À jeudi Thomas !" },
    ],
    expectedActions: ["Prospect qualifié — budget 25k€", "RDV jeudi 15h proposé et confirmé", "Fiche contact créée"],
  },
  {
    id: "test_spam",
    label: "Appel de spam",
    emoji: "🚫",
    description: "Un démarcheur commercial insistant",
    callerGroup: "unknown",
    isUrgent: false,
    simulatedDialogue: [
      { speaker: "aria", text: "Bonjour, ligne de Romain." },
      { speaker: "caller", text: "Bonjour monsieur ! Vous avez été sélectionné pour une offre exceptionnelle sur—" },
      { speaker: "aria", text: "Je vous arrête — Romain ne souhaite pas être démarché. Merci de retirer ce numéro de votre liste. Au revoir." },
    ],
    expectedActions: ["Démarchage détecté", "Appel terminé poliment", "Numéro ajouté à la liste de blocage"],
  },
];

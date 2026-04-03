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
}

export interface CallAction {
  type: "appointment" | "message" | "escalation" | "callback" | "info";
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
  { id: "family", label: "Proches", emoji: "👨‍👩‍👧‍👦", description: "Famille et amis proches", defaultBehavior: "always_let_through", memberCount: 8, color: "hsl(175 70% 50%)" },
  { id: "vip", label: "VIP", emoji: "⭐", description: "Contacts prioritaires", defaultBehavior: "assistant_first", memberCount: 5, color: "hsl(45 90% 55%)" },
  { id: "clients", label: "Clients", emoji: "💼", description: "Clients et partenaires", defaultBehavior: "propose_meeting", memberCount: 23, color: "hsl(220 70% 60%)" },
  { id: "deliveries", label: "Livreurs", emoji: "📦", description: "Livraisons et services", defaultBehavior: "assistant_first", memberCount: 4, color: "hsl(145 60% 45%)" },
  { id: "unknown", label: "Inconnus", emoji: "❓", description: "Numéros non identifiés", defaultBehavior: "notify_urgent", memberCount: 0, color: "hsl(0 0% 50%)" },
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
    summary: "Marie a demandé si tu étais disponible ce weekend pour un dîner. L'assistant a vérifié ton calendrier et confirmé que samedi soir est libre.",
    transcript: "Assistant: Bonjour, vous êtes sur la messagerie de Romain. Comment puis-je vous aider ?\nMarie: Salut, c'est Marie ! Est-ce que Romain est libre ce weekend pour dîner ?\nAssistant: Laissez-moi vérifier son calendrier... Romain est disponible samedi soir. Souhaitez-vous que je bloque ce créneau ?\nMarie: Oui, ce serait parfait ! Merci.\nAssistant: C'est noté. Romain sera informé. Bonne journée Marie !",
    actions: [
      { type: "appointment", description: "Dîner samedi soir bloqué dans le calendrier", timestamp: mins(11) },
      { type: "message", description: "Notification envoyée à Romain", timestamp: mins(11) },
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
    summary: "Appel urgent du Dr. Laurent concernant des résultats d'analyses. L'assistant a escaladé immédiatement.",
    actions: [
      { type: "escalation", description: "Appel transféré — marqué comme urgent", timestamp: mins(46) },
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
    summary: "Sophie souhaite reprogrammer la réunion de mercredi. L'assistant a proposé jeudi 14h et confirmé le nouveau créneau.",
    actions: [
      { type: "appointment", description: "Réunion déplacée au jeudi 14h", timestamp: hours(2) },
      { type: "message", description: "Confirmation envoyée par SMS", timestamp: hours(2) },
    ],
    urgent: false,
  },
  {
    id: "c4",
    callerName: "Chronopost",
    callerNumber: "+33 9 69 39 10 00",
    group: "deliveries",
    timestamp: hours(3),
    duration: 30,
    status: "answered",
    summary: "Livreur Chronopost pour un colis. L'assistant a donné les instructions d'accès et le code de l'immeuble.",
    actions: [
      { type: "info", description: "Code immeuble et étage communiqués", timestamp: hours(3) },
    ],
    urgent: false,
  },
  {
    id: "c5",
    callerName: "Numéro inconnu",
    callerNumber: "+33 1 00 00 00 00",
    group: "unknown",
    timestamp: hours(4),
    duration: 0,
    status: "blocked",
    summary: "Appel d'un numéro inconnu identifié comme potentiel démarchage. Bloqué automatiquement.",
    actions: [],
    urgent: false,
  },
  {
    id: "c6",
    callerName: "Papa",
    callerNumber: "+33 6 11 22 33 44",
    group: "family",
    timestamp: hours(5),
    duration: 60,
    status: "answered",
    summary: "Ton père a appelé pour confirmer le déjeuner de dimanche. L'assistant a confirmé ta présence.",
    actions: [
      { type: "appointment", description: "Déjeuner dimanche 12h30 confirmé", timestamp: hours(5) },
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
    summary: "Alexandre a laissé un message vocal demandant un devis pour le projet web.",
    actions: [
      { type: "callback", description: "Rappel suggéré — demande de devis", timestamp: hours(8) },
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
    summary: "Appel de ta mère, elle voulait discuter des vacances d'été. L'assistant a pris note des dates proposées.",
    actions: [
      { type: "message", description: "Note : vacances proposées du 15 au 30 août", timestamp: hours(24) },
    ],
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
};

export const bookingRules = {
  minNotice: 2,
  maxPerDay: 4,
  slotDuration: 30,
  workingHours: { start: "09:00", end: "18:00" },
  workingDays: [1, 2, 3, 4, 5],
  bufferBetween: 15,
};

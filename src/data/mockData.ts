// Mock data for the SaaS dashboard

export interface Call {
  id: string;
  callerName: string;
  callerNumber: string;
  group: CallerGroupType;
  timestamp: Date;
  duration: number; // seconds
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

export interface CallerGroup {
  id: CallerGroupType;
  label: string;
  emoji: string;
  description: string;
  defaultBehavior: string;
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

export const callerGroups: CallerGroup[] = [
  { id: "family", label: "Famille", emoji: "👨‍👩‍👧‍👦", description: "Proches et famille", defaultBehavior: "Toujours transférer", memberCount: 8, color: "hsl(175 70% 50%)" },
  { id: "vip", label: "VIP", emoji: "⭐", description: "Contacts prioritaires", defaultBehavior: "Répondre et notifier", memberCount: 5, color: "hsl(45 90% 55%)" },
  { id: "clients", label: "Clients", emoji: "💼", description: "Clients et partenaires", defaultBehavior: "Prendre message + RDV", memberCount: 23, color: "hsl(220 70% 60%)" },
  { id: "deliveries", label: "Livreurs", emoji: "📦", description: "Livraisons et services", defaultBehavior: "Instructions automatiques", memberCount: 4, color: "hsl(145 60% 45%)" },
  { id: "unknown", label: "Inconnus", emoji: "❓", description: "Numéros non identifiés", defaultBehavior: "Filtrage intelligent", memberCount: 0, color: "hsl(0 0% 50%)" },
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
  minNotice: 2, // hours
  maxPerDay: 4,
  slotDuration: 30, // minutes
  workingHours: { start: "09:00", end: "18:00" },
  workingDays: [1, 2, 3, 4, 5], // Mon-Fri
  bufferBetween: 15, // minutes
};

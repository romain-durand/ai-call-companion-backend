import type { CallbackRequestItem } from "../types";

const now = new Date();
const mins = (m: number) => new Date(now.getTime() - m * 60000);

function formatDate(d: Date) {
  const diffMin = Math.floor((now.getTime() - d.getTime()) / 60000);
  if (diffMin < 60) return `il y a ${diffMin} min`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `il y a ${diffH}h`;
  return d.toLocaleDateString("fr-FR");
}

export function getDemoCallbackRequests(): CallbackRequestItem[] {
  return [
    {
      id: "demo-cb-1",
      callerLabel: "Mathieu Poujol",
      reason: "Rappeler demain matin pour discuter du projet",
      priority: "normal",
      preferredTimeNote: "Demain matin",
      status: "pending",
      statusLabel: "En attente",
      createdAtLabel: formatDate(mins(25)),
    },
    {
      id: "demo-cb-2",
      callerLabel: "Sophie Martin",
      reason: "Souhaite modifier le devis envoyé la semaine dernière",
      priority: "high",
      preferredTimeNote: "Avant vendredi",
      status: "pending",
      statusLabel: "En attente",
      createdAtLabel: formatDate(mins(180)),
    },
    {
      id: "demo-cb-3",
      callerLabel: "+33 6 98 76 54 32",
      reason: "Demande de renseignement sur les tarifs",
      priority: "low",
      preferredTimeNote: null,
      status: "pending",
      statusLabel: "En attente",
      createdAtLabel: formatDate(mins(420)),
    },
  ];
}

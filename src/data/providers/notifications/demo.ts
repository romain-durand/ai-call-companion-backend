import type { NotificationItem } from "../types";

const now = new Date();
const mins = (m: number) => new Date(now.getTime() - m * 60000);

function formatDate(d: Date) {
  const diffMin = Math.floor((now.getTime() - d.getTime()) / 60000);
  if (diffMin < 60) return `il y a ${diffMin} min`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `il y a ${diffH}h`;
  return d.toLocaleDateString("fr-FR");
}

export function getDemoNotifications(): NotificationItem[] {
  return [
    {
      id: "demo-n-1",
      title: "Demande de rappel créée",
      body: "Mathieu Poujol souhaite être rappelé demain matin",
      priority: "normal",
      status: "delivered",
      statusLabel: "Délivrée",
      createdAtLabel: formatDate(mins(25)),
    },
    {
      id: "demo-n-2",
      title: "Appel urgent détecté",
      body: "Dr. Laurent — résultats d'analyses importants",
      priority: "high",
      status: "delivered",
      statusLabel: "Délivrée",
      createdAtLabel: formatDate(mins(50)),
    },
    {
      id: "demo-n-3",
      title: "RDV confirmé",
      body: "Réunion avec Sophie Martin — jeudi 14h",
      priority: "low",
      status: "sent",
      statusLabel: "Envoyée",
      createdAtLabel: formatDate(mins(130)),
    },
  ];
}

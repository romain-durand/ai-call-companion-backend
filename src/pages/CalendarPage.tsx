import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { bookingRules } from "@/data/mockData";

const dayNames = ["", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];

export default function CalendarPage() {
  return (
    <div className="space-y-8 max-w-3xl">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Calendrier</h1>
        <p className="text-sm text-muted-foreground mt-1">Gérez vos disponibilités et règles de réservation.</p>
      </div>

      {/* Working hours */}
      <Card className="bg-card/30">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Horaires de disponibilité</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm">Heures de travail</span>
            <span className="text-sm font-mono text-primary">{bookingRules.workingHours.start} — {bookingRules.workingHours.end}</span>
          </div>
          <div className="flex gap-2">
            {[1, 2, 3, 4, 5, 6, 7].map((d) => (
              <div
                key={d}
                className={`w-10 h-10 rounded-lg flex items-center justify-center text-xs font-medium transition-colors ${
                  bookingRules.workingDays.includes(d)
                    ? "bg-primary/10 text-primary border border-primary/20"
                    : "bg-secondary/30 text-muted-foreground"
                }`}
              >
                {dayNames[d]}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Booking rules */}
      <Card className="bg-card/30">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Règles de réservation</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {[
            { label: "Préavis minimum", value: `${bookingRules.minNotice} heures` },
            { label: "Maximum par jour", value: `${bookingRules.maxPerDay} rendez-vous` },
            { label: "Durée d'un créneau", value: `${bookingRules.slotDuration} minutes` },
            { label: "Pause entre créneaux", value: `${bookingRules.bufferBetween} minutes` },
          ].map((rule) => (
            <div key={rule.label} className="flex items-center justify-between py-1">
              <span className="text-sm text-muted-foreground">{rule.label}</span>
              <Badge variant="secondary">{rule.value}</Badge>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Integration status */}
      <Card className="bg-card/30">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Intégrations</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Google Calendar</p>
              <p className="text-xs text-muted-foreground">Synchronisation automatique</p>
            </div>
            <Switch defaultChecked />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Webhooks n8n</p>
              <p className="text-xs text-muted-foreground">GetCalendar / setCalendar</p>
            </div>
            <Badge className="bg-primary/10 text-primary border-0">Actif</Badge>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import UrgencySettings from "./UrgencySettings";

export default function WhenToAlert() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Quand me prévenir</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Configurez vos préférences de notification, seuils d'urgence et heures silencieuses.
        </p>
      </div>

      <Tabs defaultValue="urgency" className="w-full">
        <TabsList>
          <TabsTrigger value="urgency">Urgences</TabsTrigger>
          <TabsTrigger value="notifications">Notifications</TabsTrigger>
        </TabsList>
        <TabsContent value="urgency" className="mt-6">
          <UrgencySettings />
        </TabsContent>
        <TabsContent value="notifications" className="mt-6">
          <div className="text-sm text-muted-foreground">
            Configuration des canaux de notification (push, SMS, email) — à venir.
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

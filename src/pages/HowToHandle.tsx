import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import AssistantModes from "@/components/AssistantModes";
import CallerGroups from "./CallerGroups";
import SmartScenarios from "./SmartScenarios";

export default function HowToHandle() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Comment gérer leurs appels</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Choisissez comment votre assistant gère les appels selon le moment.
        </p>
      </div>

      <Tabs defaultValue="modes" className="w-full">
        <TabsList>
          <TabsTrigger value="modes">Modes</TabsTrigger>
          <TabsTrigger value="rules">Règles</TabsTrigger>
          <TabsTrigger value="scenarios">Scénarios</TabsTrigger>
        </TabsList>
        <TabsContent value="modes" className="mt-6">
          <AssistantModes />
        </TabsContent>
        <TabsContent value="rules" className="mt-6">
          <CallerGroups />
        </TabsContent>
        <TabsContent value="scenarios" className="mt-6">
          <SmartScenarios />
        </TabsContent>
      </Tabs>
    </div>
  );
}

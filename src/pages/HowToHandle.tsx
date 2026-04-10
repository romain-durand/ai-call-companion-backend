import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import CallerGroups from "./CallerGroups";
import SmartScenarios from "./SmartScenarios";

export default function HowToHandle() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Comment gérer leurs appels</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Définissez les règles de gestion, les scénarios et le mode de l'assistant.
        </p>
      </div>

      <Tabs defaultValue="rules" className="w-full">
        <TabsList>
          <TabsTrigger value="rules">Règles</TabsTrigger>
          <TabsTrigger value="scenarios">Scénarios</TabsTrigger>
        </TabsList>
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

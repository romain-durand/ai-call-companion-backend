import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import AssistantModes from "@/components/AssistantModes";
import SpecialInstructions from "@/components/SpecialInstructions";
import SmartScenarios from "./SmartScenarios";

export default function HowToHandle() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Comment gérer les appels</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Choisissez comment votre assistant gère les appels selon le moment.
        </p>
      </div>

      <Tabs defaultValue="modes" className="w-full">
        <TabsList>
          <TabsTrigger value="modes">Modes et règles</TabsTrigger>
          <TabsTrigger value="special">Traitements spéciaux</TabsTrigger>
          <TabsTrigger value="scenarios">Scénarios</TabsTrigger>
        </TabsList>
        <TabsContent value="modes" className="mt-6">
          <AssistantModes />
        </TabsContent>
        <TabsContent value="special" className="mt-6">
          <SpecialInstructions />
        </TabsContent>
        <TabsContent value="scenarios" className="mt-6">
          <SmartScenarios />
        </TabsContent>
      </Tabs>
    </div>
  );
}

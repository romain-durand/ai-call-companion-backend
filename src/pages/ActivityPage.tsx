import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import CallHistory from "./CallHistory";
import MissionsPage from "./MissionsPage";

export default function ActivityPage() {
  return (
    <div className="space-y-4">
      <Tabs defaultValue="history" className="w-full">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="history">Historique</TabsTrigger>
          <TabsTrigger value="missions">Missions</TabsTrigger>
        </TabsList>
        <TabsContent value="history" className="mt-4">
          <CallHistory />
        </TabsContent>
        <TabsContent value="missions" className="mt-4">
          <MissionsPage />
        </TabsContent>
      </Tabs>
    </div>
  );
}

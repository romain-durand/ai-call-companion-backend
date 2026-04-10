import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import CallerGroups from "./CallerGroups";
import ContactsPage from "./ContactsPage";

export default function WhoCanReachMe() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Qui peut me joindre</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Gérez vos groupes d'appelants, vos contacts et qui a accès à vous.
        </p>
      </div>

      <Tabs defaultValue="groups" className="w-full">
        <TabsList>
          <TabsTrigger value="groups">Groupes</TabsTrigger>
          <TabsTrigger value="contacts">Contacts</TabsTrigger>
        </TabsList>
        <TabsContent value="groups" className="mt-6">
          <CallerGroups />
        </TabsContent>
        <TabsContent value="contacts" className="mt-6">
          <ContactsPage />
        </TabsContent>
      </Tabs>
    </div>
  );
}

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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

      <Tabs defaultValue="contacts" className="w-full">
        <TabsList>
          <TabsTrigger value="contacts">Contacts</TabsTrigger>
          <TabsTrigger value="groups">Groupes</TabsTrigger>
        </TabsList>
        <TabsContent value="contacts" className="mt-6">
          <ContactsPage forcedView="list" />
        </TabsContent>
        <TabsContent value="groups" className="mt-6">
          <ContactsPage forcedView="groups" />
        </TabsContent>
      </Tabs>
    </div>
  );
}

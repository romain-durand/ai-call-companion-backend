import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Upload, Mail, FileText, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useUserAccountId } from "@/hooks/useUserAccountId";

const BRIDGE_URL = "https://bridgeserver.ted.paris";

export function ImportContactsMenu() {
  const accountId = useUserAccountId();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  // Handle OAuth return
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const importType = params.get("import");
    const status = params.get("status");
    if (importType === "google" && status) {
      if (status === "success") {
        const imported = params.get("imported") || "0";
        const skipped = params.get("skipped") || "0";
        toast.success(`Import Google : ${imported} contacts importés, ${skipped} ignorés`);
        queryClient.invalidateQueries({ queryKey: ["contacts"] });
      } else {
        toast.error(`Échec import Google : ${params.get("reason") || "erreur inconnue"}`);
      }
      // Clean URL
      params.delete("import");
      params.delete("status");
      params.delete("imported");
      params.delete("skipped");
      params.delete("reason");
      const newUrl = window.location.pathname + (params.toString() ? `?${params}` : "");
      window.history.replaceState({}, "", newUrl);
    }
  }, [queryClient]);

  const handleGoogleImport = async () => {
    if (!accountId) {
      toast.error("Compte introuvable");
      return;
    }
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
    if (!token) {
      toast.error("Vous devez être connecté");
      return;
    }
    // Try existing connection first
    setBusy(true);
    try {
      const res = await fetch(
        `${BRIDGE_URL}/contacts/google/import?account_id=${accountId}&token=${encodeURIComponent(token)}`,
        { method: "POST" },
      );
      if (res.ok) {
        const data = await res.json();
        toast.success(`Import Google : ${data.imported} importés, ${data.skipped} ignorés`);
        queryClient.invalidateQueries({ queryKey: ["contacts"] });
        setBusy(false);
        return;
      }
      // No connection or token expired → start OAuth
      const startUrl = `${BRIDGE_URL}/auth/google/contacts/start?account_id=${accountId}&token=${encodeURIComponent(token)}`;
      window.location.href = startUrl;
    } catch (err) {
      toast.error("Erreur lors de l'import Google");
      setBusy(false);
    }
  };

  const handleVCardClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !accountId) return;
    e.target.value = ""; // reset

    setBusy(true);
    try {
      const text = await file.text();
      const { data, error } = await supabase.functions.invoke("import-vcard", {
        body: { account_id: accountId, vcard: text },
      });
      if (error) throw error;
      toast.success(
        `Import vCard : ${data.imported} importés, ${data.skipped} ignorés (${data.parsed} trouvés)`,
      );
      queryClient.invalidateQueries({ queryKey: ["contacts"] });
    } catch (err: any) {
      toast.error(`Erreur import vCard : ${err.message || "inconnue"}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept=".vcf,text/vcard,text/x-vcard"
        className="hidden"
        onChange={handleFileChange}
      />
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" disabled={busy}>
            {busy ? (
              <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
            ) : (
              <Upload className="w-4 h-4 mr-1.5" />
            )}
            Importer
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-64">
          <DropdownMenuItem onClick={handleGoogleImport}>
            <Mail className="w-4 h-4 mr-2" />
            <div className="flex flex-col">
              <span>Depuis Google Contacts</span>
              <span className="text-[10px] text-muted-foreground">
                Connexion OAuth sécurisée
              </span>
            </div>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={handleVCardClick}>
            <FileText className="w-4 h-4 mr-2" />
            <div className="flex flex-col">
              <span>Fichier vCard (.vcf)</span>
              <span className="text-[10px] text-muted-foreground">
                Pour iCloud / Apple : exportez depuis iCloud.com
              </span>
            </div>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
}

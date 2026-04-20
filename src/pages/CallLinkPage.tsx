import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/contexts/AuthContext";
import { Copy, Check } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import BackToSettingsButton from "@/components/BackToSettingsButton";

export default function CallLinkPage() {
  const { user } = useAuth();
  const [copied, setCopied] = useState(false);
  const callUrl = user ? `${window.location.origin}/call/${user.id}` : "";

  return (
    <div className="space-y-8 max-w-3xl">
      <BackToSettingsButton />
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Mon lien d'appel</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Partagez ce lien ou ce QR code pour permettre à vos contacts de vous joindre via le web.
        </p>
      </div>

      <Card className="bg-card/30">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Lien et QR code</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-2">
            <Input value={callUrl} readOnly className="text-xs font-mono" />
            <Button
              variant="outline"
              size="icon"
              onClick={() => {
                navigator.clipboard.writeText(callUrl);
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
              }}
            >
              {copied ? <Check className="w-4 h-4 text-primary" /> : <Copy className="w-4 h-4" />}
            </Button>
          </div>
          {callUrl && (
            <div className="flex justify-center py-2">
              <QRCodeSVG value={callUrl} size={180} bgColor="transparent" fgColor="hsl(var(--foreground))" />
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

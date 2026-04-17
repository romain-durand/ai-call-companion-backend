import { useState } from "react";
import { motion } from "framer-motion";
import { Mic, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { OwnerCallDialog } from "@/components/OwnerCallDialog";

export function CallMyAssistantButton() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
        <Card className="p-5 flex items-center gap-4 bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
          <div className="w-12 h-12 rounded-full bg-primary/15 flex items-center justify-center shrink-0">
            <Mic className="w-5 h-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold">Parler à mon assistant</h3>
              <Sparkles className="w-3.5 h-3.5 text-primary" />
            </div>
            <p className="text-sm text-muted-foreground mt-0.5">
              Aide, infos compte, ou configuration vocale
            </p>
          </div>
          <Button onClick={() => setOpen(true)} className="shrink-0">
            Appeler
          </Button>
        </Card>
      </motion.div>
      <OwnerCallDialog open={open} onOpenChange={setOpen} />
    </>
  );
}

import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { MessageCircle, Send, X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useUserAccountId } from "@/hooks/useUserAccountId";
import { toast } from "sonner";

interface LiveChatMessage {
  id: string;
  call_session_id: string;
  account_id: string;
  direction: "to_user" | "to_assistant";
  content: string;
  status: "pending" | "answered" | "expired";
  created_at: string;
}

export default function LiveConsultBanner() {
  const { data: accountId } = useUserAccountId();
  const queryClient = useQueryClient();
  const [reply, setReply] = useState("");
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  // Fetch pending questions
  const { data: pendingMessages } = useQuery({
    queryKey: ["live-chat-pending", accountId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("live_chat_messages")
        .select("*")
        .eq("account_id", accountId!)
        .eq("direction", "to_user")
        .eq("status", "pending")
        .order("created_at", { ascending: false })
        .limit(5);
      if (error) throw error;
      return data as LiveChatMessage[];
    },
    enabled: !!accountId,
    refetchInterval: 3000,
  });

  // Subscribe to realtime inserts
  useEffect(() => {
    if (!accountId) return;

    const channel = supabase
      .channel("live-chat-realtime")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "live_chat_messages",
          filter: `account_id=eq.${accountId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["live-chat-pending", accountId] });
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "live_chat_messages",
          filter: `account_id=eq.${accountId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["live-chat-pending", accountId] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [accountId, queryClient]);

  // Send reply mutation
  const sendReply = useMutation({
    mutationFn: async ({ questionMsg, replyText }: { questionMsg: LiveChatMessage; replyText: string }) => {
      // Insert reply message
      const { error: insertErr } = await supabase.from("live_chat_messages").insert({
        call_session_id: questionMsg.call_session_id,
        account_id: questionMsg.account_id,
        direction: "to_assistant" as const,
        content: replyText,
        status: "answered" as const,
      });
      if (insertErr) throw insertErr;
    },
    onSuccess: () => {
      setReply("");
      toast.success("Réponse envoyée à l'assistant");
      queryClient.invalidateQueries({ queryKey: ["live-chat-pending", accountId] });
    },
    onError: () => {
      toast.error("Erreur lors de l'envoi");
    },
  });

  // Filter out dismissed ones
  const visibleMessages = pendingMessages?.filter((m) => !dismissed.has(m.id)) || [];

  if (visibleMessages.length === 0) return null;

  const currentQuestion = visibleMessages[0];

  return (
    <AnimatePresence>
      <motion.div
        key={currentQuestion.id}
        initial={{ opacity: 0, y: -20, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -20, scale: 0.95 }}
        transition={{ type: "spring", damping: 20 }}
      >
        <Card className="border-primary/30 bg-primary/5 shadow-lg shadow-primary/10">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              {/* Pulsing icon */}
              <div className="relative mt-0.5">
                <div className="w-9 h-9 rounded-full bg-primary/20 flex items-center justify-center">
                  <MessageCircle className="w-4 h-4 text-primary" />
                </div>
                <span className="absolute -top-0.5 -right-0.5 w-3 h-3 bg-primary rounded-full animate-ping" />
                <span className="absolute -top-0.5 -right-0.5 w-3 h-3 bg-primary rounded-full" />
              </div>

              <div className="flex-1 min-w-0">
                {/* Header */}
                <div className="flex items-center justify-between mb-1.5">
                  <p className="text-xs font-medium text-primary">
                    📞 Consultation en direct — l'assistant a besoin de vous
                  </p>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 text-muted-foreground hover:text-foreground"
                    onClick={() => setDismissed((s) => new Set(s).add(currentQuestion.id))}
                  >
                    <X className="w-3.5 h-3.5" />
                  </Button>
                </div>

                {/* Question */}
                <p className="text-sm font-medium mb-3">
                  {currentQuestion.content}
                </p>

                {/* Reply input */}
                <form
                  className="flex gap-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (reply.trim() && !sendReply.isPending) {
                      sendReply.mutate({ questionMsg: currentQuestion, replyText: reply.trim() });
                    }
                  }}
                >
                  <Input
                    value={reply}
                    onChange={(e) => setReply(e.target.value)}
                    placeholder="Tapez votre réponse…"
                    className="text-sm bg-background/80"
                    autoFocus
                  />
                  <Button
                    type="submit"
                    size="sm"
                    disabled={!reply.trim() || sendReply.isPending}
                    className="px-3"
                  >
                    {sendReply.isPending ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Send className="w-4 h-4" />
                    )}
                  </Button>
                </form>

                {visibleMessages.length > 1 && (
                  <p className="text-[10px] text-muted-foreground mt-2">
                    +{visibleMessages.length - 1} autre(s) question(s) en attente
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </AnimatePresence>
  );
}

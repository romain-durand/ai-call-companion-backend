import { useState, useEffect, useRef, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { Phone, PhoneOff, PhoneForwarded, Mic, MicOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useUserAccountId } from "@/hooks/useUserAccountId";
import { toast } from "sonner";

// Bridge WS URL — defaults to same host on /transfer-audio
const BRIDGE_WS_URL = import.meta.env.VITE_BRIDGE_WS_URL || "wss://bridgeserver.ted.paris";

function getBridgeTransferUrl(): string {
  if (BRIDGE_WS_URL) {
    // Replace protocol and append path
    const base = BRIDGE_WS_URL.replace(/\/$/, "");
    return `${base}/transfer-audio`;
  }
  // Fallback: try same host with ws protocol
  const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${proto}//${window.location.host}/transfer-audio`;
}

interface TransferRequest {
  id: string;
  call_session_id: string;
  account_id: string;
  reason: string;
  caller_name: string | null;
  caller_phone_e164: string | null;
  status: string;
  created_at: string;
}

export default function TransferCallBanner() {
  const { data: accountId } = useUserAccountId();
  const queryClient = useQueryClient();
  const [activeTransfer, setActiveTransfer] = useState<TransferRequest | null>(null);
  const [connected, setConnected] = useState(false);
  const [muted, setMuted] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);

  // Fetch pending transfer requests
  const { data: pendingTransfers } = useQuery({
    queryKey: ["transfer-requests-pending", accountId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("transfer_requests")
        .select("*")
        .eq("account_id", accountId!)
        .eq("status", "pending")
        .order("created_at", { ascending: false })
        .limit(1);
      if (error) throw error;

      // Resolve contact names
      const requests = data || [];
      if (requests.length === 0) return [];

      const phones = requests
        .map((r: any) => r.caller_phone_e164)
        .filter(Boolean);

      let phoneToName = new Map<string, string>();
      if (phones.length > 0) {
        const { data: contacts } = await supabase
          .from("contacts")
          .select("display_name, first_name, last_name, primary_phone_e164")
          .eq("account_id", accountId!)
          .in("primary_phone_e164", phones);
        for (const c of contacts || []) {
          if (!c.primary_phone_e164) continue;
          const name = [c.first_name, c.last_name].filter(Boolean).join(" ") || c.display_name || "";
          if (name) phoneToName.set(c.primary_phone_e164, name);
        }
      }

      return requests.map((r: any) => ({
        ...r,
        caller_name: r.caller_phone_e164 ? (phoneToName.get(r.caller_phone_e164) || r.caller_name) : r.caller_name,
      })) as TransferRequest[];
    },
    enabled: !!accountId,
    refetchInterval: 2000,
  });

  // Realtime subscription for transfer_requests
  useEffect(() => {
    if (!accountId) return;
    const channel = supabase
      .channel("transfer-requests-realtime")
      .on("postgres_changes", {
        event: "*",
        schema: "public",
        table: "transfer_requests",
        filter: `account_id=eq.${accountId}`,
      }, () => {
        queryClient.invalidateQueries({ queryKey: ["transfer-requests-pending", accountId] });
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [accountId, queryClient]);

  // Play received PCM audio from bridge
  const playAudio = useCallback((base64Pcm: string) => {
    if (!audioCtxRef.current) return;
    const ctx = audioCtxRef.current;

    const buf = Uint8Array.from(atob(base64Pcm), (c) => c.charCodeAt(0));
    const int16 = new Int16Array(buf.buffer, buf.byteOffset, buf.byteLength / 2);
    const float32 = new Float32Array(int16.length);
    for (let i = 0; i < int16.length; i++) {
      float32[i] = int16[i] / 32768;
    }

    const audioBuffer = ctx.createBuffer(1, float32.length, 16000);
    audioBuffer.getChannelData(0).set(float32);
    const source = ctx.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(ctx.destination);
    source.start();
  }, []);

  // Connect WebSocket audio to bridge
  const connectAudio = useCallback(async (transfer: TransferRequest) => {
    try {
      // Get mic access
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      // Create audio context for playback + capture
      const audioCtx = new AudioContext({ sampleRate: 16000 });
      audioCtxRef.current = audioCtx;

      // Setup mic capture → PCM 16kHz
      const source = audioCtx.createMediaStreamSource(stream);
      const processor = audioCtx.createScriptProcessor(4096, 1, 1);
      processorRef.current = processor;

      // Connect to bridge WS
      const wsUrl = getBridgeTransferUrl();
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        ws.send(JSON.stringify({ type: "join", callSessionId: transfer.call_session_id }));
      };

      ws.onmessage = (evt) => {
        try {
          const msg = JSON.parse(evt.data);
          if (msg.type === "joined") {
            setConnected(true);
            toast.success("Connecté à l'appel");
          } else if (msg.type === "audio") {
            playAudio(msg.data);
          } else if (msg.type === "error") {
            toast.error(msg.message || "Erreur de connexion");
            disconnectAudio();
          }
        } catch (_) {}
      };

      ws.onclose = () => {
        setConnected(false);
        setActiveTransfer(null);
        cleanupAudio();
      };

      // Send mic audio
      processor.onaudioprocess = (e) => {
        if (muted || !ws || ws.readyState !== WebSocket.OPEN) return;
        const input = e.inputBuffer.getChannelData(0);
        const int16 = new Int16Array(input.length);
        for (let i = 0; i < input.length; i++) {
          const s = Math.max(-1, Math.min(1, input[i]));
          int16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
        }
        const base64 = btoa(String.fromCharCode(...new Uint8Array(int16.buffer)));
        ws.send(JSON.stringify({ type: "audio", data: base64 }));
      };

      source.connect(processor);
      processor.connect(audioCtx.destination);

    } catch (e: any) {
      toast.error("Impossible d'accéder au micro : " + (e.message || ""));
      disconnectAudio();
    }
  }, [muted, playAudio]);

  const cleanupAudio = useCallback(() => {
    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current = null;
    }
    if (audioCtxRef.current) {
      audioCtxRef.current.close().catch(() => {});
      audioCtxRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  }, []);

  const disconnectAudio = useCallback(() => {
    if (wsRef.current) {
      try {
        wsRef.current.send(JSON.stringify({ type: "hangup" }));
      } catch (_) {}
      wsRef.current.close();
      wsRef.current = null;
    }
    cleanupAudio();
    setConnected(false);
    setActiveTransfer(null);
  }, [cleanupAudio]);

  // Accept transfer
  const handleAccept = async (transfer: TransferRequest) => {
    try {
      const { error } = await supabase
        .from("transfer_requests")
        .update({ status: "accepted", answered_at: new Date().toISOString() })
        .eq("id", transfer.id);
      if (error) throw error;

      setActiveTransfer(transfer);
      await connectAudio(transfer);
    } catch (e: any) {
      toast.error("Erreur : " + (e.message || ""));
    }
  };

  // Decline transfer
  const handleDecline = async (transfer: TransferRequest) => {
    try {
      const { error } = await supabase
        .from("transfer_requests")
        .update({ status: "declined", answered_at: new Date().toISOString() })
        .eq("id", transfer.id);
      if (error) throw error;
      toast.info("Transfert refusé — l'assistant reprend");
      queryClient.invalidateQueries({ queryKey: ["transfer-requests-pending", accountId] });
    } catch (e: any) {
      toast.error("Erreur : " + (e.message || ""));
    }
  };

  // Hang up active transfer
  const handleHangup = () => {
    disconnectAudio();
    toast.info("Appel terminé");
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (wsRef.current) wsRef.current.close();
      cleanupAudio();
    };
  }, [cleanupAudio]);

  // Active call UI
  if (activeTransfer && connected) {
    return (
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
      >
        <Card className="border-green-500/30 bg-green-500/5 shadow-lg shadow-green-500/10">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="w-9 h-9 rounded-full bg-green-500/20 flex items-center justify-center">
                  <Phone className="w-4 h-4 text-green-600" />
                </div>
                <span className="absolute -top-0.5 -right-0.5 w-3 h-3 bg-green-500 rounded-full animate-pulse" />
              </div>

              <div className="flex-1">
                <p className="text-sm font-medium text-green-700 dark:text-green-400">
                  🔊 En ligne avec {activeTransfer.caller_name || activeTransfer.caller_phone_e164 || "l'appelant"}
                </p>
                <p className="text-xs text-muted-foreground">{activeTransfer.reason}</p>
              </div>

              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant={muted ? "destructive" : "outline"}
                  onClick={() => setMuted(!muted)}
                  className="h-8 w-8 p-0"
                >
                  {muted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={handleHangup}
                  className="gap-1"
                >
                  <PhoneOff className="w-4 h-4" />
                  Raccrocher
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    );
  }

  // Pending transfer request UI
  const pending = pendingTransfers?.[0];
  if (!pending) return null;

  return (
    <AnimatePresence>
      <motion.div
        key={pending.id}
        initial={{ opacity: 0, y: -20, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -20, scale: 0.95 }}
        transition={{ type: "spring", damping: 20 }}
      >
        <Card className="border-orange-500/30 bg-orange-500/5 shadow-lg shadow-orange-500/10">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="w-9 h-9 rounded-full bg-orange-500/20 flex items-center justify-center animate-pulse">
                  <PhoneForwarded className="w-4 h-4 text-orange-600" />
                </div>
                <span className="absolute -top-0.5 -right-0.5 w-3 h-3 bg-orange-500 rounded-full animate-ping" />
                <span className="absolute -top-0.5 -right-0.5 w-3 h-3 bg-orange-500 rounded-full" />
              </div>

              <div className="flex-1">
                <p className="text-sm font-medium text-orange-700 dark:text-orange-400">
                  📞 Transfert d'appel — {pending.caller_name || pending.caller_phone_e164 || "Appelant inconnu"}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">{pending.reason}</p>
              </div>

              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleDecline(pending)}
                  className="text-destructive border-destructive/30 hover:bg-destructive/10"
                >
                  Refuser
                </Button>
                <Button
                  size="sm"
                  onClick={() => handleAccept(pending)}
                  className="bg-green-600 hover:bg-green-700 text-white gap-1"
                >
                  <Phone className="w-4 h-4" />
                  Accepter
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </AnimatePresence>
  );
}
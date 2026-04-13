import { useState, useRef, useCallback, useEffect } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Phone, PhoneOff, Loader2, Mic } from "lucide-react";

const BRIDGE_WS_URL = "wss://bridgeserver.ted.paris/web-call";

type CallState = "idle" | "connecting" | "active" | "ended";

export default function WebCallPage() {
  const { profileId } = useParams<{ profileId: string }>();
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [callerPhone, setCallerPhone] = useState("");
  const [callState, setCallState] = useState<CallState>("idle");

  const wsRef = useRef<WebSocket | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const sourceNodeRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const playCtxRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Fetch profile display_name (public read via anon key)
  useEffect(() => {
    if (!profileId) return;
    supabase
      .from("profiles")
      .select("display_name, first_name")
      .eq("id", profileId)
      .maybeSingle()
      .then(({ data }) => {
        setDisplayName(data?.display_name || data?.first_name || "Assistant");
        setLoading(false);
      });
  }, [profileId]);

  const startCall = useCallback(async () => {
    if (!profileId) return;
    setCallState("connecting");

    try {
      // Get microphone
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      // Capture context at 16kHz
      const audioCtx = new AudioContext({ sampleRate: 16000 });
      audioCtxRef.current = audioCtx;
      const source = audioCtx.createMediaStreamSource(stream);
      sourceNodeRef.current = source;

      // Playback context at 24kHz for Gemini audio
      const playCtx = new AudioContext({ sampleRate: 24000 });
      playCtxRef.current = playCtx;

      // Open WebSocket
      const ws = new WebSocket(BRIDGE_WS_URL);
      wsRef.current = ws;

      ws.onopen = () => {
        ws.send(JSON.stringify({
          type: "start",
          profileId,
          callerPhone: callerPhone.trim() || undefined,
        }));
        setCallState("active");

        // Start sending audio
        const processor = audioCtx.createScriptProcessor(4096, 1, 1);
        processorRef.current = processor;
        source.connect(processor);
        processor.connect(audioCtx.destination);

        processor.onaudioprocess = (e) => {
          if (ws.readyState !== WebSocket.OPEN) return;
          const float32 = e.inputBuffer.getChannelData(0);
          const int16 = new Int16Array(float32.length);
          for (let i = 0; i < float32.length; i++) {
            const s = Math.max(-1, Math.min(1, float32[i]));
            int16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
          }
          const bytes = new Uint8Array(int16.buffer);
          let binary = "";
          for (let i = 0; i < bytes.length; i++) {
            binary += String.fromCharCode(bytes[i]);
          }
          ws.send(JSON.stringify({ type: "audio", data: btoa(binary) }));
        };
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === "audio" && msg.data) {
            playPcmChunk(msg.data, playCtx);
          }
          if (msg.type === "ended") {
            endCall();
          }
        } catch {}
      };

      ws.onclose = () => {
        if (callState !== "ended") setCallState("ended");
      };

      ws.onerror = () => {
        setCallState("ended");
      };
    } catch (err) {
      console.error("Failed to start call:", err);
      setCallState("idle");
    }
  }, [profileId, callerPhone]);

  const endCall = useCallback(() => {
    setCallState("ended");
    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current = null;
    }
    if (sourceNodeRef.current) {
      sourceNodeRef.current.disconnect();
      sourceNodeRef.current = null;
    }
    if (audioCtxRef.current) {
      audioCtxRef.current.close().catch(() => {});
      audioCtxRef.current = null;
    }
    if (playCtxRef.current) {
      playCtxRef.current.close().catch(() => {});
      playCtxRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.close(1000, "user_ended");
    }
    wsRef.current = null;
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background text-foreground">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background text-foreground p-4">
      <div className="w-full max-w-sm space-y-8 text-center">
        {/* Avatar / Icon */}
        <div className="mx-auto w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center">
          <Phone className="w-8 h-8 text-primary" />
        </div>

        <div>
          <h1 className="text-xl font-semibold">{displayName}</h1>
          <p className="text-sm text-muted-foreground mt-1">Assistant vocal</p>
        </div>

        {callState === "idle" && (
          <div className="space-y-4">
            <div className="text-left space-y-2">
              <Label className="text-sm">Votre numéro (optionnel)</Label>
              <Input
                value={callerPhone}
                onChange={(e) => setCallerPhone(e.target.value)}
                placeholder="+33 6 12 34 56 78"
                type="tel"
              />
            </div>
            <Button onClick={startCall} className="w-full gap-2" size="lg">
              <Phone className="w-4 h-4" />
              Appeler
            </Button>
          </div>
        )}

        {callState === "connecting" && (
          <div className="space-y-3">
            <Loader2 className="w-6 h-6 mx-auto animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Connexion en cours…</p>
          </div>
        )}

        {callState === "active" && (
          <div className="space-y-6">
            {/* Pulsing mic indicator */}
            <div className="mx-auto w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center animate-pulse">
              <Mic className="w-7 h-7 text-primary" />
            </div>
            <p className="text-sm text-muted-foreground">Appel en cours…</p>
            <Button variant="destructive" onClick={endCall} className="w-full gap-2" size="lg">
              <PhoneOff className="w-4 h-4" />
              Raccrocher
            </Button>
          </div>
        )}

        {callState === "ended" && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">Appel terminé</p>
            <Button variant="outline" onClick={() => setCallState("idle")} className="w-full">
              Nouvel appel
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

/** Decode base64 PCM 24kHz and play via AudioContext */
function playPcmChunk(base64: string, ctx: AudioContext) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  const int16 = new Int16Array(bytes.buffer);
  const float32 = new Float32Array(int16.length);
  for (let i = 0; i < int16.length; i++) {
    float32[i] = int16[i] / 32768;
  }
  const buffer = ctx.createBuffer(1, float32.length, 24000);
  buffer.getChannelData(0).set(float32);
  const source = ctx.createBufferSource();
  source.buffer = buffer;
  source.connect(ctx.destination);
  source.start();
}

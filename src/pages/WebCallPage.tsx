import { useState, useRef, useCallback, useEffect } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Phone, PhoneOff, Loader2, Mic } from "lucide-react";

const BRIDGE_WS_URL = "wss://bridgeserver.ted.paris/web-call";

type CallState = "idle" | "connecting" | "active" | "ended";

/** Encode a Uint8Array to base64 — safe for large buffers */
function uint8ToBase64(bytes: Uint8Array): string {
  const CHUNK = 8192;
  let binary = "";
  for (let i = 0; i < bytes.length; i += CHUNK) {
    const slice = bytes.subarray(i, Math.min(i + CHUNK, bytes.length));
    binary += String.fromCharCode(...slice);
  }
  return btoa(binary);
}

/** Decode base64 to Uint8Array */
function base64ToUint8(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * Queued PCM player — schedules audio chunks back-to-back
 * to avoid overlapping playback.
 */
class PcmPlayer {
  private ctx: AudioContext;
  private nextStartTime = 0;

  constructor(sampleRate: number) {
    this.ctx = new AudioContext({ sampleRate });
  }

  play(base64: string) {
    const bytes = base64ToUint8(base64);
    const int16 = new Int16Array(bytes.buffer, bytes.byteOffset, bytes.byteLength / 2);
    const float32 = new Float32Array(int16.length);
    for (let i = 0; i < int16.length; i++) {
      float32[i] = int16[i] / 32768;
    }

    const buffer = this.ctx.createBuffer(1, float32.length, this.ctx.sampleRate);
    buffer.getChannelData(0).set(float32);

    const source = this.ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(this.ctx.destination);

    const now = this.ctx.currentTime;
    const startAt = Math.max(now, this.nextStartTime);
    source.start(startAt);
    this.nextStartTime = startAt + buffer.duration;
  }

  close() {
    this.ctx.close().catch(() => {});
  }
}

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
  const playerRef = useRef<PcmPlayer | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const callStateRef = useRef<CallState>("idle");

  // Keep ref in sync
  useEffect(() => {
    callStateRef.current = callState;
  }, [callState]);

  // Fetch profile display_name
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
    if (playerRef.current) {
      playerRef.current.close();
      playerRef.current = null;
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

  const startCall = useCallback(async () => {
    if (!profileId) return;
    setCallState("connecting");

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      // Capture context at 16kHz
      const audioCtx = new AudioContext({ sampleRate: 16000 });
      audioCtxRef.current = audioCtx;
      const source = audioCtx.createMediaStreamSource(stream);
      sourceNodeRef.current = source;

      // Playback player at 24kHz with queue
      const player = new PcmPlayer(24000);
      playerRef.current = player;

      const ws = new WebSocket(BRIDGE_WS_URL);
      wsRef.current = ws;

      ws.onopen = () => {
        ws.send(JSON.stringify({
          type: "start",
          profileId,
          callerPhone: callerPhone.trim() || undefined,
        }));
        setCallState("active");

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
          ws.send(JSON.stringify({ type: "audio", data: uint8ToBase64(bytes) }));
        };
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === "audio" && msg.data) {
            player.play(msg.data);
          }
          if (msg.type === "ended") {
            endCall();
          }
        } catch {}
      };

      ws.onclose = () => {
        if (callStateRef.current !== "ended") setCallState("ended");
      };

      ws.onerror = () => {
        setCallState("ended");
      };
    } catch (err) {
      console.error("Failed to start call:", err);
      setCallState("idle");
    }
  }, [profileId, callerPhone, endCall]);

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
        <div className="mx-auto w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center">
          <Phone className="w-8 h-8 text-primary" />
        </div>

        <h1 className="text-xl font-semibold">Assistant vocal de {displayName}</h1>

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

import { useEffect, useRef, useState, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, Mic, PhoneOff } from "lucide-react";
import { AudioWave } from "@/components/AudioWave";
import { useAuth } from "@/contexts/AuthContext";
import { useUserAccountId } from "@/hooks/useUserAccountId";

const BRIDGE_WS_URL = "wss://bridgeserver.ted.paris/web-call";

interface OwnerCallDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type CallState = "idle" | "connecting" | "active" | "ended";

function uint8ToBase64(bytes: Uint8Array): string {
  const CHUNK = 8192;
  let binary = "";
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, Math.min(i + CHUNK, bytes.length)));
  }
  return btoa(binary);
}

function base64ToUint8(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

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
    for (let i = 0; i < int16.length; i++) float32[i] = int16[i] / 32768;
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

export function OwnerCallDialog({ open, onOpenChange }: OwnerCallDialogProps) {
  const { user } = useAuth();
  const { data: accountId } = useUserAccountId();
  const [callState, setCallState] = useState<CallState>("idle");
  const [micLevel, setMicLevel] = useState(0);
  const [speakerActive, setSpeakerActive] = useState(false);

  const wsRef = useRef<WebSocket | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const sourceNodeRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const playerRef = useRef<PcmPlayer | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const callStateRef = useRef<CallState>("idle");
  const speakerTimerRef = useRef<number | null>(null);

  useEffect(() => { callStateRef.current = callState; }, [callState]);

  const cleanup = useCallback(() => {
    processorRef.current?.disconnect();
    processorRef.current = null;
    sourceNodeRef.current?.disconnect();
    sourceNodeRef.current = null;
    audioCtxRef.current?.close().catch(() => {});
    audioCtxRef.current = null;
    playerRef.current?.close();
    playerRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.close(1000, "user_ended");
    }
    wsRef.current = null;
    setMicLevel(0);
    setSpeakerActive(false);
  }, []);

  const endCall = useCallback(() => {
    setCallState("ended");
    cleanup();
  }, [cleanup]);

  const startCall = useCallback(async () => {
    if (!user || !accountId) return;
    setCallState("connecting");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const audioCtx = new AudioContext({ sampleRate: 16000 });
      audioCtxRef.current = audioCtx;
      const source = audioCtx.createMediaStreamSource(stream);
      sourceNodeRef.current = source;
      const player = new PcmPlayer(24000);
      playerRef.current = player;

      const ws = new WebSocket(BRIDGE_WS_URL);
      wsRef.current = ws;

      ws.onopen = () => {
        ws.send(JSON.stringify({
          type: "start",
          mode: "owner",
          profileId: user.id,
          accountId,
        }));
        setCallState("active");

        const processor = audioCtx.createScriptProcessor(4096, 1, 1);
        processorRef.current = processor;
        source.connect(processor);
        processor.connect(audioCtx.destination);

        processor.onaudioprocess = (e) => {
          if (ws.readyState !== WebSocket.OPEN) return;
          const float32 = e.inputBuffer.getChannelData(0);
          let sum = 0;
          const int16 = new Int16Array(float32.length);
          for (let i = 0; i < float32.length; i++) {
            const s = Math.max(-1, Math.min(1, float32[i]));
            sum += s * s;
            int16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
          }
          setMicLevel(Math.min(1, Math.sqrt(sum / float32.length) * 3));
          ws.send(JSON.stringify({ type: "audio", data: uint8ToBase64(new Uint8Array(int16.buffer)) }));
        };
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === "audio" && msg.data) {
            player.play(msg.data);
            setSpeakerActive(true);
            if (speakerTimerRef.current) window.clearTimeout(speakerTimerRef.current);
            speakerTimerRef.current = window.setTimeout(() => setSpeakerActive(false), 250);
          }
          if (msg.type === "ended") endCall();
        } catch {}
      };

      ws.onclose = () => {
        if (callStateRef.current !== "ended") setCallState("ended");
      };
      ws.onerror = () => setCallState("ended");
    } catch (err) {
      console.error("Failed to start owner call:", err);
      setCallState("idle");
    }
  }, [user, accountId, endCall]);

  // Cleanup on dialog close
  useEffect(() => {
    if (!open) {
      cleanup();
      setCallState("idle");
    }
  }, [open, cleanup]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Parler à mon assistant</DialogTitle>
        </DialogHeader>

        <div className="py-6 space-y-6 text-center">
          <div className="mx-auto w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center">
            <Mic className={`w-8 h-8 text-primary ${callState === "active" ? "animate-pulse" : ""}`} />
          </div>

          {callState === "idle" && (
            <>
              <p className="text-sm text-muted-foreground">
                Demandez de l'aide, consultez vos infos ou configurez votre assistant à la voix.
              </p>
              <Button onClick={startCall} size="lg" className="w-full" disabled={!accountId}>
                <Mic className="w-4 h-4" />
                Démarrer l'appel
              </Button>
            </>
          )}

          {callState === "connecting" && (
            <div className="space-y-3">
              <Loader2 className="w-6 h-6 mx-auto animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Connexion en cours…</p>
            </div>
          )}

          {callState === "active" && (
            <div className="space-y-6">
              <div className="flex items-center justify-around">
                <AudioWave active label="Vous" level={micLevel} />
                <AudioWave active label="Assistant" level={speakerActive ? 0.8 : 0.1} />
              </div>
              <Button variant="destructive" onClick={endCall} size="lg" className="w-full">
                <PhoneOff className="w-4 h-4" />
                Raccrocher
              </Button>
            </div>
          )}

          {callState === "ended" && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">Appel terminé</p>
              <Button variant="outline" onClick={() => setCallState("idle")} className="w-full">
                Nouvel appel
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

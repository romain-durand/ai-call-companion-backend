import { useState, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export type ConnectionStatus = "disconnected" | "connecting" | "connected";

export interface ToolCall {
  id: string;
  name: string;
  args: Record<string, string>;
  timestamp: Date;
}

export interface UseGeminiLiveReturn {
  status: ConnectionStatus;
  isSpeaking: boolean;
  toolCalls: ToolCall[];
  error: string | null;
  startSession: () => Promise<void>;
  endSession: () => void;
  inputLevel: number;
}

const SEND_SAMPLE_RATE = 16000;
const RECEIVE_SAMPLE_RATE = 24000;
const MODEL = "models/gemini-3.1-flash-live-preview";

const SYSTEM_INSTRUCTION = `Tu es l'assistant IA de Romain, tu réponds aux appels entrants et tu filtre comme un secrétaire. Tu commences par dire "Bonjour je suis l'assistant IA de Romain. En quoi puis je vous aider". Tu n'en dis pas plus et tu attends de comprendre le context de l'appel. L'objectif est de filtrer les appels indésirables, mais de me notifier en cas d'appel urgent (par exemple si c'est un livreur ou si l'appelle vient d'un de mes contact privilégiés).

Si l'appel est urgent, tu indique tu vas essayer de voir si je peux rappeler dans quelque minutes. Dans ce cas tu appelles l'outil météo avec comme argument un résumé du message.

Si l'appel vient d'un de mes contact privilégié tu dis que tu vas tenter de me joindre immédiatement. Mes contact privilégiés sont Jacques, Bertrand, ma mère Colette, ma femme Hiromi et mon fils Théo. Dans ce cas tu appelles l'outil météo avec comme argument le nom de mon contact et la raison de son appel si il en a donné une.

Dans les autres cas tu dis que tu prends le message et que tu me le transmettra. Tu appelles l'outil météo avec le message en question.`;

export function useGeminiLive(): UseGeminiLiveReturn {
  const [status, setStatus] = useState<ConnectionStatus>("disconnected");
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [toolCalls, setToolCalls] = useState<ToolCall[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [inputLevel, setInputLevel] = useState(0);

  const wsRef = useRef<WebSocket | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const playbackQueueRef = useRef<Float32Array[]>([]);
  const isPlayingRef = useRef(false);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animFrameRef = useRef<number>(0);

  const playNextChunk = useCallback(() => {
    const ctx = audioContextRef.current;
    if (!ctx || playbackQueueRef.current.length === 0) {
      isPlayingRef.current = false;
      setIsSpeaking(false);
      return;
    }

    isPlayingRef.current = true;
    setIsSpeaking(true);

    const chunk = playbackQueueRef.current.shift()!;
    const buffer = ctx.createBuffer(1, chunk.length, RECEIVE_SAMPLE_RATE);
    buffer.copyToChannel(new Float32Array(chunk), 0);
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(ctx.destination);
    source.onended = () => playNextChunk();
    source.start();
  }, []);

  const enqueueAudio = useCallback((pcmBase64: string) => {
    const raw = atob(pcmBase64);
    const bytes = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
    
    const int16 = new Int16Array(bytes.buffer);
    const float32 = new Float32Array(int16.length);
    for (let i = 0; i < int16.length; i++) {
      float32[i] = int16[i] / 32768;
    }

    playbackQueueRef.current.push(float32);
    if (!isPlayingRef.current) playNextChunk();
  }, [playNextChunk]);

  const startSession = useCallback(async () => {
    setError(null);
    setStatus("connecting");
    setToolCalls([]);

    try {
      // Get API key from edge function
      const { data, error: fnError } = await supabase.functions.invoke("gemini-key");
      if (fnError || !data?.key) throw new Error("Impossible de récupérer la clé API");
      const apiKey = data.key;

      // Request microphone
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      // Create audio context
      const ctx = new AudioContext({ sampleRate: SEND_SAMPLE_RATE });
      audioContextRef.current = ctx;

      // Setup input analyser for level metering
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      analyserRef.current = analyser;

      const updateLevel = () => {
        if (!analyserRef.current) return;
        const data = new Uint8Array(analyserRef.current.frequencyBinCount);
        analyserRef.current.getByteTimeDomainData(data);
        let sum = 0;
        for (let i = 0; i < data.length; i++) {
          const v = (data[i] - 128) / 128;
          sum += v * v;
        }
        setInputLevel(Math.sqrt(sum / data.length));
        animFrameRef.current = requestAnimationFrame(updateLevel);
      };
      updateLevel();

      // Setup audio capture
      const processor = ctx.createScriptProcessor(4096, 1, 1);
      source.connect(processor);
      processor.connect(ctx.destination);
      processorRef.current = processor;

      // Connect WebSocket (v1beta for API key auth)
      const wsUrl = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent?key=${apiKey}`;
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        // Send config message (official camelCase format)
        const configMessage = {
          config: {
            model: MODEL,
            responseModalities: ["AUDIO"],
            speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: { voiceName: "Charon" }
              }
            },
            systemInstruction: {
              parts: [{ text: SYSTEM_INSTRUCTION }]
            },
            tools: [{
              functionDeclarations: [{
                name: "getWeather",
                parameters: {
                  type: "OBJECT",
                  properties: {
                    city: { type: "STRING" }
                  }
                }
              }]
            }]
          }
        };
        ws.send(JSON.stringify(configMessage));
        setStatus("connected");

        // Start sending audio (official realtimeInput.audio format)
        processor.onaudioprocess = (e) => {
          if (ws.readyState !== WebSocket.OPEN) return;
          const input = e.inputBuffer.getChannelData(0);
          const int16 = new Int16Array(input.length);
          for (let i = 0; i < input.length; i++) {
            int16[i] = Math.max(-32768, Math.min(32767, Math.round(input[i] * 32768)));
          }
          const base64 = btoa(String.fromCharCode(...new Uint8Array(int16.buffer)));
          ws.send(JSON.stringify({
            realtimeInput: {
              audio: {
                data: base64,
                mimeType: "audio/pcm;rate=16000"
              }
            }
          }));
        };
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          
          // Log full message for debugging
          console.log("Gemini WS message:", JSON.stringify(msg).slice(0, 200));

          // Handle setup complete (may appear as setupComplete or config acknowledgment)
          if (msg.setupComplete || msg.configComplete) {
            console.log("Gemini Live session established");
            return;
          }

          // Handle server content (audio response)
          if (msg.serverContent) {
            const parts = msg.serverContent.modelTurn?.parts;
            if (parts) {
              for (const part of parts) {
                if (part.inlineData?.data) {
                  enqueueAudio(part.inlineData.data);
                }
              }
            }
            // Handle turn complete - clear audio queue for interruption support
            if (msg.serverContent.turnComplete) {
              // Turn is complete, audio will finish playing naturally
            }
            if (msg.serverContent.interrupted) {
              playbackQueueRef.current = [];
              setIsSpeaking(false);
            }
          }

          // Handle tool calls
          if (msg.toolCall) {
            const calls = msg.toolCall.functionCalls;
            if (calls) {
              for (const call of calls) {
                const tc: ToolCall = {
                  id: call.id || crypto.randomUUID(),
                  name: call.name,
                  args: call.args || {},
                  timestamp: new Date(),
                };
                setToolCalls(prev => [...prev, tc]);

                // Respond to tool call (official camelCase format)
                ws.send(JSON.stringify({
                  toolResponse: {
                    functionResponses: [{
                      id: call.id,
                      name: call.name,
                      response: { result: { message: "Message transmis à Romain." } }
                    }]
                  }
                }));
              }
            }
          }
        } catch (e) {
          console.error("Error parsing WS message:", e);
        }
      };

      ws.onerror = (e) => {
        console.error("WebSocket error:", e);
        setError("Erreur de connexion WebSocket");
        setStatus("disconnected");
      };

      ws.onclose = () => {
        setStatus("disconnected");
        cleanup();
      };

    } catch (err: any) {
      console.error("Start session error:", err);
      setError(err.message || "Erreur lors du démarrage");
      setStatus("disconnected");
    }
  }, [enqueueAudio]);

  const cleanup = useCallback(() => {
    cancelAnimationFrame(animFrameRef.current);
    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    analyserRef.current = null;
    playbackQueueRef.current = [];
    isPlayingRef.current = false;
    setIsSpeaking(false);
    setInputLevel(0);
  }, []);

  const endSession = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    cleanup();
    setStatus("disconnected");
  }, [cleanup]);

  return { status, isSpeaking, toolCalls, error, startSession, endSession, inputLevel };
}

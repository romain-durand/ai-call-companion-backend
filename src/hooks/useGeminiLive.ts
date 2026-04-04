import { useState, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export type ConnectionStatus = "disconnected" | "connecting" | "connected";

export interface ToolCall {
  id: string;
  name: string;
  args: Record<string, string>;
  timestamp: Date;
}

export interface ToolExchange {
  id: string;
  callName: string;
  callArgs: Record<string, unknown>;
  callTimestamp: Date;
  response?: Record<string, unknown>;
  responseTimestamp?: Date;
  status: "pending" | "success" | "error";
}

export interface UseGeminiLiveReturn {
  status: ConnectionStatus;
  isSpeaking: boolean;
  toolCalls: ToolCall[];
  toolExchanges: ToolExchange[];
  error: string | null;
  startSession: () => Promise<void>;
  endSession: () => void;
  inputLevel: number;
  audioChunksReceived: number;
}

const SEND_SAMPLE_RATE = 16000;
const RECEIVE_SAMPLE_RATE = 24000;
const MODEL = "models/gemini-3.1-flash-live-preview";

export const DEFAULT_SYSTEM_INSTRUCTION = `Tu es l'assistant IA de Romain, tu réponds aux appels entrants et tu filtre comme un secrétaire. Tu commences par dire "Bonjour je suis l'assistant IA de Romain. En quoi puis je vous aider". Tu n'en dis pas plus et tu attends de comprendre le context de l'appel. L'objectif est de filtrer les appels indésirables, mais de me notifier en cas d'appel urgent (par exemple si c'est un livreur ou si l'appelle vient d'un de mes contact privilégiés).

Si l'appel est urgent, tu indique tu vas essayer de voir si je peux rappeler dans quelque minutes. Dans ce cas tu appelles l'outil getWeather avec comme argument un résumé du message.

Si l'appel vient d'un de mes contact privilégié tu dis que tu vas tenter de me joindre immédiatement. Mes contact privilégiés sont Jacques, Bertrand, ma mère Colette, ma femme Hiromi et mon fils Théo. Dans ce cas tu appelles l'outil getWeather avec comme argument le nom de mon contact et la raison de son appel si il en a donné une.

Dans les autres cas tu dis que tu prends le message et que tu me le transmettra. Tu appelles l'outil getWeather avec le message en question.

Tu disposes également de deux outils pour gérer le calendrier de Romain :
- GetCalendar : utilise cet outil pour consulter les disponibilités de Romain sur une période donnée. Tu dois fournir StartTime et EndTime au format ISO 8601 (ex: 2026-04-02T09:00:00+02:00). Utilise-le quand quelqu'un demande si Romain est disponible ou veut connaître son planning.
- setCalendar : utilise cet outil pour créer un événement dans le calendrier de Romain. Tu dois fournir StartTime, EndTime, Attendees (les participants) et Description (l'objet du rendez-vous). Utilise-le quand quelqu'un veut prendre rendez-vous ou fixer un créneau avec Romain, après avoir vérifié sa disponibilité avec GetCalendar.`;

const TOOL_DECLARATIONS = [
  {
    name: "getWeather",
    description: "Transmet un message ou une notification à Romain",
    parameters: {
      type: "OBJECT",
      properties: {
        city: { type: "STRING", description: "Le message ou résumé à transmettre" },
      },
      required: ["city"],
    },
  },
  {
    name: "GetCalendar",
    description: "Consulte le calendrier de Romain pour vérifier ses disponibilités sur une période donnée",
    parameters: {
      type: "OBJECT",
      properties: {
        StartTime: { type: "STRING", description: "Date/heure de début au format ISO 8601 (ex: 2026-04-01T09:00:00+02:00)" },
        EndTime: { type: "STRING", description: "Date/heure de fin au format ISO 8601 (ex: 2026-04-01T18:00:00+02:00)" },
      },
      required: ["StartTime", "EndTime"],
    },
  },
  {
    name: "setCalendar",
    description: "Crée un événement dans le calendrier de Romain",
    parameters: {
      type: "OBJECT",
      properties: {
        StartTime: { type: "STRING", description: "Date/heure de début au format ISO 8601 (ex: 2026-04-01T09:00:00+02:00)" },
        EndTime: { type: "STRING", description: "Date/heure de fin au format ISO 8601 (ex: 2026-04-01T18:00:00+02:00)" },
        Attendees: { type: "STRING", description: "Liste des participants (noms ou emails séparés par des virgules)" },
        Description: { type: "STRING", description: "Description ou objet de l'événement" },
      },
      required: ["StartTime", "EndTime", "Attendees", "Description"],
    },
  },
];

// Tools that require waiting for n8n response before replying to Gemini
const ASYNC_TOOLS: Record<string, string> = {
  GetCalendar: "https://n8n.ted.paris/webhook/GetCalendar",
  setCalendar: "https://n8n.ted.paris/webhook/d586910a-0139-498f-a089-ddeeafbf934a",
};

// Tools that are fire-and-forget (notify only)
const NOTIFY_TOOLS: Record<string, boolean> = {
  getWeather: true,
};

function encodeAudioChunk(input: Float32Array) {
  const int16 = new Int16Array(input.length);
  for (let i = 0; i < input.length; i++) {
    int16[i] = Math.max(-32768, Math.min(32767, Math.round(input[i] * 32768)));
  }
  return btoa(String.fromCharCode(...new Uint8Array(int16.buffer)));
}

function decodeAudioChunk(pcmBase64: string) {
  const raw = atob(pcmBase64);
  const bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);

  const int16 = new Int16Array(bytes.buffer);
  const float32 = new Float32Array(int16.length);
  for (let i = 0; i < int16.length; i++) {
    float32[i] = int16[i] / 32768;
  }

  return float32;
}

async function readSocketMessage(data: string | Blob | ArrayBuffer) {
  if (typeof data === "string") return data;
  if (data instanceof Blob) return await data.text();
  if (data instanceof ArrayBuffer) return new TextDecoder().decode(data);
  return String(data);
}

export function useGeminiLive(systemInstruction?: string): UseGeminiLiveReturn {
  const [status, setStatus] = useState<ConnectionStatus>("disconnected");
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [toolCalls, setToolCalls] = useState<ToolCall[]>([]);
  const [toolExchanges, setToolExchanges] = useState<ToolExchange[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [inputLevel, setInputLevel] = useState(0);

  const [audioChunksReceived, setAudioChunksReceived] = useState(0);

  const wsRef = useRef<WebSocket | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const playbackContextRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const playbackQueueRef = useRef<Float32Array[]>([]);
  const isPlayingRef = useRef(false);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animFrameRef = useRef<number>(0);
  const isSetupCompleteRef = useRef(false);
  const manualCloseRef = useRef(false);

  const playNextChunk = useCallback(() => {
    const ctx = playbackContextRef.current;
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

  const enqueueAudio = useCallback(
    (pcmBase64: string) => {
      console.log("🔊 Audio chunk received, base64 length:", pcmBase64.length);
      setAudioChunksReceived((prev) => prev + 1);
      playbackQueueRef.current.push(decodeAudioChunk(pcmBase64));
      if (!isPlayingRef.current) playNextChunk();
    },
    [playNextChunk],
  );

  const cleanup = useCallback(() => {
    cancelAnimationFrame(animFrameRef.current);

    if (processorRef.current) {
      processorRef.current.onaudioprocess = null;
      processorRef.current.disconnect();
      processorRef.current = null;
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    if (audioContextRef.current) {
      void audioContextRef.current.close();
      audioContextRef.current = null;
    }

    if (playbackContextRef.current) {
      void playbackContextRef.current.close();
      playbackContextRef.current = null;
    }

    analyserRef.current = null;
    playbackQueueRef.current = [];
    isPlayingRef.current = false;
    isSetupCompleteRef.current = false;
    setIsSpeaking(false);
    setInputLevel(0);
  }, []);

  const startSession = useCallback(async () => {
    setError(null);
    setStatus("connecting");
    setToolCalls([]);
    setAudioChunksReceived(0);
    manualCloseRef.current = false;
    isSetupCompleteRef.current = false;

    try {
      const { data, error: fnError } = await supabase.functions.invoke("gemini-key");
      if (fnError || !data?.key) {
        throw new Error("Impossible de récupérer la clé API");
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const ctx = new AudioContext({ sampleRate: SEND_SAMPLE_RATE });
      audioContextRef.current = ctx;

      // Separate playback context at 24kHz for Gemini audio output
      const playbackCtx = new AudioContext({ sampleRate: RECEIVE_SAMPLE_RATE });
      playbackContextRef.current = playbackCtx;

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

      const processor = ctx.createScriptProcessor(4096, 1, 1);
      source.connect(processor);
      processor.connect(ctx.destination);
      processorRef.current = processor;

      const wsUrl = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent?key=${data.key}`;
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        const setupMessage = {
          setup: {
            model: MODEL,
            generationConfig: {
              responseModalities: ["AUDIO"],
              speechConfig: {
                voiceConfig: {
                  prebuiltVoiceConfig: { voiceName: "Charon" },
                },
              },
            },
            systemInstruction: {
              parts: [{ text: systemInstruction || DEFAULT_SYSTEM_INSTRUCTION }],
            },
            tools: [{ functionDeclarations: TOOL_DECLARATIONS }],
          },
        };

        console.log("Sending Gemini setup", setupMessage);
        ws.send(JSON.stringify(setupMessage));
      };

      ws.onmessage = async (event) => {
        try {
          const rawMessage = await readSocketMessage(event.data as string | Blob | ArrayBuffer);
          const msg = JSON.parse(rawMessage);

          console.log("Gemini WS message:", JSON.stringify(msg).slice(0, 500));

          if (msg.setupComplete) {
            isSetupCompleteRef.current = true;
            setError(null);
            setStatus("connected");

            // Send an initial text prompt so Gemini speaks first
            ws.send(
              JSON.stringify({
                clientContent: {
                  turns: [
                    {
                      role: "user",
                      parts: [{ text: "L'appel vient de commencer. Présente-toi." }],
                    },
                  ],
                  turnComplete: true,
                },
              }),
            );

            // Delay starting audio input so Gemini can respond first
            // without being interrupted by silence/noise from the mic
            setTimeout(() => {
              processor.onaudioprocess = (audioEvent) => {
              if (!isSetupCompleteRef.current || ws.readyState !== WebSocket.OPEN) return;

              const input = audioEvent.inputBuffer.getChannelData(0);
              ws.send(
                JSON.stringify({
                  realtimeInput: {
                    audio: {
                      data: encodeAudioChunk(input),
                      mimeType: "audio/pcm;rate=16000",
                    },
                  },
                }),
              );
            };
            }, 3000);

            return;
          }

          if (msg.goAway) {
            setError("Gemini ferme bientôt la session.");
            return;
          }

          if (msg.serverContent) {
            const parts = msg.serverContent.modelTurn?.parts;
            if (parts) {
              for (const part of parts) {
                if (part.inlineData?.data) {
                  enqueueAudio(part.inlineData.data);
                }
              }
            }

            if (msg.serverContent.inputTranscription?.text) {
              console.log("Gemini input transcription:", msg.serverContent.inputTranscription.text);
            }

            if (msg.serverContent.outputTranscription?.text) {
              console.log("Gemini output transcription:", msg.serverContent.outputTranscription.text);
            }

            if (msg.serverContent.interrupted) {
              playbackQueueRef.current = [];
              setIsSpeaking(false);
            }
          }

          if (msg.toolCall?.functionCalls) {
            console.log("🔧 toolCall received!", JSON.stringify(msg.toolCall));
            for (const call of msg.toolCall.functionCalls) {
              const exchangeId = call.id || crypto.randomUUID();
              const toolCall: ToolCall = {
                id: exchangeId,
                name: call.name,
                args: (call.args || {}) as Record<string, string>,
                timestamp: new Date(),
              };

              setToolCalls((prev) => [...prev, toolCall]);

              // Add exchange entry (pending)
              const exchange: ToolExchange = {
                id: exchangeId,
                callName: call.name,
                callArgs: (call.args || {}) as Record<string, unknown>,
                callTimestamp: new Date(),
                status: "pending",
              };
              setToolExchanges((prev) => [...prev, exchange]);

              const updateExchange = (response: Record<string, unknown>, status: "success" | "error") => {
                setToolExchanges((prev) =>
                  prev.map((ex) =>
                    ex.id === exchangeId
                      ? { ...ex, response, responseTimestamp: new Date(), status }
                      : ex
                  )
                );
              };

              const asyncWebhookUrl = ASYNC_TOOLS[call.name];

              if (asyncWebhookUrl) {
                console.log(`📡 Async tool ${call.name}: calling n8n and waiting for response...`);
                supabase.functions
                  .invoke("notify-n8n", {
                    body: {
                      toolName: call.name,
                      args: call.args,
                      message: call.args?.query || call.args?.StartTime || JSON.stringify(call.args),
                      webhookUrl: asyncWebhookUrl,
                      waitForResponse: true,
                    },
                  })
                  .then(({ data, error: n8nErr }) => {
                    if (n8nErr) {
                      console.error("❌ n8n async call failed:", n8nErr);
                      const errorResponse = { error: "Impossible de récupérer les informations." };
                      updateExchange(errorResponse, "error");
                      ws.send(JSON.stringify({
                        toolResponse: {
                          functionResponses: [{
                            id: call.id,
                            name: call.name,
                            response: { result: errorResponse },
                          }],
                        },
                      }));
                    } else {
                      console.log("✅ n8n async response:", data);
                      const successResponse = data?.body ? { data: data.body } : { data: JSON.stringify(data) };
                      updateExchange(successResponse, "success");
                      ws.send(JSON.stringify({
                        toolResponse: {
                          functionResponses: [{
                            id: call.id,
                            name: call.name,
                            response: { result: successResponse },
                          }],
                        },
                      }));
                    }
                  });
              } else {
                console.log("📡 Fire-and-forget tool: notifying n8n...");
                const immediateResponse = { message: "Message transmis à Romain." };
                updateExchange(immediateResponse, "success");

                supabase.functions
                  .invoke("notify-n8n", {
                    body: {
                      toolName: call.name,
                      args: call.args,
                      message: call.args?.city || JSON.stringify(call.args),
                    },
                  })
                  .then(({ data, error: n8nErr }) => {
                    if (n8nErr) console.error("❌ n8n notification failed:", n8nErr);
                    else console.log("✅ n8n notified, response:", data);
                  });

                ws.send(JSON.stringify({
                  toolResponse: {
                    functionResponses: [{
                      id: call.id,
                      name: call.name,
                      response: { result: immediateResponse },
                    }],
                  },
                }));
              }
            }
          }
        } catch (parseError) {
          console.error("Error parsing WS message:", parseError);
          setError("Réponse Gemini invalide.");
        }
      };

      ws.onerror = (event) => {
        console.error("Gemini WebSocket error:", event);
        setError("Erreur de connexion WebSocket Gemini.");
      };

      ws.onclose = (event) => {
        const closedBeforeReady = !isSetupCompleteRef.current;

        console.log("Gemini WebSocket closed", {
          code: event.code,
          reason: event.reason,
          wasClean: event.wasClean,
        });

        wsRef.current = null;
        cleanup();
        setStatus("disconnected");

        if (!manualCloseRef.current) {
          if (closedBeforeReady) {
            setError(
              event.reason
                ? `Gemini a fermé la session pendant le handshake : ${event.reason}`
                : `Gemini a fermé la session pendant le handshake (code ${event.code}).`,
            );
          } else if (event.code !== 1000) {
            setError(
              event.reason
                ? `Session interrompue : ${event.reason}`
                : `Session interrompue (code ${event.code}).`,
            );
          }
        }

        manualCloseRef.current = false;
      };
    } catch (err) {
      console.error("Start session error:", err);
      cleanup();
      setStatus("disconnected");
      setError(err instanceof Error ? err.message : "Erreur lors du démarrage");
    }
  }, [cleanup, enqueueAudio]);

  const endSession = useCallback(() => {
    manualCloseRef.current = true;

    if (wsRef.current) {
      wsRef.current.close(1000, "User ended session");
      return;
    }

    cleanup();
    setStatus("disconnected");
  }, [cleanup]);

  return {
    status,
    isSpeaking,
    toolCalls,
    toolExchanges,
    error,
    startSession,
    endSession,
    inputLevel,
    audioChunksReceived,
  };
}

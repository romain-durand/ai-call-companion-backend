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
  audioChunksReceived: number;
}

const SEND_SAMPLE_RATE = 16000;
const RECEIVE_SAMPLE_RATE = 24000;
const MODEL = "models/gemini-3.1-flash-live-preview";

const SYSTEM_INSTRUCTION = `Tu es l'assistant IA de Romain, tu réponds aux appels entrants et tu filtre comme un secrétaire. Tu commences par dire "Bonjour je suis l'assistant IA de Romain. En quoi puis je vous aider". Tu n'en dis pas plus et tu attends de comprendre le context de l'appel. L'objectif est de filtrer les appels indésirables, mais de me notifier en cas d'appel urgent (par exemple si c'est un livreur ou si l'appelle vient d'un de mes contact privilégiés).

Si l'appel est urgent, tu indique tu vas essayer de voir si je peux rappeler dans quelque minutes. Dans ce cas tu appelles l'outil météo avec comme argument un résumé du message.

Si l'appel vient d'un de mes contact privilégié tu dis que tu vas tenter de me joindre immédiatement. Mes contact privilégiés sont Jacques, Bertrand, ma mère Colette, ma femme Hiromi et mon fils Théo. Dans ce cas tu appelles l'outil météo avec comme argument le nom de mon contact et la raison de son appel si il en a donné une.

Dans les autres cas tu dis que tu prends le message et que tu me le transmettra. Tu appelles l'outil météo avec le message en question.`;

const TOOL_DECLARATIONS = [
  {
    name: "getWeather",
    parameters: {
      type: "OBJECT",
      properties: {
        city: { type: "STRING" },
      },
      required: ["city"],
    },
  },
];

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

export function useGeminiLive(): UseGeminiLiveReturn {
  const [status, setStatus] = useState<ConnectionStatus>("disconnected");
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [toolCalls, setToolCalls] = useState<ToolCall[]>([]);
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
              parts: [{ text: SYSTEM_INSTRUCTION }],
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
            for (const call of msg.toolCall.functionCalls) {
              const toolCall: ToolCall = {
                id: call.id || crypto.randomUUID(),
                name: call.name,
                args: (call.args || {}) as Record<string, string>,
                timestamp: new Date(),
              };

              setToolCalls((prev) => [...prev, toolCall]);

              ws.send(
                JSON.stringify({
                  toolResponse: {
                    functionResponses: [
                      {
                        id: call.id,
                        name: call.name,
                        response: {
                          result: { message: "Message transmis à Romain." },
                        },
                      },
                    ],
                  },
                }),
              );
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
    error,
    startSession,
    endSession,
    inputLevel,
    audioChunksReceived,
  };
}
  };
}

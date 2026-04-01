/**
 * Twilio ↔ Gemini Live WebSocket Bridge Server
 * 
 * Ce serveur fait le pont entre les Media Streams de Twilio et l'API Gemini Live.
 * 
 * Twilio envoie de l'audio en mulaw 8kHz → on convertit en PCM 16kHz pour Gemini
 * Gemini renvoie du PCM 24kHz → on convertit en mulaw 8kHz pour Twilio
 * 
 * INSTALLATION:
 *   npm init -y
 *   npm install ws dotenv
 * 
 * CONFIGURATION (.env):
 *   GEMINI_API_KEY=your_gemini_api_key
 *   PORT=8081
 *   N8N_WEBHOOK_URL=https://n8n.ted.paris/webhook/466abacc-ec73-401a-9052-71a04ea95eda
 * 
 * LANCEMENT:
 *   node server.js
 * 
 * URL WebSocket à configurer dans TWILIO_BRIDGE_WS_URL:
 *   wss://your-server.com:8081
 */

const WebSocket = require("ws");
const http = require("http");

// Load .env if available
try { require("dotenv").config(); } catch (_) {}

const PORT = process.env.PORT || 8081;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const N8N_WEBHOOK_URL = process.env.N8N_WEBHOOK_URL || "https://n8n.ted.paris/webhook/466abacc-ec73-401a-9052-71a04ea95eda";
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
      properties: { city: { type: "STRING" } },
      required: ["city"],
    },
  },
];

if (!GEMINI_API_KEY) {
  console.error("❌ GEMINI_API_KEY is required. Set it in .env or environment.");
  process.exit(1);
}

// ─── Audio conversion utilities ───

// mulaw decode table
const MULAW_DECODE = new Int16Array(256);
(function buildMulawTable() {
  for (let i = 0; i < 256; i++) {
    let mu = ~i & 0xff;
    let sign = mu & 0x80 ? -1 : 1;
    mu = mu & 0x7f;
    let exponent = (mu >> 4) & 0x07;
    let mantissa = mu & 0x0f;
    let sample = ((mantissa << 1) + 33) << (exponent + 2);
    sample -= 0x84;
    MULAW_DECODE[i] = sign * sample;
  }
})();

// PCM Linear to mulaw
function linearToMulaw(sample) {
  const MULAW_MAX = 0x1fff;
  const MULAW_BIAS = 33;
  const sign = sample < 0 ? 0x80 : 0;
  if (sample < 0) sample = -sample;
  if (sample > MULAW_MAX) sample = MULAW_MAX;
  sample += MULAW_BIAS;
  let exponent = 7;
  const expMask = 0x4000;
  for (; exponent > 0; exponent--) {
    if (sample & expMask) break;
    sample <<= 1;
  }
  const mantissa = (sample >> 10) & 0x0f;
  const mulaw = ~(sign | (exponent << 4) | mantissa) & 0xff;
  return mulaw;
}

// Decode Twilio mulaw 8kHz base64 → PCM Int16 8kHz
function decodeMulaw(base64Data) {
  const buf = Buffer.from(base64Data, "base64");
  const pcm = new Int16Array(buf.length);
  for (let i = 0; i < buf.length; i++) {
    pcm[i] = MULAW_DECODE[buf[i]];
  }
  return pcm;
}

// Simple upsampling 8kHz → 16kHz (linear interpolation)
function upsample8to16(pcm8k) {
  const pcm16k = new Int16Array(pcm8k.length * 2);
  for (let i = 0; i < pcm8k.length; i++) {
    pcm16k[i * 2] = pcm8k[i];
    const next = i + 1 < pcm8k.length ? pcm8k[i + 1] : pcm8k[i];
    pcm16k[i * 2 + 1] = Math.round((pcm8k[i] + next) / 2);
  }
  return pcm16k;
}

// Downsample 24kHz → 8kHz (take every 3rd sample)
function downsample24to8(pcm24k) {
  const pcm8k = new Int16Array(Math.floor(pcm24k.length / 3));
  for (let i = 0; i < pcm8k.length; i++) {
    pcm8k[i] = pcm24k[i * 3];
  }
  return pcm8k;
}

// Encode PCM Int16 → mulaw bytes → base64
function encodeToMulaw(pcm16) {
  const mulaw = Buffer.alloc(pcm16.length);
  for (let i = 0; i < pcm16.length; i++) {
    mulaw[i] = linearToMulaw(pcm16[i]);
  }
  return mulaw.toString("base64");
}

// PCM Int16 → base64 for Gemini (little-endian)
function int16ToBase64(int16Array) {
  const buf = Buffer.from(int16Array.buffer, int16Array.byteOffset, int16Array.byteLength);
  return buf.toString("base64");
}

// Decode Gemini PCM base64 → Int16
function base64ToInt16(base64) {
  const buf = Buffer.from(base64, "base64");
  return new Int16Array(buf.buffer, buf.byteOffset, buf.byteLength / 2);
}

// ─── Notify n8n ───
async function notifyN8n(toolName, args, message) {
  try {
    const params = new URLSearchParams();
    if (toolName) params.set("tool", toolName);
    if (message) params.set("message", message);
    if (args) {
      for (const [k, v] of Object.entries(args)) {
        params.set(k, v);
      }
    }
    const url = `${N8N_WEBHOOK_URL}?${params.toString()}`;
    console.log("📡 Notifying n8n:", url);
    const resp = await fetch(url);
    console.log("✅ n8n response:", resp.status);
  } catch (e) {
    console.error("❌ n8n notification failed:", e.message);
  }
}

// ─── HTTP + WebSocket server ───
const server = http.createServer((req, res) => {
  res.writeHead(200, { "Content-Type": "text/plain" });
  res.end("Twilio-Gemini Bridge Server is running");
});

const wss = new WebSocket.Server({ server });

wss.on("connection", (twilioWs, req) => {
  console.log("🔌 New Twilio Media Stream connection");

  let streamSid = null;
  let callerNumber = "unknown";
  let geminiWs = null;
  let geminiReady = false;

  // Connect to Gemini Live
  function connectGemini() {
    const wsUrl = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent?key=${GEMINI_API_KEY}`;
    geminiWs = new WebSocket(wsUrl);

    geminiWs.on("open", () => {
      console.log("🤖 Connected to Gemini Live");
      const setup = {
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
      geminiWs.send(JSON.stringify(setup));
    });

    geminiWs.on("message", (data) => {
      try {
        const msg = JSON.parse(data.toString());

        if (msg.setupComplete) {
          geminiReady = true;
          console.log("✅ Gemini setup complete, ready for audio");
          return;
        }

        // Handle audio response from Gemini
        if (msg.serverContent?.modelTurn?.parts) {
          for (const part of msg.serverContent.modelTurn.parts) {
            if (part.inlineData?.data) {
              // Gemini sends PCM 24kHz → downsample to 8kHz → encode mulaw
              const pcm24k = base64ToInt16(part.inlineData.data);
              const pcm8k = downsample24to8(pcm24k);
              const mulawBase64 = encodeToMulaw(pcm8k);

              // Send to Twilio
              if (twilioWs.readyState === WebSocket.OPEN && streamSid) {
                twilioWs.send(JSON.stringify({
                  event: "media",
                  streamSid,
                  media: { payload: mulawBase64 },
                }));
              }
            }
          }
        }

        // Handle transcriptions
        if (msg.serverContent?.inputTranscription?.text) {
          console.log("🎤 Caller:", msg.serverContent.inputTranscription.text);
        }
        if (msg.serverContent?.outputTranscription?.text) {
          console.log("🤖 Assistant:", msg.serverContent.outputTranscription.text);
        }

        // Handle tool calls
        if (msg.toolCall?.functionCalls) {
          for (const call of msg.toolCall.functionCalls) {
            console.log("🔧 Tool call:", call.name, call.args);

            // Notify n8n
            notifyN8n(call.name, call.args, call.args?.city || JSON.stringify(call.args));

            // Respond to Gemini
            geminiWs.send(JSON.stringify({
              toolResponse: {
                functionResponses: [{
                  id: call.id,
                  name: call.name,
                  response: { result: { message: "Message transmis à Romain." } },
                }],
              },
            }));
          }
        }
      } catch (e) {
        console.error("Error processing Gemini message:", e.message);
      }
    });

    geminiWs.on("close", (code, reason) => {
      console.log(`🤖 Gemini disconnected: ${code} ${reason}`);
      geminiReady = false;
    });

    geminiWs.on("error", (err) => {
      console.error("🤖 Gemini error:", err.message);
    });
  }

  // Handle Twilio messages
  twilioWs.on("message", (message) => {
    try {
      const msg = JSON.parse(message.toString());

      switch (msg.event) {
        case "connected":
          console.log("📞 Twilio stream connected");
          break;

        case "start":
          streamSid = msg.start.streamSid;
          callerNumber = msg.start.customParameters?.callerNumber || "unknown";
          console.log(`📞 Call started - StreamSid: ${streamSid}, Caller: ${callerNumber}`);
          connectGemini();
          break;

        case "media":
          if (!geminiReady || !geminiWs || geminiWs.readyState !== WebSocket.OPEN) return;

          // Twilio sends mulaw 8kHz → decode → upsample to 16kHz → send to Gemini
          const pcm8k = decodeMulaw(msg.media.payload);
          const pcm16k = upsample8to16(pcm8k);
          const pcmBase64 = int16ToBase64(pcm16k);

          geminiWs.send(JSON.stringify({
            realtimeInput: {
              audio: {
                data: pcmBase64,
                mimeType: "audio/pcm;rate=16000",
              },
            },
          }));
          break;

        case "stop":
          console.log("📞 Call ended");
          if (geminiWs) {
            geminiWs.close(1000, "Call ended");
          }
          break;

        default:
          break;
      }
    } catch (e) {
      console.error("Error processing Twilio message:", e.message);
    }
  });

  twilioWs.on("close", () => {
    console.log("📞 Twilio stream disconnected");
    if (geminiWs) {
      geminiWs.close(1000, "Twilio disconnected");
    }
  });

  twilioWs.on("error", (err) => {
    console.error("📞 Twilio stream error:", err.message);
  });
});

server.listen(PORT, () => {
  console.log(`🚀 Twilio-Gemini Bridge running on port ${PORT}`);
  console.log(`   WebSocket URL: ws://localhost:${PORT}`);
  console.log(`   Configure TWILIO_BRIDGE_WS_URL in your edge function to point here`);
});

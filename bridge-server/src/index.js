const http = require("http");
const WebSocket = require("ws");
const url = require("url");
const { PORT } = require("./config/env");
const { handleTwilioConnection } = require("./twilio/twilioConnection");
const { handleTransferAudioConnection } = require("./transfer/transferAudioHandler");
const { handleOutboundStreamConnection } = require("./outbound/outboundStreamHandler");
const { startOutboundPoller } = require("./outbound/outboundPoller");
const { handleWebCallConnection } = require("./web/webCallHandler");
const { handleGoogleStart, handleGoogleCallback } = require("./auth/googleOAuth");
const { handleTwilioVoice } = require("./twilio/twilioVoiceHandler");
const log = require("./observability/logger");

const server = http.createServer((req, res) => {
  const pathname = url.parse(req.url).pathname;

  // CORS preflight
  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Authorization",
    });
    return res.end();
  }

  // Twilio voice webhook (replaces the Edge Function)
  if (pathname === "/twilio-voice" && req.method === "POST") {
    return handleTwilioVoice(req, res);
  }

  // OAuth routes
  if (pathname === "/auth/google/start" && req.method === "GET") {
    return handleGoogleStart(req, res);
  }
  if (pathname === "/auth/google/callback" && req.method === "GET") {
    return handleGoogleCallback(req, res);
  }

  // Health check
  res.writeHead(200, { "Content-Type": "text/plain" });
  res.end("Twilio-Gemini Bridge Server is running");
});

const wss = new WebSocket.Server({ noServer: true });
const transferWss = new WebSocket.Server({ noServer: true });
const outboundWss = new WebSocket.Server({ noServer: true });

server.on("upgrade", (req, socket, head) => {
  const pathname = url.parse(req.url).pathname;

  if (pathname === "/transfer-audio") {
    transferWss.handleUpgrade(req, socket, head, (ws) => {
      handleTransferAudioConnection(ws);
    });
  } else if (pathname === "/outbound-stream") {
    outboundWss.handleUpgrade(req, socket, head, (ws) => {
      handleOutboundStreamConnection(ws);
    });
  } else {
    // Default: Twilio media stream (inbound)
    wss.handleUpgrade(req, socket, head, (ws) => {
      handleTwilioConnection(ws);
    });
  }
});

server.listen(PORT, () => {
  log.server("bridge_started", `port ${PORT} — ${new Date().toISOString()}`);
  log.server("ws_url", `ws://localhost:${PORT}`);

  // Start outbound mission poller
  startOutboundPoller();
});

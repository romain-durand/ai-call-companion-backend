const http = require("http");
const WebSocket = require("ws");
const { PORT } = require("./config/env");
const { handleTwilioConnection } = require("./twilio/twilioConnection");
const log = require("./observability/logger");

const server = http.createServer((req, res) => {
  res.writeHead(200, { "Content-Type": "text/plain" });
  res.end("Twilio-Gemini Bridge Server is running");
});

const wss = new WebSocket.Server({ server });

wss.on("connection", (ws, req) => {
  handleTwilioConnection(ws);
});

server.listen(PORT, () => {
  log.server("bridge_started", `port ${PORT} — ${new Date().toISOString()}`);
  log.server("ws_url", `ws://localhost:${PORT}`);
});

const WebSocket = require("ws");
const { decodeMulaw, encodeToMulaw, upsample8to16, SILENCE_200MS } = require("../audio/codec");
const callStore = require("../calls/callStateStore");
const log = require("../observability/logger");

/**
 * Handle a user WebSocket connection for call transfer audio.
 * The user's browser connects here after accepting a transfer.
 *
 * Protocol:
 * - User sends: { type: "join", callSessionId: "<uuid>" }
 * - Then sends: { type: "audio", data: "<base64 PCM 16kHz>" }
 * - Bridge relays Twilio audio to user as: { type: "audio", data: "<base64 PCM 16kHz>" }
 */
function handleTransferAudioConnection(userWs) {
  let linkedCallCtx = null;
  let joined = false;

  userWs.on("message", (raw) => {
    try {
      const msg = JSON.parse(raw.toString());

      if (msg.type === "join" && msg.callSessionId && !joined) {
        // Find the call context by callSessionId
        for (const [, ctx] of callStore.all()) {
          if (ctx.callSessionId === msg.callSessionId && ctx._transferState) {
            linkedCallCtx = ctx;
            joined = true;

            // Register this WS as the user audio sink/source
            ctx._transferState.userWs = userWs;
            log.call("transfer_user_joined", ctx.traceId, `session=${msg.callSessionId}`);

            // Send confirmation
            userWs.send(JSON.stringify({ type: "joined", callSessionId: msg.callSessionId }));
            return;
          }
        }

        // No matching call found
        userWs.send(JSON.stringify({ type: "error", message: "No active transfer for this session" }));
        userWs.close(1008, "No matching call");
        return;
      }

      if (msg.type === "audio" && joined && linkedCallCtx) {
        // User sends PCM 16kHz base64 → downsample to 8kHz → encode mulaw → send to Twilio
        const pcm16k = base64ToInt16(msg.data);
        const pcm8k = downsample16to8(pcm16k);
        const mulawBase64 = encodeToMulaw(pcm8k);

        // Send to Twilio via the existing twilioWs
        if (linkedCallCtx._transferState?.sendToTwilio) {
          linkedCallCtx._transferState.sendToTwilio(mulawBase64);
        }
      }

      if (msg.type === "hangup" && joined && linkedCallCtx) {
        log.call("transfer_user_hangup", linkedCallCtx.traceId);
        if (typeof linkedCallCtx._hangup === "function") {
          linkedCallCtx._hangup("user_ended_transfer");
        }
      }
    } catch (e) {
      if (linkedCallCtx) {
        log.error("transfer_audio_error", linkedCallCtx.traceId, e.message);
      }
    }
  });

  userWs.on("close", () => {
    if (linkedCallCtx) {
      log.call("transfer_user_disconnected", linkedCallCtx.traceId);
      // If user disconnects during transfer, reconnect Gemini
      if (linkedCallCtx._transferState?.onUserDisconnect) {
        linkedCallCtx._transferState.onUserDisconnect();
      }
    }
  });
}

// ─── Codec helpers (PCM 16kHz ↔ 8kHz for user audio) ─────────

function base64ToInt16(base64) {
  const buf = Buffer.from(base64, "base64");
  return new Int16Array(buf.buffer, buf.byteOffset, buf.byteLength / 2);
}

function downsample16to8(pcm16k) {
  const pcm8k = new Int16Array(Math.floor(pcm16k.length / 2));
  for (let i = 0; i < pcm8k.length; i++) {
    pcm8k[i] = pcm16k[i * 2];
  }
  return pcm8k;
}

module.exports = { handleTransferAudioConnection };
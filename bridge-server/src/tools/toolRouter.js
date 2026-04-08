const { notifyBackend } = require("./toolClient");
const log = require("../observability/logger");

// Route a Gemini tool call to the appropriate handler
// Returns the response object to send back to Gemini
async function handleToolCall(call, traceId) {
  log.tool("tool_call", traceId, `${call.name} ${JSON.stringify(call.args)}`);

  // Future: switch on call.name to dispatch to different edge functions
  // For now all tools route to n8n
  await notifyBackend(call.name, call.args, call.args?.city || JSON.stringify(call.args), traceId);

  return {
    id: call.id,
    name: call.name,
    response: { result: { message: "Message transmis à Romain." } },
  };
}

module.exports = { handleToolCall };

const { supabaseAdmin } = require("../db/supabaseAdmin");
const log = require("../observability/logger");
const { executeOutboundMission } = require("./outboundCallExecutor");

const POLL_INTERVAL_MS = 5000; // 5 seconds

let polling = false;

/**
 * Start polling for queued outbound missions.
 */
function startOutboundPoller() {
  log.server("outbound_poller_started", `interval=${POLL_INTERVAL_MS}ms`);

  setInterval(async () => {
    if (polling) return; // Prevent concurrent polls
    polling = true;

    try {
      // Fetch missions that are queued and ready (scheduled_at <= now or null)
      const { data: missions, error } = await supabaseAdmin
        .from("outbound_missions")
        .select("*")
        .eq("status", "queued")
        .or(`scheduled_at.is.null,scheduled_at.lte.${new Date().toISOString()}`)
        .order("created_at", { ascending: true })
        .limit(1); // Process one at a time for V1

      if (error) {
        log.error("outbound_poller_query_error", "poller", error.message);
        return;
      }

      if (!missions || missions.length === 0) return;

      const mission = missions[0];
      log.server("outbound_mission_picked", `id=${mission.id} objective="${mission.objective.slice(0, 60)}"`);

      // Mark as in_progress immediately to prevent re-picking
      const { error: updateErr } = await supabaseAdmin
        .from("outbound_missions")
        .update({ status: "in_progress", attempt_count: mission.attempt_count + 1 })
        .eq("id", mission.id)
        .eq("status", "queued"); // Optimistic lock

      if (updateErr) {
        log.error("outbound_mission_lock_error", mission.id, updateErr.message);
        return;
      }

      // Execute the mission (non-blocking — runs in background)
      executeOutboundMission(mission).catch((err) => {
        log.error("outbound_mission_execution_error", mission.id, err.message);
        // Mark as failed
        supabaseAdmin
          .from("outbound_missions")
          .update({ status: "failed", result_status: "failure", result_summary: `Erreur technique: ${err.message}`, completed_at: new Date().toISOString() })
          .eq("id", mission.id)
          .then(() => {});
      });
    } catch (e) {
      log.error("outbound_poller_error", "poller", e.message);
    } finally {
      polling = false;
    }
  }, POLL_INTERVAL_MS);
}

module.exports = { startOutboundPoller };

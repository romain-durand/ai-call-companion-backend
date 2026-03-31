import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const N8N_WEBHOOK_URL =
  "https://n8n.ted.paris/webhook-test/466abacc-ec73-401a-9052-71a04ea95eda";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const { toolName, args, message } = body as {
      toolName?: string;
      args?: Record<string, string>;
      message?: string;
    };

    const params = new URLSearchParams();
    if (toolName) params.set("tool", toolName);
    if (message) params.set("message", message);
    if (args) {
      for (const [k, v] of Object.entries(args)) {
        params.set(k, v);
      }
    }

    const url = `${N8N_WEBHOOK_URL}?${params.toString()}`;
    console.log("Calling n8n webhook:", url);

    const resp = await fetch(url, { method: "GET" });
    const text = await resp.text();

    return new Response(
      JSON.stringify({ ok: resp.ok, status: resp.status, body: text }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("notify-n8n error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});

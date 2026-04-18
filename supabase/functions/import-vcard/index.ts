import { createClient } from "https://esm.sh/@supabase/supabase-js@2.95.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ParsedContact {
  firstName: string | null;
  lastName: string | null;
  displayName: string | null;
  phone: string | null;
  email: string | null;
  company: string | null;
}

function decodeQuotedPrintable(str: string): string {
  return str.replace(/=([0-9A-F]{2})/gi, (_, h) => String.fromCharCode(parseInt(h, 16)));
}

function unfoldVCardLines(text: string): string[] {
  // vCard line continuation: lines starting with space/tab continue the previous one
  const raw = text.replace(/\r\n/g, "\n").split("\n");
  const out: string[] = [];
  for (const line of raw) {
    if ((line.startsWith(" ") || line.startsWith("\t")) && out.length > 0) {
      out[out.length - 1] += line.slice(1);
    } else {
      out.push(line);
    }
  }
  return out;
}

function parseVCardLine(line: string): { key: string; params: Record<string, string>; value: string } | null {
  const colonIdx = line.indexOf(":");
  if (colonIdx === -1) return null;
  const left = line.slice(0, colonIdx);
  let value = line.slice(colonIdx + 1);
  const parts = left.split(";");
  const key = parts[0].toUpperCase();
  const params: Record<string, string> = {};
  for (let i = 1; i < parts.length; i++) {
    const [k, v] = parts[i].split("=");
    if (k) params[k.toUpperCase()] = (v || "").toUpperCase();
  }
  if (params["ENCODING"] === "QUOTED-PRINTABLE") value = decodeQuotedPrintable(value);
  return { key, params, value };
}

function parseVCards(text: string): ParsedContact[] {
  const lines = unfoldVCardLines(text);
  const contacts: ParsedContact[] = [];
  let current: ParsedContact | null = null;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (trimmed.toUpperCase().startsWith("BEGIN:VCARD")) {
      current = { firstName: null, lastName: null, displayName: null, phone: null, email: null, company: null };
      continue;
    }
    if (trimmed.toUpperCase().startsWith("END:VCARD")) {
      if (current) contacts.push(current);
      current = null;
      continue;
    }
    if (!current) continue;

    const parsed = parseVCardLine(trimmed);
    if (!parsed) continue;
    const { key, value } = parsed;

    if (key === "FN" && !current.displayName) {
      current.displayName = value.trim();
    } else if (key === "N") {
      const [last, first] = value.split(";");
      if (!current.lastName) current.lastName = (last || "").trim() || null;
      if (!current.firstName) current.firstName = (first || "").trim() || null;
    } else if (key === "TEL" && !current.phone) {
      current.phone = value.trim();
    } else if (key === "EMAIL" && !current.email) {
      current.email = value.trim();
    } else if (key === "ORG" && !current.company) {
      current.company = value.split(";")[0].trim() || null;
    }
  }
  return contacts;
}

function normalizePhone(raw: string | null): string | null {
  if (!raw) return null;
  const cleaned = raw.replace(/[\s\-().]/g, "");
  if (!cleaned) return null;
  if (cleaned.startsWith("+")) return cleaned;
  if (cleaned.startsWith("00")) return "+" + cleaned.slice(2);
  if (cleaned.startsWith("0")) return "+33" + cleaned.slice(1);
  return cleaned;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsErr } = await supabase.auth.getClaims(token);
    if (claimsErr || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = claimsData.claims.sub;

    const body = await req.json();
    const accountId: string | undefined = body.account_id;
    const vcardText: string | undefined = body.vcard;
    if (!accountId || !vcardText) {
      return new Response(JSON.stringify({ error: "missing_params" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify membership
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const { data: membership } = await admin
      .from("account_members")
      .select("role")
      .eq("profile_id", userId)
      .eq("account_id", accountId)
      .maybeSingle();
    if (!membership) {
      return new Response(JSON.stringify({ error: "forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const parsed = parseVCards(vcardText);

    // Pre-load existing phones
    const { data: existing } = await admin
      .from("contacts")
      .select("primary_phone_e164")
      .eq("account_id", accountId);
    const seenPhones = new Set<string>();
    (existing || []).forEach((c: any) => c.primary_phone_e164 && seenPhones.add(c.primary_phone_e164));

    let imported = 0;
    let skipped = 0;

    for (const c of parsed) {
      const phone = normalizePhone(c.phone);
      if (!phone && !c.email) {
        skipped++;
        continue;
      }
      if (phone && seenPhones.has(phone)) {
        skipped++;
        continue;
      }
      const { error } = await admin.from("contacts").insert({
        account_id: accountId,
        first_name: c.firstName,
        last_name: c.lastName,
        display_name: c.displayName,
        primary_phone_e164: phone,
        email: c.email,
        company_name: c.company,
        source: "vcard_import",
        is_favorite: false,
        is_blocked: false,
      });
      if (error) {
        skipped++;
      } else {
        imported++;
        if (phone) seenPhones.add(phone);
      }
    }

    return new Response(JSON.stringify({ imported, skipped, parsed: parsed.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

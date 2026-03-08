import "https://esm.sh/@supabase/functions-js/src/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { adminEmail, userEmail, seatLabels, allCancelled, bookingId } = await req.json();

    if (!adminEmail || !userEmail || !seatLabels || !bookingId) {
      return new Response(JSON.stringify({ error: "Missing fields" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    if (!RESEND_API_KEY) {
      return new Response(JSON.stringify({ error: "RESEND_API_KEY not set" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const seatsHtml = seatLabels
      .map((s: string) => `<span style="display:inline-block;background:#fee2e2;color:#dc2626;padding:4px 10px;border-radius:6px;margin:2px;font-size:14px;">${s}</span>`)
      .join(" ");

    const html = `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px;background:#ffffff;">
        <h1 style="text-align:center;color:#1e293b;font-size:24px;">🎬 Avbokning</h1>
        <h2 style="text-align:center;color:#dc2626;font-size:18px;font-weight:normal;">
          ${allCancelled ? "Hela bokningen avbokad" : "Enskild plats avbokad"}
        </h2>
        
        <div style="background:#f8fafc;border-radius:12px;padding:20px;margin:20px 0;">
          <p style="color:#475569;font-size:14px;margin:0 0 8px;"><strong>Bokare:</strong> ${userEmail}</p>
          <p style="color:#475569;font-size:14px;margin:0 0 8px;"><strong>Boknings-ID:</strong> ${bookingId}</p>
          <p style="color:#475569;font-size:14px;margin:0;"><strong>Avbokade platser:</strong></p>
          <div style="margin-top:8px;">${seatsHtml}</div>
        </div>
        
        <p style="text-align:center;color:#94a3b8;font-size:12px;">
          ${allCancelled ? "Bokningen har raderats helt." : "Resterande platser i bokningen är kvar."}
        </p>
      </div>
    `;

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: "Sägen Filmkväll <onboarding@resend.dev>",
        to: [adminEmail],
        subject: `❌ Avbokning – ${userEmail} (${seatLabels.join(", ")})`,
        html,
      }),
    });

    const result = await res.json();

    if (!res.ok) {
      console.error("Resend error:", result);
      return new Response(JSON.stringify({ error: "Email send failed", details: result }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Edge function error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

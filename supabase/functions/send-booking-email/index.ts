import "https://esm.sh/@supabase/functions-js/src/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import nodemailer from "npm:nodemailer@6.9.16";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface TicketRow {
  id: string;
  first_name: string;
  last_name: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { bookingId, email, appUrl } = await req.json();

    if (!bookingId || !email || !appUrl) {
      return new Response(JSON.stringify({ error: "Missing fields" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const rawGmailAppPassword = Deno.env.get("GMAIL_APP_PASSWORD");
    const GMAIL_APP_PASSWORD = rawGmailAppPassword?.replace(/\s+/g, "");
    if (!GMAIL_APP_PASSWORD) {
      return new Response(JSON.stringify({ error: "GMAIL_APP_PASSWORD not set" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: booking } = await supabase
      .from("bookings")
      .select("booking_number")
      .eq("id", bookingId)
      .maybeSingle();

    const { data: tickets } = await supabase
      .from("tickets")
      .select("id, first_name, last_name")
      .eq("booking_id", bookingId)
      .order("created_at");

    const ticketRows = (tickets || []) as TicketRow[];
    const bookingNumber = booking?.booking_number ?? "";

    const GMAIL_USER = "bjarkikjellsson@gmail.com";

    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: { user: GMAIL_USER, pass: GMAIL_APP_PASSWORD },
    });

    const cancelUrl = `${appUrl}/cancel/${bookingId}`;
    const logoUrl =
      "https://ukopmsfkoexlgtwirkgt.supabase.co/storage/v1/object/public/email-assets/sagen-logo-email.jpg";

    const ticketsHtml = ticketRows
      .map((t) => {
        const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=400x400&margin=20&qzone=4&ecc=H&format=png&data=${encodeURIComponent(t.id)}`;
        return `
          <div style="text-align:center;border:1px solid #e2e8f0;border-radius:12px;padding:20px;margin:16px 0;">
            <p style="margin:0 0 12px;font-size:16px;font-weight:600;color:#1e293b;">${t.first_name} ${t.last_name}</p>
            <img src="${qrUrl}" alt="QR-kod" width="220" height="220" style="border-radius:8px;background:#ffffff;" />
          </div>`;
      })
      .join("");

    const html = `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px;background:#ffffff;">
        <div style="text-align:center;margin-bottom:16px;border-radius:12px;overflow:hidden;">
          <img src="${logoUrl}" alt="Sägen Film" width="480" style="max-width:100%;height:auto;display:block;" />
        </div>
        <h2 style="text-align:center;color:#475569;font-size:18px;font-weight:normal;">Din bokning är bekräftad!</h2>

        <p style="text-align:center;color:#1e293b;font-size:15px;">
          Bokningsnummer<br />
          <strong style="font-size:26px;letter-spacing:3px;">${bookingNumber}</strong>
        </p>

        <p style="text-align:center;color:#64748b;font-size:14px;">
          En QR-kod per person – visa den vid ingången. Varje kod gäller för en person.
        </p>

        ${ticketsHtml}

        <div style="text-align:center;margin-top:32px;padding-top:24px;border-top:1px solid #e2e8f0;">
          <p style="color:#64748b;font-size:13px;margin-bottom:12px;">Kan du inte komma?</p>
          <a href="${cancelUrl}" style="display:inline-block;background:#ef4444;color:#ffffff;padding:10px 24px;border-radius:8px;text-decoration:none;font-size:14px;font-weight:500;">Avboka</a>
        </div>
      </div>
    `;

    await transporter.sendMail({
      from: `"Sägen Filmkväll" <${GMAIL_USER}>`,
      to: email,
      subject: "🎬 Dina biljetter – Sägen Filmkväll 2026",
      html,
    });

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Edge function error:", err);
    const errorMessage = err instanceof Error ? err.message : String(err);
    const errorCode =
      typeof err === "object" && err !== null && "code" in err
        ? String((err as { code?: unknown }).code ?? "")
        : "";
    const isGmailAuthError = errorCode === "EAUTH" || errorMessage.includes("Invalid login: 535");

    return new Response(
      JSON.stringify({
        error: isGmailAuthError
          ? "Gmail authentication failed. Generate a new 16-character app password and save it without spaces."
          : errorMessage,
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});

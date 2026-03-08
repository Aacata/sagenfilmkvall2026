import "https://esm.sh/@supabase/functions-js/src/edge-runtime.d.ts";
import nodemailer from "npm:nodemailer@6.9.16";

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
    const { bookingId, email, seatLabels, appUrl } = await req.json();

    if (!bookingId || !email || !seatLabels || !appUrl) {
      return new Response(JSON.stringify({ error: "Missing fields" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const GMAIL_APP_PASSWORD = Deno.env.get("GMAIL_APP_PASSWORD");
    if (!GMAIL_APP_PASSWORD) {
      return new Response(JSON.stringify({ error: "GMAIL_APP_PASSWORD not set" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const GMAIL_USER = "bjarkikjellsson@gmail.com";

    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: GMAIL_USER,
        pass: GMAIL_APP_PASSWORD,
      },
    });

    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(bookingId)}`;
    const cancelUrl = `${appUrl}/cancel/${bookingId}`;

    const seatsHtml = seatLabels
      .map((s: string) => `<span style="display:inline-block;background:#e0e7ff;color:#3730a3;padding:4px 10px;border-radius:6px;margin:2px;font-size:14px;">${s}</span>`)
      .join(" ");

    const logoUrl = "https://ukopmsfkoexlgtwirkgt.supabase.co/storage/v1/object/public/email-assets/sagen-logo-email.jpg";

    const html = `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px;background:#ffffff;">
        <div style="text-align:center;margin-bottom:16px;border-radius:12px;overflow:hidden;">
          <img src="${logoUrl}" alt="Sägen Film" width="480" style="max-width:100%;height:auto;display:block;" />
        </div>
        <h2 style="text-align:center;color:#475569;font-size:18px;font-weight:normal;">Din bokning är bekräftad!</h2>
        
        <div style="text-align:center;margin:24px 0;">
          <img src="${qrUrl}" alt="QR-kod för bokning" width="250" height="250" style="border-radius:12px;" />
        </div>
        
        <p style="text-align:center;color:#64748b;font-size:14px;">Visa denna QR-kod vid ingången</p>
        
        <div style="text-align:center;margin:16px 0;">
          ${seatsHtml}
        </div>
        
        <p style="text-align:center;color:#94a3b8;font-size:12px;margin-top:24px;">
          Boknings-ID: ${bookingId}
        </p>

        <div style="text-align:center;margin-top:32px;padding-top:24px;border-top:1px solid #e2e8f0;">
          <p style="color:#64748b;font-size:13px;margin-bottom:12px;">Ångrar du dig?</p>
          <a href="${cancelUrl}" style="display:inline-block;background:#ef4444;color:#ffffff;padding:10px 24px;border-radius:8px;text-decoration:none;font-size:14px;font-weight:500;">Avboka bokning</a>
        </div>
      </div>
    `;

    await transporter.sendMail({
      from: `"Sägen Filmkväll" <${GMAIL_USER}>`,
      to: email,
      subject: "🎬 Din bokning – Sägen Filmkväll 2026",
      html,
    });

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

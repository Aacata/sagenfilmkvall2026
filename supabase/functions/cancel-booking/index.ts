import "https://esm.sh/@supabase/functions-js/src/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import nodemailer from "npm:nodemailer@6.9.16";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Fixed, server-side recipient. Never taken from the request body.
const ADMIN_EMAIL = "hellosagen@gmail.com";
const GMAIL_USER = "bjarkikjellsson@gmail.com";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const escapeHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

interface BookingPublic {
  id: string;
  email: string;
  booking_number: string;
  tickets: { id: string; first_name: string; last_name: string }[];
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  try {
    const { bookingId, ticketId } = await req.json();

    if (typeof bookingId !== "string" || !UUID_RE.test(bookingId)) {
      return json({ error: "Ogiltig bokning" }, 400);
    }
    if (ticketId !== undefined && ticketId !== null && (typeof ticketId !== "string" || !UUID_RE.test(ticketId))) {
      return json({ error: "Ogiltig biljett" }, 400);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Everything shown in the notification is derived server-side from the database.
    const { data: bookingData } = await supabase.rpc("get_booking_public", { _booking_id: bookingId });
    const booking = bookingData as unknown as BookingPublic | null;
    if (!booking) {
      return json({ error: "Bokningen hittades inte" }, 404);
    }

    let result: Record<string, unknown> | null = null;
    let names: string[] = [];
    let allCancelled = false;

    if (ticketId) {
      const ticket = booking.tickets.find((t) => t.id === ticketId);
      if (!ticket) return json({ error: "Biljetten hittades inte" }, 404);

      const { data, error } = await supabase.rpc("cancel_ticket", {
        _booking_id: bookingId,
        _ticket_id: ticketId,
      });
      if (error) throw error;
      result = data as Record<string, unknown>;
      if (result?.error) return json({ error: result.error }, 400);

      names = [`${ticket.first_name} ${ticket.last_name}`];
      allCancelled = !!result?.booking_deleted;
    } else {
      const { data, error } = await supabase.rpc("cancel_booking", { _booking_id: bookingId });
      if (error) throw error;
      result = data as Record<string, unknown>;
      if (result?.error) return json({ error: result.error }, 400);

      names = booking.tickets.map((t) => `${t.first_name} ${t.last_name}`);
      allCancelled = true;
    }

    // Notify the admin. Failure to send must not undo the cancellation.
    const GMAIL_APP_PASSWORD = Deno.env.get("GMAIL_APP_PASSWORD")?.replace(/\s+/g, "");
    if (GMAIL_APP_PASSWORD) {
      try {
        const transporter = nodemailer.createTransport({
          service: "gmail",
          auth: { user: GMAIL_USER, pass: GMAIL_APP_PASSWORD },
        });

        const namesHtml = names
          .map(
            (s) =>
              `<span style="display:inline-block;background:#fee2e2;color:#dc2626;padding:4px 10px;border-radius:6px;margin:2px;font-size:14px;">${escapeHtml(s)}</span>`,
          )
          .join(" ");

        const html = `
          <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px;background:#ffffff;">
            <h1 style="text-align:center;color:#1e293b;font-size:24px;">🎬 Avbokning</h1>
            <h2 style="text-align:center;color:#dc2626;font-size:18px;font-weight:normal;">
              ${allCancelled ? "Hela bokningen avbokad" : "Enskild biljett avbokad"}
            </h2>
            <div style="background:#f8fafc;border-radius:12px;padding:20px;margin:20px 0;">
              <p style="color:#475569;font-size:14px;margin:0 0 8px;"><strong>Bokare:</strong> ${escapeHtml(booking.email)}</p>
              <p style="color:#475569;font-size:14px;margin:0 0 8px;"><strong>Bokningsnummer:</strong> ${escapeHtml(booking.booking_number)}</p>
              <p style="color:#475569;font-size:14px;margin:0;"><strong>Avbokade biljetter:</strong></p>
              <div style="margin-top:8px;">${namesHtml}</div>
            </div>
            <p style="text-align:center;color:#94a3b8;font-size:12px;">
              ${allCancelled ? "Bokningen har raderats helt." : "Resterande biljetter i bokningen är kvar."}
            </p>
          </div>
        `;

        await transporter.sendMail({
          from: `"Sägen Filmkväll" <${GMAIL_USER}>`,
          to: ADMIN_EMAIL,
          subject: `❌ Avbokning – ${booking.email} (${names.join(", ")})`,
          html,
        });
      } catch (mailErr) {
        console.error("Cancellation notice email failed:", mailErr);
      }
    }

    return json({
      success: true,
      booking_deleted: allCancelled,
      names,
    });
  } catch (err) {
    console.error("cancel-booking error:", err);
    return json({ error: "Ett fel uppstod vid avbokningen" }, 500);
  }
});

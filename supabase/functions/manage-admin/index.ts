import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Verify caller
    const authHeader = req.headers.get("Authorization")!;
    const token = authHeader.replace("Bearer ", "");
    const anonClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: claimsData, error: claimsError } = await anonClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Ej autentiserad" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const callerId = claimsData.claims.sub as string;
    const { data: isAdmin } = await supabaseAdmin.rpc("has_role", { _user_id: callerId, _role: "admin" });
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "Ej behörig" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { action, email, roleId } = body;

    if (action === "list") {
      const { data: roles, error: rolesErr } = await supabaseAdmin
        .from("user_roles")
        .select("id, user_id")
        .eq("role", "admin");
      if (rolesErr) throw rolesErr;

      const adminsWithEmail = await Promise.all(
        (roles || []).map(async (r: { id: string; user_id: string }) => {
          const { data } = await supabaseAdmin.auth.admin.getUserById(r.user_id);
          return { id: r.id, user_id: r.user_id, email: data?.user?.email || "okänd" };
        })
      );

      return new Response(JSON.stringify({ admins: adminsWithEmail }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "add") {
      let userId: string;
      let tempPassword: string | null = null;

      // Unique random one-time password per new account (never a shared default).
      const generatePassword = () => {
        const bytes = crypto.getRandomValues(new Uint8Array(18));
        const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
        return Array.from(bytes, (b) => chars[b % chars.length]).join("") + "!9";
      };

      const candidate = generatePassword();

      // Try creating the user with a one-time random password
      const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email,
        password: candidate,
        email_confirm: true,
      });

      if (createError) {
        // User exists - find via DB function
        const { data: foundId, error: findErr } = await supabaseAdmin.rpc("find_user_by_email_fn", { _email: email });
        if (findErr || !foundId) {
          return new Response(JSON.stringify({ error: "Användaren kunde inte hittas. Fel: " + (createError.message) }), {
            status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        userId = foundId;
      } else {
        userId = newUser.user.id;
        tempPassword = candidate;
      }


      // Fix NULL columns to prevent GoTrue scan errors
      await supabaseAdmin.rpc("fix_auth_user_nulls", { _user_id: userId });

      // Check if already admin
      const { data: existing } = await supabaseAdmin
        .from("user_roles")
        .select("id")
        .eq("user_id", userId)
        .eq("role", "admin")
        .maybeSingle();

      if (existing) {
        return new Response(JSON.stringify({ error: "Användaren är redan admin." }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { error: insertError } = await supabaseAdmin
        .from("user_roles")
        .insert({ user_id: userId, role: "admin" });
      if (insertError) throw insertError;

      return new Response(JSON.stringify({ success: true, created: !createError }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "remove") {
      const { data: role } = await supabaseAdmin
        .from("user_roles")
        .select("user_id")
        .eq("id", roleId)
        .single();

      if (role?.user_id === callerId) {
        return new Response(JSON.stringify({ error: "Du kan inte ta bort dig själv som admin." }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { error: deleteError } = await supabaseAdmin
        .from("user_roles")
        .delete()
        .eq("id", roleId);
      if (deleteError) throw deleteError;

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Ogiltig åtgärd" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

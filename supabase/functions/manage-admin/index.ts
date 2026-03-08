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

    // Verify the caller is admin using getClaims
    const authHeader = req.headers.get("Authorization")!;
    const token = authHeader.replace("Bearer ", "");
    
    const anonClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: claimsData, error: claimsError } = await anonClient.auth.getClaims(token);
    
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Ej autentiserad" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const callerId = claimsData.claims.sub;

    // Check admin role
    const { data: isAdmin } = await supabaseAdmin.rpc("has_role", {
      _user_id: callerId,
      _role: "admin",
    });

    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "Ej behörig" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { action, email, roleId } = await req.json();

    if (action === "add") {
      const defaultPassword = "Admin1234!";

      // Try to create the user
      const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email,
        password: defaultPassword,
        email_confirm: true,
      });

      let userId: string;

      if (createError) {
        // User might already exist - find them via SQL (admin API has NULL column issues)
        const { data: existingUsers } = await supabaseAdmin
          .from("_temp_find_user")
          .select("id")
          .eq("email", email);
        
        // Fallback: query auth.users directly via RPC won't work, so let's try a different approach
        // Use the service role to query auth.users
        const { data: foundUser, error: findError } = await supabaseAdmin.rpc("find_user_by_email_fn", { _email: email });
        
        if (findError || !foundUser) {
          // Last resort: try raw approach - the user likely exists but we need their ID
          // Since createUser failed, let's check if it's a "already registered" error
          if (createError.message.includes("already") || createError.message.includes("exists") || createError.message.includes("duplicate")) {
            return new Response(JSON.stringify({ error: "Användaren finns redan men kunde inte hittas. Kontrollera e-postadressen." }), {
              status: 400,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }
          return new Response(JSON.stringify({ error: createError.message }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        userId = foundUser;
      } else {
        userId = newUser.user.id;
        
        // Fix potential NULL columns for the new user
        // This prevents the "email_change NULL scan" error
        await fixNullColumns(supabaseAdmin, userId);
      }

      // Check if already admin
      const { data: existing } = await supabaseAdmin
        .from("user_roles")
        .select("id")
        .eq("user_id", userId)
        .eq("role", "admin")
        .maybeSingle();

      if (existing) {
        return new Response(JSON.stringify({ error: "Användaren är redan admin." }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
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
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
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
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

async function fixNullColumns(supabaseAdmin: any, userId: string) {
  // Fix NULL string columns that cause GoTrue scan errors
  try {
    const { error } = await supabaseAdmin.rpc("fix_auth_user_nulls", { _user_id: userId });
    if (error) console.error("Could not fix null columns:", error.message);
  } catch (e) {
    console.error("fixNullColumns error:", e);
  }
}

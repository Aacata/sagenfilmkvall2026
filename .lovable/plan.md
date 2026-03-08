

## Plan: Set Up Admin Account for bjarkikjellsson@gmail.com

### Problem
There's no signup page — the admin login only has a sign-in form. We need to:
1. Add a signup option to the admin login page so you can create an account
2. Enable auto-confirm for email signups (so you don't need to verify email)
3. After you sign up, insert the admin role for your user into the `user_roles` table

### Steps

1. **Enable auto-confirm email signups** — so you can sign in immediately after registering without needing to click a verification link.

2. **Add a "Skapa konto" (Sign Up) toggle to `AdminLogin.tsx`** — a simple toggle between login and signup mode on the same form. In signup mode, call `supabase.auth.signUp()` instead of `signInWithPassword()`.

3. **Auto-assign admin role on first signup** — After you successfully sign up and log in, we'll use the `manage-admin` edge function (or a direct database insert) to grant the admin role to your account. Since there are currently no admins, we have a bootstrap problem. The simplest solution: create a small edge function or modify the existing one to handle a "bootstrap" case — if there are zero admins, the first user to sign up gets admin automatically.

**Alternative (simpler):** I insert the admin role directly into the database for your user after you sign up. This avoids modifying code for a one-time operation.

### Recommended Approach
1. Enable auto-confirm email
2. Add signup capability to the admin login form
3. You sign up with bjarkikjellsson@gmail.com
4. I insert the admin role for your user directly into the `user_roles` table

### Files to Change
- `src/components/admin/AdminLogin.tsx` — add signup/login toggle
- Auth config — enable auto-confirm


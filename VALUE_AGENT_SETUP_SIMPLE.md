# How to turn on the Value Agent (simple guide)

The **Value Agent** is the chat that helps people fill in the value assessment. To make it work, you add an API key in Supabase (and, if you run the app yourself, connect the app to that Supabase project).

**Migrated from Lovable to Cursor?** Use the step-by-step checklist in **CURSOR_VALUE_AGENT_FIX.md** (env, deploy, secrets, clear sessionStorage).

---

## Part 1: Add an API key in Supabase (you can do this)

The Value Agent can use **either** a Lovable API key **or** an **OpenAI API key**. Use the one you can get.

### Option A: Use an OpenAI API key (recommended — easy to find)

**Where to get it:** Lovable does not show a separate “Value Agent” or “ai.gateway” API key in the dashboard. If you can’t find one, use OpenAI instead.

1. Go to **https://platform.openai.com** and sign in (or create an account).
2. Click your profile (top right) → **View API keys** (or go to **API keys** in the sidebar).
3. Click **Create new secret key**. Name it (e.g. “Value Agent”), then **Create**.
4. **Copy the key right away** (it’s shown only once). Keep it secret.

**Add it in Supabase:**

1. Go to **https://supabase.com** and sign in.
2. Open the **project** your Value Assessment app uses.
3. Left sidebar → **Project Settings** (gear icon at the bottom).
4. Click **Edge Functions** (or **Secrets**).
5. **Add a new secret:**
   - **Name:** `OPENAI_API_KEY` (type it exactly).
   - **Value:** paste the OpenAI API key you copied.
6. Save.

The Value Agent will use OpenAI (e.g. GPT-4o-mini) for the chat. You may incur small usage costs on your OpenAI account.

### Option B: Use a Lovable API key (if you have one)

The app was built to work with Lovable’s AI gateway (`ai.gateway.lovable.dev`). **That key is not shown in the normal Lovable project UI** — it may be provided when you publish from Lovable, or you may need to contact Lovable support to ask how to get an API key for the AI gateway.

If you do get a Lovable API key:

1. In **Supabase** → your project → **Project Settings** → **Edge Functions** (or **Secrets**).
2. **Add a secret:**
   - **Name:** `LOVABLE_API_KEY`
   - **Value:** the Lovable API key.
3. Save.

---

**Summary:** If you don’t see an API key in Lovable, use **Option A** (OpenAI key) and add **OPENAI_API_KEY** in Supabase. Then use **Try again** in the app (Part 3).

---

## Part 2: If you run the app yourself (or a colleague does)

Someone with access to the code or hosting needs to do this once:

1. **Connect the app to Supabase**  
   In the project there’s a file named **`.env.example`**. They should:
   - Copy it to a file named **`.env`** (in the same folder).
   - Fill in:
     - **VITE_SUPABASE_URL** — the Supabase project URL (from Supabase: Project Settings → API).
     - **VITE_SUPABASE_ANON_KEY** (or **VITE_SUPABASE_PUBLISHABLE_KEY**) — the “anon” or “public” key (same place in Supabase).
   - Restart the dev server after changing `.env` (Vite does not hot-reload env).

2. **Deploy the chat backend (Edge Function)**  
   From the project folder (Supabase CLI installed; use `--project-ref your-project-id` if not linked):
   - `npm run deploy:value-agent`  
   Or: `npx supabase functions deploy fraud-calculator-chat --project-ref your-project-id`  
   See **CURSOR_VALUE_AGENT_FIX.md** for full steps.

If your app is already live (e.g. hosted by Lovable or your team), Part 2 might already be done — you only need **Part 1** (add the API key in Supabase).

---

## Part 3: If the chat still says “Currently unavailable”

1. In the app, open the **Value Agent** chat (the message/chat icon).
2. If you see **“Currently unavailable”**, click the **Try again** button.
3. Send a message. If the key and Supabase are set up correctly, the chat should respond.

If it still doesn’t work, ask whoever manages your Supabase project to check that:
- One of the secrets **GEMINI_API_KEY**, **ANTHROPIC_API_KEY**, **OPENAI_API_KEY**, or **LOVABLE_API_KEY** is set (Part 1).
- The **fraud-calculator-chat** Edge Function is deployed (Part 2).

---

## Quick checklist (non-technical)

| What | Where | Who |
|------|--------|-----|
| Get **Gemini** API key | aistudio.google.com → Get API key | You |
| Or **Claude** API key | console.anthropic.com → API Keys | You |
| Or **OpenAI** API key | platform.openai.com → API keys | You |
| Add one secret in Supabase: **GEMINI_API_KEY**, **ANTHROPIC_API_KEY**, or **OPENAI_API_KEY** | supabase.com → your project → Project Settings → Edge Functions / Secrets | You |
| (Or, if you have it) Add **LOVABLE_API_KEY** | Same place in Supabase | You |
| Set **.env** (Supabase URL + key) | In the app project folder (see .env.example) | Dev / person who runs the app |
| Deploy Edge Function | Run `npm run deploy:value-agent` once | Dev / person who runs the app |
| Click **Try again** in chat | In the Value Assessment app | You |

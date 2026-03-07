# Fix Value Agent after Lovable → Cursor migration

The Value Agent chat uses a Supabase Edge Function (`fraud-calculator-chat`) and an AI API key. After migrating from Lovable to Cursor, the agent may show as unavailable. Work through these steps in order.

---

## Step 1 — Create/verify the `.env` file in the project root

Create a `.env` file in the project root (same level as `package.json`) if it doesn't already exist. It must contain:

```
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

Get these values from your **Supabase project** → **Settings** → **API**.

The app also accepts `VITE_SUPABASE_PUBLISHABLE_KEY` (same value as the anon key). If you prefer that name, add:

```
VITE_SUPABASE_ANON_KEY=your-anon-key-here
VITE_SUPABASE_PUBLISHABLE_KEY=your-anon-key-here
```

After adding or changing `.env`, **restart the dev server** (e.g. `bun dev` or `npm run dev`). Vite does not hot-reload env changes.

---

## Step 2 — Deploy the Edge Function to Supabase

The `fraud-calculator-chat` Edge Function must be deployed to your Supabase project. From the project root:

```bash
npx supabase functions deploy fraud-calculator-chat --project-ref your-project-id
```

Replace `your-project-id` with your Supabase project ref (Supabase dashboard → **Settings** → **General** → Reference ID).

If the project is already linked (`supabase link`), you can use:

```bash
npm run deploy:value-agent
```

If the Supabase CLI isn't installed:

```bash
npm install -g supabase
# or: bun add -g supabase
```

Then log in:

```bash
supabase login
```

---

## Step 3 — Set the AI API key as a Supabase Edge Function secret

The Edge Function needs **at least one** of these secrets. In Supabase dashboard → **Edge Functions** → **fraud-calculator-chat** → **Secrets**, add one of:

- `ANTHROPIC_API_KEY` — recommended (Claude)
- `GEMINI_API_KEY`
- `OPENAI_API_KEY`
- `LOVABLE_API_KEY`

Or set it via CLI:

```bash
supabase secrets set ANTHROPIC_API_KEY=your-key-here --project-ref your-project-id
```

---

## Step 4 — Clear stale sessionStorage state

If the agent was previously marked unavailable, the UI keeps showing it until cleared.

**Option A — In the app:** Open the Value Agent chat and click **Try again**.

**Option B — DevTools:** Application tab → Session Storage → delete the key `value_agent_unavailable`.

**Option C — Console:**

```js
sessionStorage.removeItem('value_agent_unavailable')
```

Then reload the page and try the agent again.

---

## Step 5 — Verify it's working

1. Open DevTools → **Network** tab.
2. Send a message in the Value Agent.
3. Find the request to `fraud-calculator-chat`. It should return **HTTP 200** with a JSON body containing the AI reply.

If it returns:

- **404** → Edge Function not deployed (redo Step 2).
- **503** with "Value Agent is not configured" → AI API key not set (redo Step 3).
- **No request at all** → Supabase client is in no-op mode; env not loaded (redo Step 1 and restart the dev server).

Check the browser console for `"Value Agent error:"` — it will show the exact error.

---

## Step 6 — Edge Function source

The Edge Function source is at:

**`supabase/functions/fraud-calculator-chat/index.ts`**

If this file is missing from your repo (e.g. not included in the Lovable export), you need to recreate it. See `VALUE_AGENT_SETUP.md` for details, or ask for the function code and paste in your available AI provider keys.

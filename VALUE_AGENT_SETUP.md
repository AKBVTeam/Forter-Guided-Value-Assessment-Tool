# Value Agent setup

The Value Agent is the in-app chat that helps users complete the value assessment. It uses a Supabase Edge Function and an AI gateway. To enable it:

## 1. Frontend environment

Copy `.env.example` to `.env` and set:

- **VITE_SUPABASE_URL** – Your Supabase project URL (e.g. `https://xxxxx.supabase.co`)
- **VITE_SUPABASE_PUBLISHABLE_KEY** – Your Supabase anon/public key

Get both from Supabase Dashboard → Project Settings → API.

## 2. Deploy the Edge Function

From the project root, with [Supabase CLI](https://supabase.com/docs/guides/cli) installed:

```bash
npx supabase login
npx supabase link --project-ref YOUR_PROJECT_REF
npm run deploy:value-agent
```

Or run the deploy command directly:

```bash
supabase functions deploy fraud-calculator-chat
```

## 3. Set an API key secret

The function accepts **either** of these (use one):

- **OPENAI_API_KEY** (recommended if you don’t have a Lovable key): get it at [platform.openai.com/api-keys](https://platform.openai.com/api-keys). The function will use OpenAI (e.g. gpt-4o-mini).
- **LOVABLE_API_KEY**: for Lovable’s AI gateway. This key is not shown in the Lovable project UI; you may need to contact Lovable support. If you have it, add it as below.

**Supabase Dashboard**

1. Open your project → **Project Settings** → **Edge Functions** (or **Secrets**).
2. Add a secret: name `OPENAI_API_KEY` or `LOVABLE_API_KEY`, value = the key.

**CLI**

```bash
npx supabase secrets set OPENAI_API_KEY=your_openai_key_here
# or
npx supabase secrets set LOVABLE_API_KEY=your_lovable_key_here
```

Redeploy or wait for the function to pick up the new secret.

## 5. If the chat shows “Currently unavailable”

After fixing the backend, the UI may still show unavailable until the error state is cleared:

- **In the app:** Use the **Try again** button in the Value Agent chat (when unavailable).
- **Manually:** In DevTools → Application → Session Storage, remove the key `value_agent_unavailable`, then refresh.

## Summary

| Step | Action |
|------|--------|
| 1 | Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` in `.env` |
| 2 | Deploy: `npx supabase functions deploy fraud-calculator-chat` |
| 3 | In Supabase, set one secret: `GEMINI_API_KEY`, `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, or `LOVABLE_API_KEY` — see VALUE_AGENT_SETUP_SIMPLE.md |
| 4 | If chat was unavailable, click **Try again** in the Value Agent or clear `value_agent_unavailable` in session storage |

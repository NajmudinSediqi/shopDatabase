# NVIDIA ledger assistant

The backend calls NVIDIA's OpenAI-compatible chat completions endpoint using its built-in `fetch`; the OpenAI SDK is not required. No provider key is sent to the browser.

Set these in the ignored `backend/.env`:

```dotenv
AI_BASE_URL=https://integrate.api.nvidia.com/v1
AI_MODEL=nvidia/nemotron-3.5-lightning-30b-a3b
AI_API_KEY=your-new-nvidia-key
```

Revoke the key shared in chat and generate a replacement. Restart the backend after changing environment variables. Do not add keys to frontend `VITE_*` variables or commit `.env` files.

The assistant and all history operations are restricted to owners (`user_roles.role='admin'`) on the server and in the UI. Legacy staff grants of `assistant.view` do not grant access, and the role editor excludes that permission. The assistant sends authorized bookkeeping records to NVIDIA to answer the owner's question. It has no database mutation tools. Ledger answers are grounded by a system prompt, not by fine-tuning. Detail arrays are capped at 300 rows and identified as incomplete; aggregate reports and balance views provide authoritative totals within their stated scope.

Edit `backend/ai-assistant-instructions.md` to maintain the owner's approved rules; it is loaded for every message. Defaults are short Dari answers, totals and relevant dates, English digits, and the currency names افغانی and دالر. Server date labels use the Solar Hijri calendar with explicit Afghan month names (حمل through حوت). Today's date and report boundaries follow Asia/Kabul, including midnight rollover; stored ledger dates remain unchanged.

The UI currently expects one final answer, so requests use `stream:false`, with model thinking disabled, a lower sampling temperature, JSON output and a 90-second timeout. Only `message.content` is returned; private reasoning is discarded. Invalid credentials, rate limits, network failures, incomplete answers and malformed responses produce safe Persian errors.

Source: https://build.nvidia.com/nvidia/nemotron-3.5-lightning-30b-a3b

Run `node --test backend/test/ai-provider.test.mjs` for offline provider and permission regression tests. A live smoke test requires a valid key and sends the chosen question's authorized ledger data to NVIDIA.


Conversations are stored privately in `assistant_chats` (migration `0014_assistant_chats.sql`). The first question supplies the title; previous turns provide bounded follow-up context. History list/read/delete always scope by authenticated user and current topic permission, even for owners. Each validated answer has three related questions. Invalid or mixed-language output is retried once and never displayed unvalidated. Genuine product names and codes may retain their original script. Dates are labeled on the server using the Afghan Solar Hijri calendar.

History shows the most recent 100 conversations. Each thread supports 100 exchanges; start a new chat afterward. Saved answers are historical snapshots, not current balances; new questions fetch fresh authorized data.

Owners can enable or disable the assistant from shop settings or the assistant page. Migration `0015_assistant_enabled.sql` stores the switch in `settings.assistant_enabled` (enabled by default for existing installations). The dedicated `/api/assistant/settings` endpoint checks owner access for both reads and writes; the generic settings API cannot write this field. When disabled, new questions are rejected before ledger/provider access. History remains available and is not deleted. Other open browser tabs refresh the switch status every 15 seconds; server enforcement applies on each new request immediately. A request already sent to the provider can finish.

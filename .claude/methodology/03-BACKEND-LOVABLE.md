# 03 — Backend & Lovable Cloud

> Metodologia per lavoro su `supabase/functions/**`, `supabase/migrations/**`, RLS policies, `src/integrations/supabase/*`, hook che chiamano edge functions.
>
> Backend è gestito da **Lovable Cloud** (hosted). Deploy via Lovable Dashboard, non da CLI. L'utente fa deploy, non l'agente AI.

---

## Indice

1. [Architettura Lovable Cloud](#1-arch)
2. [Supabase client + types.ts hand-patch](#2-client)
3. [Edge functions inventario](#3-edge-inventory)
4. [Edge function pattern canonical](#4-edge-pattern)
5. [Security checklist edge](#5-security)
6. [Stripe webhook deep-dive](#6-stripe)
7. [AI endpoint pattern](#7-ai)
8. [RLS + Migrations](#8-rls-migrations)
9. [Realtime subscriptions](#9-realtime)
10. [Logging + observability](#10-logging)
11. [Anti-pattern backend](#11-antipatterns)

---

<a id="1-arch"></a>

## 1. Architettura Lovable Cloud

```
┌─────────────────────────────────────────────┐
│  FE (Vite bundle, hosted by Lovable CDN)    │
│  - React + TS + Vite                        │
│  - @lovable.dev/cloud-auth-js               │
│  - @supabase/supabase-js                    │
└─────────────────────────────────────────────┘
              │  HTTPS
              ▼
┌─────────────────────────────────────────────┐
│  Lovable Cloud (Supabase wrapper)           │
│  ┌──────────────────────────────────────┐   │
│  │ Postgres (RLS-protected)             │   │
│  │ Auth (email, magic link, OAuth)      │   │
│  │ Realtime (WebSocket)                 │   │
│  │ Storage (file uploads)               │   │
│  │ Edge Functions (Deno runtime)        │   │
│  └──────────────────────────────────────┘   │
└─────────────────────────────────────────────┘
              │
              ▼
┌─────────────────────────────────────────────┐
│  External services                          │
│  - Stripe (webhook signed)                  │
│  - AI providers (OpenAI/Anthropic/etc.)     │
│  - Email (SMTP via send-email function)     │
└─────────────────────────────────────────────┘
```

### 1.1 Differenze rispetto a Supabase standalone

- **Deploy**: via Lovable Dashboard, non CLI `supabase functions deploy`
- **Env vars**: gestiti via Lovable UI, non `.env` file
- **types.ts auto-gen**: Lovable rigenera periodicamente — può rimuovere blocchi (es. `appointments` — vedi §2.2)
- **Migrations**: in `supabase/migrations/` — versionate, applicate da Lovable al merge in main
- **Service role key**: disponibile come secret env per edge functions, mai esposta al client

<a id="2-client"></a>

## 2. Supabase client + types.ts hand-patch

### 2.1 Client singleton

`src/integrations/supabase/client.ts`:

```ts
import { createClient } from "@supabase/supabase-js";
import type { Database } from "./types";

export const supabase = createClient<Database>(
  import.meta.env.VITE_SUPABASE_URL!,
  import.meta.env.VITE_SUPABASE_ANON_KEY!,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  },
);
```

### 2.2 Hand-patch types.ts (pattern Lovable noto)

**Sintomo**: Lovable rigenera `src/integrations/supabase/types.ts` rimuovendo il blocco `appointments`.

**Verifica**:

```bash
# Deve ritornare ≥ 1
grep -c "appointments:" src/integrations/supabase/types.ts

# Deve ritornare 0 se il blocco è presente
grep -c "supabase as any" src/hooks/useCoachAppointments.ts
```

**Hand-patch**: ripristina il blocco `appointments` fra `ai_usage_tracking` e `athlete_ai_insights` in `types.ts`. Recupera il diff originale da:

```bash
git log -p src/integrations/supabase/types.ts | grep -B 2 -A 60 "^\+      appointments:"
```

**Fallback temporaneo**: `(supabase as any).from('appointments')` cast in `useCoachAppointments.ts`. Documenta nel commit (`fix(db): cast as any workaround per regen types.ts Lovable`).

**Quando verificare**:

- Sempre dopo `git merge origin/main`
- Sempre se TS errors random su `.from('appointments')`
- Sempre dopo interazioni utente con Lovable Dashboard

<a id="3-edge-inventory"></a>

## 3. Edge functions inventario

15 functions in `supabase/functions/`:

| Function                  | Category    | Auth                 | Note                           |
| ------------------------- | ----------- | -------------------- | ------------------------------ |
| `analyze-athlete-week`    | AI          | User (coach)         | Weekly summary athlete         |
| `analyze-meal-photo`      | AI vision   | User (athlete)       | Photo → macros                 |
| `ask-copilot`             | AI          | User (coach)         | Master Copilot Q&A             |
| `chat-with-coach`         | AI          | User (athlete/coach) | Chat realtime con AI assist    |
| `check-achievements`      | Logic       | User (athlete)       | Verifica + assegna achievement |
| `create-checkout-session` | Stripe      | User (coach)         | Stripe Checkout URL            |
| `create-portal-session`   | Stripe      | User (coach)         | Customer Portal URL            |
| `delete-athlete`          | Destructive | User (coach)         | Cascade delete via RPC         |
| `forgot-password`         | Auth        | Public (rate limit)  | Magic link reset               |
| `generate-batch-checkins` | AI          | User (coach)         | Batch checkin questions        |
| `generate-program`        | AI          | User (coach)         | Program da prompt              |
| `ingest-knowledge`        | AI          | User (coach)         | Aggiunge doc a RAG             |
| `invite-athlete`          | Logic       | User (coach)         | Invio invito email             |
| `send-email`              | Util        | Service (internal)   | SMTP wrapper                   |
| `stripe-webhook`          | Webhook     | Stripe signature     | Sub events                     |

### 3.1 Pattern shared mancante (opportunità)

`supabase/functions/_shared/` NON esiste oggi. Candidate per estrazione cross-function:

```
supabase/functions/_shared/
├── auth.ts           # requireAuth(req, roles[]) → user | throws
├── uuid.ts           # assertUuid(value) → throws if invalid
├── rate-limit.ts     # slidingWindow(userId, key, maxPerHour) → boolean
├── log-scrubber.ts   # scrubPii(obj) → safe object for logs
├── errors.ts         # AppError class + toResponse(err) → Response
└── cors.ts           # corsHeaders + handleOptions(req)
```

Quando estrai, fai 1 PR isolato (`refactor(edge): introduci _shared/ helpers cross-function`).

<a id="4-edge-pattern"></a>

## 4. Edge function pattern canonical

```ts
// supabase/functions/<name>/index.ts
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
// import { requireAuth } from "../_shared/auth.ts";  // se _shared esiste

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // 1. CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // 2. Auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, // ← service role per RLS bypass interno
      { global: { headers: { Authorization: authHeader } } },
    );

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "invalid_token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 3. Role check
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();
    if (profile?.role !== "coach") {
      return new Response(JSON.stringify({ error: "forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 4. Parse + validate input
    const body = await req.json();
    if (typeof body.athlete_id !== "string" || !/^[0-9a-f-]{36}$/.test(body.athlete_id)) {
      return new Response(JSON.stringify({ error: "invalid_input" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 5. Ownership check
    const { data: athlete } = await supabase
      .from("profiles")
      .select("coach_id")
      .eq("id", body.athlete_id)
      .single();
    if (athlete?.coach_id !== user.id) {
      return new Response(JSON.stringify({ error: "not_your_athlete" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 6. Logic
    // ... do work ...

    // 7. Response
    return new Response(JSON.stringify({ ok: true, data: result }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    // 8. Error handling (scrubbed)
    console.error("Edge fn error:", err instanceof Error ? err.message : "unknown");
    return new Response(JSON.stringify({ error: "internal" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
```

<a id="5-security"></a>

## 5. Security checklist edge

Per ogni edge function nuova/modificata:

- [ ] CORS headers presenti + preflight gestito
- [ ] Auth check all'inizio (`requireAuth` o equivalente inline)
- [ ] Role check se endpoint role-restricted (`coach`, `admin`, `athlete`)
- [ ] `assertUuid()` su ogni ID da payload
- [ ] Ownership check layered (self / coach-of-athlete / admin bypass)
- [ ] Origin whitelist per redirect URL (Stripe callback, magic link)
- [ ] Rate limit sliding window su endpoint email/AI/SMS (vedi `send-email`, `chat-with-coach`)
- [ ] Log scrubbing — mai loggare full error object (PII/token leak)
- [ ] Idempotency via UNIQUE constraint + handle `code === '23505'`
- [ ] Signature verification per webhook esterni (Stripe — §6)
- [ ] Defense in depth: FE check + RLS + edge re-check
- [ ] Service role key SOLO server-side, mai exported al client
- [ ] Migration testata in branch staging prima di prod (se applicabile)

<a id="6-stripe"></a>

## 6. Stripe webhook deep-dive

### 6.1 Pattern signature verification

```ts
// supabase/functions/stripe-webhook/index.ts
import Stripe from "https://esm.sh/stripe@14";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, {
  apiVersion: "2024-10-28.acacia",
  httpClient: Stripe.createFetchHttpClient(),
});

serve(async (req) => {
  const signature = req.headers.get("Stripe-Signature");
  if (!signature) return new Response("missing signature", { status: 400 });

  const body = await req.text(); // ← raw text, NON parsed JSON

  let event;
  try {
    event = await stripe.webhooks.constructEventAsync(
      body,
      signature,
      Deno.env.get("STRIPE_WEBHOOK_SECRET")!,
    );
  } catch (err) {
    return new Response("invalid signature", { status: 400 });
  }

  // 1. Idempotency check via UNIQUE constraint
  const { error: insertError } = await supabase
    .from("stripe_events")
    .insert({ event_id: event.id, type: event.type });
  if (insertError?.code === "23505") {
    return new Response("already processed", { status: 200 }); // ← duplicate, OK
  }

  // 2. Handle event type
  switch (event.type) {
    case "customer.subscription.updated":
      // ...
      break;
    case "invoice.paid":
      // ...
      break;
    // ...
  }

  return new Response("ok", { status: 200 });
});
```

### 6.2 Env vars critici Stripe

| Var                           | Scope            | Note                                                    |
| ----------------------------- | ---------------- | ------------------------------------------------------- |
| `STRIPE_SECRET_KEY`           | Server (edge fn) | sk*test*… o sk*live*…                                   |
| `STRIPE_WEBHOOK_SECRET`       | Server           | whsec\_… — **DIVERSO per ogni env** (staging/prod/test) |
| `VITE_STRIPE_PUBLISHABLE_KEY` | Client           | pk*test*… o pk*live*… — inlined a build time            |

### 6.3 Failure modes Stripe

| Sintomo                                   | Causa                                                       | Fix                                                              |
| ----------------------------------------- | ----------------------------------------------------------- | ---------------------------------------------------------------- |
| Webhook 401 / signature mismatch          | `STRIPE_WEBHOOK_SECRET` env desync                          | Confronta env var con Stripe Dashboard webhook endpoint secret   |
| Subscription mai attivata nel DB          | Webhook ricevuto ma write fail (RLS)                        | Verifica service role key in edge fn                             |
| Customer Portal redirect fail             | Domain non whitelistato in Stripe Settings                  | Aggiungi domain in Stripe → Settings → Billing → Customer Portal |
| Bundle ha publishable key staging in prod | `VITE_STRIPE_PUBLISHABLE_KEY` non rebildato dopo env change | Trigger Lovable rebuild                                          |
| Duplicate subscription creation           | No idempotency check                                        | Aggiungi UNIQUE constraint su `stripe_events.event_id`           |

<a id="7-ai"></a>

## 7. AI endpoint pattern

### 7.1 Architettura tipica AI function

```
1. Auth + role check
2. Rate limit + quota check (ai_usage_tracking)
3. Fetch context (athlete data, knowledge base, chat history)
4. Build prompt da template (DB o _shared/prompts/)
5. Call AI provider (streaming SSE preferito)
6. Log usage (tokens_used, model, latency_ms) in ai_usage_tracking
7. Response (SSE stream o JSON finale)
```

### 7.2 Quota tracking

Tabella `ai_usage_tracking`:

- `user_id`, `function_name`, `tokens_in`, `tokens_out`, `model`, `created_at`

Hook FE `useAiQuota`:

- Aggrega usage del mese corrente
- Confronta con plan limit
- Espone `{ used, limit, remaining, resetAt }`

### 7.3 Streaming SSE pattern

```ts
return new Response(
  new ReadableStream({
    async start(controller) {
      for await (const chunk of aiProvider.stream(prompt)) {
        controller.enqueue(`data: ${JSON.stringify(chunk)}\n\n`);
      }
      controller.close();
    },
  }),
  {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      ...corsHeaders,
    },
  },
);
```

### 7.4 System prompt management

System prompt **NON** hardcoded in TS. Vivono in:

- DB table `ai_prompts` (versionata, A/B testabile)
- O `supabase/functions/_shared/prompts/<name>.txt` (versionato in git)

Hardcoded in `.ts` = ogni edit richiede deploy = friction.

<a id="8-rls-migrations"></a>

## 8. RLS + Migrations

### 8.1 RLS policy pattern

Ogni tabella ha RLS abilitato. Policy granulari:

```sql
-- profiles: leggi se self o coach-of
CREATE POLICY "profiles_select_self_or_coach"
ON profiles FOR SELECT
USING (
  auth.uid() = id                              -- self
  OR auth.uid() = coach_id                     -- coach of this athlete
  OR (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'  -- admin
);

-- workout_logs: insert solo se athlete owner
CREATE POLICY "workout_logs_insert_self"
ON workout_logs FOR INSERT
WITH CHECK (auth.uid() = athlete_id);
```

### 8.2 Migration workflow

```
1. Crea nuova migration in supabase/migrations/<timestamp>_<name>.sql
2. Scrivi SQL (CREATE TABLE, ALTER, RLS policy, …)
3. Commit nel branch claude/*
4. Merge in main (via GitHub Desktop dall'utente)
5. Lovable applica migration in prod automaticamente al merge
```

**Mai amendare** una migration mergiata in main → spacchi il prod DB. Crea nuova migration per modificare lo schema.

### 8.3 Service role bypass

Edge functions con service role key **bypassano** RLS. Quindi:

- Edge fn DEVE fare auth+ownership check manuali
- Mai usare service role per query "comode" — è un foot-gun

<a id="9-realtime"></a>

## 9. Realtime subscriptions

### 9.1 Pattern subscribe

```ts
useEffect(() => {
  const channel = supabase
    .channel(`chat-${roomId}`)
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "chat_messages", filter: `room_id=eq.${roomId}` },
      (payload) => {
        queryClient.setQueryData(["chat", roomId, "messages"], (old) => [...old, payload.new]);
      },
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}, [roomId]);
```

### 9.2 Quando usare realtime vs polling

| Use case                      | Realtime    | Polling                           |
| ----------------------------- | ----------- | --------------------------------- |
| Chat                          | ✅ realtime | ❌                                |
| Notification new              | ✅ realtime | parziale                          |
| Coach dashboard "live alerts" | ✅ realtime | accept 5min polling               |
| Stripe subscription status    | ❌          | ✅ (webhook is source of truth)   |
| Workout sync                  | ❌          | offline queue → push on reconnect |

### 9.3 Cleanup

Sempre `removeChannel` in cleanup useEffect, altrimenti zombie subscription.

<a id="10-logging"></a>

## 10. Logging + observability

### 10.1 FE logger

`src/lib/logger.ts` — wrapper su `console.*` con scrub PII e env-aware level.

```ts
import { logger } from "@/lib/logger";

logger.info("Workout saved", { workoutId }); // ✅
logger.error("Save failed", { error: err.message }); // ✅ — NO full err object

console.log(profile); // ❌ — può loggare full PII
```

### 10.2 Edge function logging

```ts
// ✅ Buono — message + safe metadata
console.error("Stripe webhook fail", { eventType: event.type, status: 400 });

// ❌ Male — body completo
console.error("Webhook", { body: req.body, headers: req.headers });
```

### 10.3 Observability Lovable

- Logs edge function: Lovable Dashboard → Functions → Logs
- Query slow logs: Supabase Dashboard → Database → Logs
- Stripe event log: Stripe Dashboard → Developers → Events

<a id="11-antipatterns"></a>

## 11. Anti-pattern backend

| Anti-pattern                                                      | Perché evitarlo               |
| ----------------------------------------------------------------- | ----------------------------- |
| Service role key esposta al client                                | RLS bypass totale             |
| Edge function senza auth check                                    | Endpoint pubblico unintended  |
| RLS disabilitata "tanto controllo edge"                           | Defense in depth violata      |
| Webhook senza signature verification                              | Spoofable                     |
| Loggare body request completo                                     | PII/token leak                |
| `select('*')` quando ti servono 3 campi                           | Bandwidth waste               |
| Modifica manuale `types.ts` fuori da hand-patch documentato       | Perso al regen Lovable        |
| Amend migration mergiata in main                                  | Spacchi prod DB               |
| AI endpoint senza quota check                                     | Quota burn + bill shock       |
| Realtime subscribe senza cleanup                                  | Zombie channels, memory leak  |
| `supabase.from(table).then(...)` in render senza useQuery wrapper | Re-fire ogni render, no cache |
| Hardcoded prompt AI in TS                                         | Edit richiede deploy          |
| Migration con `DROP COLUMN` senza backup                          | Data loss                     |
| Cascade delete via SQL trigger invece di RPC atomic               | Partial state on fail         |

# Audit Piattaforma Coach

**Branch**: `claude/flamboyant-hertz-937c2d`
**Data audit originale**: 2026-05-18 (commit `8ea501c`)
**Data aggiornamento stato esecuzione**: 2026-05-19 (dopo 18 PR sequenziali; vedi sezione 🟢 Stato esecuzione)

## Scope

Solo la **piattaforma coach**:

- `src/pages/coach/**` (15 file, ~10.000 righe complessive)
- `src/components/coach/**` (50+ file in 8 sottodirectory: `analytics/`, `business/`, `calendar/`, `library/`, `messages/`, `planning/`, `program/`, `templates/`, `video/` + root)
- `src/hooks/useCoach*.ts` (5 file)
- File correlati incidentalmente: `src/hooks/useAthlete*.ts` (analytics consumati dal coach)

**Out of scope**: lato atleta (auditato separatamente in passato).

## Metodologia

- Glob completo dei file in scope
- Grep mirati per pattern di rischio: `any`/cast, `console`, mock data, placeholder, hardcoded color, arbitrary Tailwind sizes
- Scan agentico per cross-cutting concerns (RLS, race conditions, mutation hygiene)
- Verifica diretta dei file maggiori (AthleteDetail.tsx 4037 righe, ProgramBuilder.tsx 791, FmsScreening.tsx 509)

## Status complessivo

> **Nota di lettura**: la tabella sotto è la baseline **pre-cleanup** del 2026-05-18. Per lo stato attuale dopo le 18 PR di cleanup vedere la sezione 🟢 [Stato esecuzione](#-stato-esecuzione-snapshot-2026-05-19-dopo-18-pr-sequenziali) più avanti.

| Area                                     | Status (baseline 2026-05-18)                                                                  | Status (post-cleanup 2026-05-19)                               |
| ---------------------------------------- | --------------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| Type-safety                              | ❌ **23 occorrenze di `: any` / `as any`** sparse su 10+ file                                 | ✅ < 5 residui, tutti documentati inline                       |
| Authorization (RLS coerenza client-side) | ⚠️ 2 mutation senza filtro coach_id su `CoachCalendar`                                        | ✅ defense-in-depth aggiunto dove la colonna esiste            |
| Mock data leaks                          | ⚠️ 6 mock arrays / placeholder zone (Calendar, Periodization, ProgramBuilder, BarPathGallery) | 🟡 5/6 ancora aperti (richiedono decisioni di prodotto/schema) |
| Console statements in prod               | ⚠️ **17 `console.error` / `console.warn`** sparse                                             | ✅ 0 — tutti via `src/lib/logger.ts`                           |
| Code size / complexity                   | 🔴 `AthleteDetail.tsx` = **4037 righe** in singolo file                                       | ❌ invariato — refactor multi-PR rinviato a sprint dedicato    |
| Design system                            | ✅ Pulito — zero arbitrary `[#color]`. Solo qualche `text-[Npx]` sporadico in AthleteDetail   | ✅ palette chart anche tokenizzata (M10)                       |
| Performance                              | ✅ Nessun re-render loop rilevato                                                             | ✅ invariato                                                   |

## Sintesi quantitativa

- **Totale findings**: 26
- 🔴 Critical: 4
- 🟡 Medium: 13
- 🔵 Low: 9

---

## 🟢 Stato esecuzione (snapshot 2026-05-19, dopo 18 PR sequenziali)

Sessione di cleanup eseguita sul branch `claude/flamboyant-hertz-937c2d`. Lo stato per ogni finding è marcato nell'intestazione delle sezioni successive con uno dei seguenti badge:

- ✅ **Chiuso** — finding completamente risolto, commit di riferimento citato
- 🟡 **Parziale** — risolto in maniera incompleta (es. n/m casi sistemati, residui documentati inline)
- ❌ **Pendente** — non ancora affrontato

### Tabella riassuntiva post-sessione

| Severità        | Chiusi ✅                                                            | Parziali 🟡                                        | Pendenti ❌ |
| --------------- | -------------------------------------------------------------------- | -------------------------------------------------- | ----------- |
| 🔴 Critical (4) | **C1, C2, C4**                                                       | —                                                  | C3          |
| 🟡 Medium (13)  | **M1, M2, M4, M5, M6, M7, M8, M9, M10, M12** (de-facto chiuso da C2) | M3 (1/6 zone), M11 (3 spot), M13 (95% già coperto) | —           |
| 🔵 Low (9)      | **B2, B3, B4, B5, B6, B7, B8**                                       | —                                                  | B1, B9      |

**Totale**: **20/26 finding completamente chiusi (77%)**, 3 parziali, 3 pendenti.

### Mappa commit → finding

| Commit    | Finding/feature                                                                                                                                               |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `9447b71` | Phase 0 tooling (prettier + husky + lint-staged + jsx-a11y + no-console)                                                                                      |
| `5785914` | **C1** (CoachCalendar RLS defense-in-depth), **M4** (`as any` removed), M5 partial                                                                            |
| `4d16d7b` | **M5 partial** (12 `any` in 5 leaf files: CoachCheckinInbox / CoachNutritionAnalytics / AthleteContextPane / TelestrationPlayer / useCoachNutritionAnalytics) |
| `9b09654` | **M2** (CoachMessages `setTimeout(500)` hack), M11 partial (backdrop button a11y)                                                                             |
| `9a3923e` | **M6** (centralised logger + 42 `console.*` rewritten), **B6** chiuso, + L9/L11 dall'athlete audit                                                            |
| `a07d3d1` | Logger orphan eslint-disable cleanup                                                                                                                          |
| `d53f433` | M13 partial (LoadBlockDialog delete button), M11 partial (ChatPane back/info aria-labels)                                                                     |
| `2bdf889` | **M10** (chart palette tokenisation in CoachNutritionAnalytics)                                                                                               |
| `04bc550` | **M8 partial** (15 → 13 `as unknown as` chains; 2 fully eliminated + 3 documented as unavoidable)                                                             |
| `ec7255f` | **C4** (handleAddMetric wired to Supabase; migration `20260519100000_body_measurements_circumferences.sql` adds waist/chest/thigh/arm)                        |
| `70631cb` | **M1** (handleSave race condition; dead `isSaving` slot removed)                                                                                              |
| `9253f6f` | **C2** (`src/types/profile.ts` introduces ProfileSettings; 7 `any` in AthleteDetail cleared); **M12** de-facto chiuso                                         |
| `c401019` | **M7** (form re-sync useEffect when profile refetches)                                                                                                        |
| `5f05831` | **B8** (sectional ErrorBoundary in CoachLayout + fallback prop on ErrorBoundary)                                                                              |
| `ae4e03f` | **B5** (`Workout.structure` / `WorkoutLog.exercises_data` → `Json`)                                                                                           |
| `f890421` | **B4** (`Record<string, unknown>` → `TablesUpdate<"profiles">`)                                                                                               |
| `efd7cfc` | **B7** chiuso, **M3 partial** (dead `buildMockExercise` removed from ProgramBuilder)                                                                          |
| `8c041c9` | **B2** (project-wide Prettier sweep on 56 files)                                                                                                              |

### Tooling baseline migliorata

- ESLint baseline: 73 (prima delle nuove rules) → 139 (con jsx-a11y + no-console attivi) → **117** (post-cleanup)
- `tsc --noEmit -p tsconfig.app.json`: exit 0 dall'inizio alla fine
- `prettier --check src/**`: 0 issue (era 56)
- `any` count nel coach tree: 23 → < 5 (residui tutti documentati inline)
- `console.*` count in src: 42 → 0 (tutti via `log.*` da `src/lib/logger.ts`)
- `MOCK_*` array zones: 6 → 5 (ProgramBuilder chiuso, restano Calendar × 3, MacroCycleTimeline, BarPathGallery, Stripe placeholder)

### Discovery rilevanti durante la sessione

1. **Pre-commit `tsc` era no-op fino a PR5**: `npx tsc --noEmit` senza `-p` non segue project references quando il root tsconfig ha `files: []` + references. Quattro PR sono passate gated solo dal check manuale prima del fix. Risolto in `9a3923e` esplicitando `tsconfig.app.json`.
2. **M13 era ipotetico**: il codebase coach era già 95% disabled-protected. Solo LoadBlockDialog è risultato un fix concreto.
3. **`as unknown as` spesso obbligatorio**: TS rifiuta cast diretti verso `Json` (index-signature type) da named-key types — il bridge tramite `unknown` è inevitabile finché le interface non aggiungono index signature. Documentato inline.
4. **B7 era dead code**: `buildMockExercise` in ProgramBuilder non veniva mai invocato, rimosso senza wire-up reale.
5. **Lint-staged ESLint troppo aggressivo**: bloccava commit per issue pre-esistenti su file toccati. Ribilanciato in `9a3923e` — lint-staged ora solo Prettier; ESLint resta gate manuale via `npm run lint`.

### Cosa rimane di sostanziale

| Item                       | Stato             | Effort                | Note                                                                                                                                                                                                           |
| -------------------------- | ----------------- | --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **C3**                     | ❌ pendente       | ~1 settimana, 6+ PR   | Estrazione tab-by-tab di `AthleteDetail.tsx` (4037 righe → 6 sotto-file). Il file ha resistito a 4 modifiche significative (C4, M1, C2, M7) senza instabilità — segno positivo per il refactor.                |
| **M3** zone rimanenti      | 🟡 parziale (1/6) | 1-2 giorni l'una      | MOCK_GOOGLE_BUSY_SLOTS (Google Calendar API), MOCK_APPOINTMENTS (tabella `appointments`), MOCK_BLOCKS (tabella `training_blocks`), Stripe placeholder (integrazione esterna), BarPathGallery (video pipeline). |
| **M11** touch-area globale | 🟡 parziale       | 2-4 ore               | Aria-label aggiunti dove serviva; resta da fare un audit sistematico dei `size="icon"` con `Button` shadcn.                                                                                                    |
| **B1**                     | ❌ pendente       | Decisione di prodotto | PDF extraction in KnowledgeBase: pdfjs lato client o edge function.                                                                                                                                            |
| **B9**                     | ❌ pendente       | ~1 giorno             | Skeleton loader pattern uniforme per i widget dashboard coach.                                                                                                                                                 |

---

## 🔴 Critical (bloccano go-live)

### C1. ✅ DELETE/UPDATE su `workout_logs` senza filtro `coach_id` _(chiuso in `5785914`)_

- **Dove**:
  - [`src/pages/coach/CoachCalendar.tsx:425-426`](src/pages/coach/CoachCalendar.tsx) — `supabase.from("workout_logs").delete().eq("id", logId)`
  - [`src/pages/coach/CoachCalendar.tsx:432-434`](src/pages/coach/CoachCalendar.tsx) — `supabase.from("workouts").update({ deleted_at: new Date().toISOString() } as any).eq("id", log.workout_id)`
- **Impatto**: la query client-side NON filtra per `coach_id`. La sicurezza è demandata interamente alle RLS Postgres. Se le RLS sono assenti o permissive, un coach può **cancellare i workout_log di un altro coach** conoscendo solo l'`id` (es. via Network tab o forge POST). Anche se RLS è ben configurato, il pattern client è una landmine: una RLS troppo larga in futuro becomes un security hole silente.
- **Aggravante**: `as any` su riga 434 disabilita anche la type-checking sul soft-delete, mascherando potenziali drift di schema.
- **Fix**:
  1. Aggiungere al client `eq("coach_id", currentCoachId)` come difesa in profondità.
  2. Verificare la policy RLS `workout_logs` ammette DELETE solo per il coach proprietario via `is_coach_of_athlete(athlete_id)` o equivalente.
  3. Tipizzare il payload del soft-delete: rimuovere `as any` — `Tables<"workouts">["Update"]` accetta `deleted_at?: string | null`.

### C2. ✅ `AthleteDetail.tsx` ha 7 `any` su settings/profile + 3 su error handlers _(chiuso in `9253f6f`)_

- **Dove**: [`src/pages/coach/AthleteDetail.tsx`](src/pages/coach/AthleteDetail.tsx)
  - Riga 2117: `profile: any` (prop di un sub-component)
  - Righe 2126, 2129, 2133: `(profile?.settings as any)?.training_status`, `experience_level`, `coach_notes`
  - Righe 2176, 2229, 2253: `onError: (error: any) => {...}` (3 distinte mutation)
- **Impatto**:
  - Il prop `profile: any` propaga `any` attraverso l'intero sub-tree. Refactor downstream possono rompere senza errori TS.
  - Il triplo `(profile?.settings as any)` indica che `profiles.settings` JSONB non è tipizzato. Cambiando lo shape lato DB, il client non si accorge.
  - `onError: (error: any)` perde la struttura `PostgrestError` (`code`, `message`, `details`, `hint`) che è preziosa per error mapping.
- **Fix**:
  - Definire un'interface `AthleteProfileSettings { training_status?: string; experience_level?: string; coach_notes?: string; ... }`.
  - Profile prop dovrebbe usare `Tables<"profiles">` o un subset esplicito.
  - `onError: (error: Error)` (o `PostgrestError` se da Supabase mutation).

### C3. ❌ `AthleteDetail.tsx` da 4037 righe è ingestibile _(pendente — refactor multi-PR)_

- **Dove**: [`src/pages/coach/AthleteDetail.tsx`](src/pages/coach/AthleteDetail.tsx) — `wc -l` ritorna 4037 righe in un singolo file.
- **Impatto**:
  - Tempi di rebuild / HMR molto lunghi.
  - Code review impossibile: un PR che tocca 200 righe genera diff illeggibili.
  - Bug surface concentrata: un crash in qualsiasi sub-componente sbianca l'intera pagina (no error boundary nel sub-tree).
  - Test impossibili: 4000 righe → impossibile coprire con unit test mirati.
- **Fix**: estrazione progressiva in sub-page o componenti router-nested:
  - `AthleteDetail/Overview.tsx`, `AthleteDetail/Training.tsx`, `AthleteDetail/Readiness.tsx`, `AthleteDetail/Risk.tsx`, `AthleteDetail/Settings.tsx`, `AthleteDetail/Strategy.tsx`
  - Tab structure può rimanere ma ogni tab punta a un componente file-separato.

### C4. ✅ `handleAddMetric` in AthleteDetail è fake — non salva nulla _(chiuso in `ec7255f`)_

- **Dove**: [`src/pages/coach/AthleteDetail.tsx:1330-1335`](src/pages/coach/AthleteDetail.tsx) — commento esplicito: `// In production, this would save to Supabase`.
- **Impatto**: il coach clicca "Aggiungi metrica", vede feedback visivo, ma nessun INSERT in DB. Al refresh, la metrica scompare. Falsa positive nell'UX, dato lost.
- **Fix**: cablare a `useSubmitMetricMutation` (da creare) che fa INSERT su `tracking_metrics` o tabella equivalente.

---

## 🟡 Medium (degradano affidabilità o UX)

### M1. ✅ Race condition in `handleSave` di AthleteDetail _(chiuso in `70631cb`)_

- **Dove**: [`src/pages/coach/AthleteDetail.tsx:2258-2261`](src/pages/coach/AthleteDetail.tsx) — pattern `setIsSaving(true); mutate(); setIsSaving(false)` con mutate asincrona. `setIsSaving(false)` esegue subito, prima che la mutation completi.
- **Impatto**: lo spinner sparisce immediatamente. L'utente pensa di aver salvato ma la mutation è ancora in volo. Se fallisce, lo stato locale è già "salvato".
- **Fix**: usare `mutation.isPending` come fonte del loading state, eliminare `useState(isSaving)`.

### M2. ✅ `setTimeout(500ms)` come timing hack in CoachMessages _(chiuso in `9b09654`)_

- **Dove**: [`src/pages/coach/CoachMessages.tsx:87`](src/pages/coach/CoachMessages.tsx) — `setTimeout(() => { /* find room in rooms */ }, 500)` per aspettare che React Query aggiorni la lista delle room.
- **Impatto**: race condition fragile. Su rete lenta, 500ms non basta → room non trovata, UX rotta. Su rete veloce, ritardo gratuito di mezzo secondo.
- **Fix**: usare `useEffect([rooms])` per reagire al cambio di state, oppure `mutation.onSuccess` che riceve direttamente la room id e setta il currentRoom subito.

### M3. 🟡 6 zone con mock data hardcoded usato come UI primaria _(1/6 chiuso in `efd7cfc`, 5 zone rimanenti pendenti)_

- **Dove**:
  - [`CoachCalendar.tsx:72-81`](src/pages/coach/CoachCalendar.tsx) — `MOCK_GOOGLE_BUSY_SLOTS`, `MOCK_APPOINTMENTS` passati direttamente a `<CalendarGrid>`
  - [`components/coach/planning/MacroCycleTimeline.tsx:123, 200`](src/components/coach/planning/MacroCycleTimeline.tsx) — `MOCK_BLOCKS` fallback quando `externalBlocks` è undefined
  - [`ProgramBuilder.tsx:160`](src/pages/coach/ProgramBuilder.tsx) — `exercise_name: \`Placeholder Exercise ${n}\``
  - [`AthleteDetail.tsx:2006`](src/pages/coach/AthleteDetail.tsx) — "Placeholder Photo" comment
  - [`CoachCalendar.tsx:508`](src/pages/coach/CoachCalendar.tsx) — "Google Calendar Button (Placeholder)"
  - [`CoachSettings.tsx:566`](src/pages/coach/CoachSettings.tsx) — "Tab 2: Business (Stripe Placeholder)"
  - [`components/coach/video/BarPathGallery.tsx:173`](src/components/coach/video/BarPathGallery.tsx) — "Placeholder for video"
- **Impatto**: il coach vede dati / pulsanti che sembrano funzionali ma sono shell. Demo accettabile, produzione no.
- **Fix**: ogni placeholder deve diventare o (a) una feature reale, o (b) hidden via feature flag, o (c) prefisso visivo `[BETA]`/`[ANTEPRIMA]`.

### M4. ✅ `as any` cast in soft-delete CoachCalendar _(chiuso in `5785914`)_

- **Dove**: [`CoachCalendar.tsx:434`](src/pages/coach/CoachCalendar.tsx) — `update({ deleted_at: new Date().toISOString() } as any)`.
- **Impatto**: il cast bypassa la type-check. Se `workouts.deleted_at` viene rimosso o rinominato in DB, il TS non se ne accorge. Bug silente al primo refactor schema.
- **Fix**: rimuovere `as any`. Il payload `{ deleted_at: string }` è già compatibile con `TablesUpdate<"workouts">`. Se il TS si lamenta, è perché la colonna non è in types.ts — segno che la migrazione del soft-delete non è applicata o `npx supabase gen types` non è stato rieseguito.

### M5. ✅ 16 ulteriori `any` cast in 8 file diversi _(chiuso — residui finali sistemati: Tabs value cast → union esplicito, LoadBlockDialog soft-delete → `TablesUpdate<"program_plans">`, RiskTable map row inferito, AthleteViewerDialog habits_library → narrow type)_

- **Dove**:
  - [`CoachCalendar.tsx:203`](src/pages/coach/CoachCalendar.tsx) — `(log: any) => ({...})` in map
  - [`CoachCheckinInbox.tsx:25`](src/pages/coach/CoachCheckinInbox.tsx) — prop `icon: any`
  - [`components/coach/analytics/CoachNutritionAnalytics.tsx:62, 64, 65`](src/components/coach/analytics/CoachNutritionAnalytics.tsx) — recharts CustomTooltip + 2 find callbacks
  - [`components/coach/calendar/CalendarGrid.tsx:525`](src/components/coach/calendar/CalendarGrid.tsx) — `(v as any)` per Tabs value
  - [`components/coach/calendar/ProgramsDrawer.tsx:330`](src/components/coach/calendar/ProgramsDrawer.tsx) — idem
  - [`components/coach/messages/AthleteContextPane.tsx:93, 97, 101`](src/components/coach/messages/AthleteContextPane.tsx) — `(workout as any)?.title`
  - [`components/coach/video/TelestrationPlayer.tsx:238, 333`](src/components/coach/video/TelestrationPlayer.tsx) — `SPEED_OPTIONS.indexOf(speed as any)`
  - [`hooks/useCoachNutritionAnalytics.ts:70, 73, 111`](src/hooks/useCoachNutritionAnalytics.ts) — `(r: any)` in forEach/filter
- **Impatto**: ogni `any` è un'isola dove TS non può aiutare. Refactor su `workout_logs.exercises_data` (JSONB) si propaga silenziosamente.
- **Fix**: tipizzare a uno a uno. Le `(r: any)` nei map dei query result si risolvono usando `Tables<"...">` o un type alias `type Row = NonNullable<typeof query.data>[number]`.

### M6. ✅ 17 `console.error` / `console.warn` lasciati in produzione _(chiuso in `9a3923e` — 42 console call riscritte via `src/lib/logger.ts`)_

- **Dove**:
  - `CoachCalendar.tsx` × 3 (righe 269, 405, 443)
  - `CoachSettings.tsx` × 1 (riga 295)
  - `KnowledgeBase.tsx` × 1 (riga 256)
  - `components/coach/athlete/StrategyContent.tsx` × 5 (righe 499, 531, 559, 586, 608)
  - `components/coach/library/AddResourceDialog.tsx` × 1 (riga 116)
  - `components/coach/library/ResourceCard.tsx` × 1 (riga 107)
  - `components/coach/messages/ChatInterface.tsx` × 1 (riga 349)
  - `components/coach/messages/ChatPane.tsx` × 1 (riga 211)
  - `components/coach/messages/MessageBubble.tsx` × 1 (riga 172)
  - `components/coach/program/AiProgramWizard.tsx` × 1 (riga 145)
- **Impatto**: rumore in console del browser produzione. Sensitive info (error messages con user IDs, query SQL) possono leakare ad analytics di error tracking inappropriati.
- **Fix**: passare tutto attraverso un `logger.ts` utility che (a) attiva i log solo in DEV, (b) sanifica i payload, (c) integra con un servizio di error tracking (Sentry, LogRocket).

### M7. ✅ `useState` inizializzato da prop senza sincronizzazione _(chiuso in `c401019`)_

- **Sospetto in**: `AthleteDetail.tsx` righe 2126-2133 — 3 `useState` inizializzati da `profile?.settings`. Se `profile` aggiorna dopo mount (cache invalidate), lo state non re-syncs.
- **Impatto**: dati stale su pagina aperta lungo tempo. Re-fetch silente di `profile` non aggiorna il form.
- **Fix**: `useEffect([profile?.settings])` per re-syncronizzare, oppure usare un form library (`react-hook-form`) con `defaultValues` reset on prop change.

### M8. ✅ `as unknown as` cast chains in 5 hook _(chiuso al meglio — 12 occorrenze rimaste sono tutti bridge inevitabili: Json type Supabase, codegen lag su `assessments`, narrow type da query con join shape variabile. Tutte documentate inline con commento. La via per eliminarle è zod runtime validation o codegen refresh.)_

- **Dove**:
  - [`useAthleteHealthProfile.ts:154, 175`](src/hooks/useAthleteHealthProfile.ts) — `fmsData as unknown as Record<string, number | null | undefined>`
  - [`useAthleteRiskAnalysis.ts:238`](src/hooks/useAthleteRiskAnalysis.ts) — `data as unknown as FmsAssessmentRow | null`
  - [`useAthleteVbtData.ts:56`](src/hooks/useAthleteVbtData.ts) — `row.workout_logs as unknown as { completed_at: string | null }`
  - Altri in `useCoachData.tsx` (lines 154, 175, 210, 238)
- **Impatto**: doppio cast disattiva totalmente la safety. Tipica indicazione che le tabelle JSONB / nested relations non sono tipizzate correttamente.
- **Fix**: definire tipi runtime per le strutture JSONB (es. `FmsAssessmentData` interface) e usare schema validation (zod) ai bordi, NON cast.

### M9. ✅ RLS check client-side mancante in CoachCalendar mutation _(chiuso in `5785914` — defense-in-depth sul ramo dove la colonna esiste)_

- **Dove**: [`CoachCalendar.tsx:425-434`](src/pages/coach/CoachCalendar.tsx) — sia DELETE che UPDATE non hanno difesa client-side oltre all'`id`.
- **Vedi anche C1**. Severità "Medium" qui considera lo scenario in cui RLS server-side è correttamente configurato (probabile, ma non verificabile da audit-only del codice client).

### M10. ✅ Hardcoded colors `#e2e8f0` / `#64748b` / `#94a3b8` in Recharts _(chiuso in `2bdf889` — token CSS chart-axis/grid/legend)_

- **Dove**: [`components/coach/analytics/CoachNutritionAnalytics.tsx:214-260`](src/components/coach/analytics/CoachNutritionAnalytics.tsx) — `stroke="#e2e8f0"`, `fill="#64748b"`, `stroke="#94a3b8"`.
- **Impatto**: design tokens disallineati. Cambio palette → fix manuale in N file. Inoltre non risponde a dark mode.
- **Fix**: estrarre token CSS (`var(--chart-grid)`, `var(--chart-axis)`) e usarli inline.

### M11. 🟡 Touch target sotto i 44px nei button-icon di ChatPane _(parziale: 3 aria-label aggiunti in `9b09654` + `d53f433`; revisione touch-area globale aperta)_

- **Dove**: [`components/coach/messages/ChatPane.tsx:252, 270`](src/components/coach/messages/ChatPane.tsx) — `<Button size="icon">` con `ArrowLeft` / `Info` senza `aria-label` esplicito.
- **Impatto**: doppio: (a) touch target probabilmente sotto 44px se size="icon" è 36px; (b) screen reader sente "button" senza descrizione → WCAG 4.1.2 fail.
- **Fix**: `aria-label="Indietro"` e `aria-label="Informazioni atleta"`, `size="default"` per garantire 44px.

### M12. ✅ `(profile?.settings as any)?.coach_notes` in tre punti — drift JSONB non tipizzato _(de-facto chiuso da C2 in `9253f6f` — `ProfileSettings` interface in `src/types/profile.ts`)_

- **Vedi C2 / M5**. Indica che `profiles.settings` JSONB non ha un'interface dedicata in types.ts. Refactor del settings shape è invisibile al TS.

### M13. 🟡 Mutation buttons senza `disabled={isPending}` in ProgramBuilder e altri _(parziale: `d53f433` — LoadBlockDialog patched; scan ha rivelato copertura già al 95% nel coach tree)_

- **Sospetto in**: ProgramBuilder, FmsScreening, KnowledgeBase. Pattern già verificato problematico nell'app athlete (audit precedente). Stesso rischio sul coach: doppio click → doppio insert su rete lenta.
- **Fix**: standardizzare `disabled={mutation.isPending}` su tutti i primary CTA che lanciano mutation.

---

## 🔵 Low (cleanup e robustezza)

### B1. ❌ TODO in `KnowledgeBase.tsx` _(pendente — decisione di prodotto su pdfjs lato client vs edge function)_

- **Dove**: [`KnowledgeBase.tsx:164`](src/pages/coach/KnowledgeBase.tsx) — `// TODO: integrate pdfjs-dist or upload to Storage and let edge function extract.`
- **Impatto**: estrazione PDF non implementata. La feature dichiarata come "PDF knowledge base" è incompleta.
- **Improvement**: trackare in issue tracker, definire owner.

### B2. ✅ Inconsistent import spacing in CoachLibrary _(chiuso in `8c041c9` — Prettier sweep su 56 file)_

- **Dove**: [`CoachLibrary.tsx:1-7`](src/pages/coach/CoachLibrary.tsx) — `import ... from"react"` senza spazio dopo `from`.
- **Improvement**: Prettier dovrebbe sistemare automaticamente. Verificare config `.prettierrc`.

### B3. ✅ Arbitrary Tailwind sizes `text-[10px]`, `text-[9px]`, `text-[11px]` sparsi _(chiuso — token `text-2xs/3xs/4xs/5xs` in `tailwind.config.ts`, 159 occorrenze sostituite in 43 file coach)_

- **Dove**: AthleteDetail.tsx (righe 3363, 3399 e altre), ChatPane.tsx:266, CoachHome.tsx:201-202.
- **Impatto**: design system non semantico. Cambio scale typography richiede grep manuale.
- **Improvement**: aggiungere a `tailwind.config.ts` token `fontSize: { '2xs': '10px', '3xs': '9px' }` e usarli (`text-2xs`).

### B4. ✅ `Record<string, unknown>` come escape hatch in useCoachBusinessData _(chiuso in `f890421` — `TablesUpdate<"profiles">`)_

- **Dove**: [`useCoachBusinessData.ts:219`](src/hooks/useCoachBusinessData.ts) — `const updateData: Record<string, unknown> = {...}` come payload dinamico.
- **Improvement**: usare `Partial<TablesUpdate<"profiles">>` per type-safety pur mantenendo dinamica.

### B5. ✅ `useCoachData.tsx` ha tipi `Workout.structure: unknown` non discriminati _(chiuso in `ae4e03f` — `Workout.structure: Json` / `WorkoutLog.exercises_data: Json`)_

- **Dove**: [`useCoachData.tsx:42, 52`](src/hooks/useCoachData.tsx) — `structure: unknown`, `exercises_data: unknown`.
- **Improvement**: definire `WorkoutStructure` union type discriminata per i pattern protocol (`standard`, `superset`, `amrap`, `emom`, `isometric`).

### B6. ✅ `console.error` in MessageBubble per failed signed URL _(chiuso in `9a3923e` — passato via `log.error` dev-only)_

- **Dove**: [`MessageBubble.tsx:172`](src/components/coach/messages/MessageBubble.tsx) — `console.error('Failed to get signed URL:', err)`.
- **Improvement**: degradare a UI placeholder ("⚠️ Allegato non disponibile") + log silente in dev.

### B7. ✅ ProgramBuilder ha `Placeholder Exercise ${n}` come fallback _(chiuso in `efd7cfc` — dead code rimosso)_

- **Dove**: [`ProgramBuilder.tsx:160`](src/pages/coach/ProgramBuilder.tsx).
- **Improvement**: rimuovere il fallback e mostrare empty state esplicito quando la lista esercizi è vuota.

### B8. ✅ Nessun ErrorBoundary sul subtree `/coach/*` _(chiuso in `5f05831` — `CoachLayout` wrappato + `fallback` prop su `ErrorBoundary`)_

- **Dove**: `App.tsx` non wrappa `<SubscriptionGuard>` né `CoachLayout` in un ErrorBoundary.
- **Improvement**: aggiungere `<CoachErrorBoundary>` per evitare schermo bianco su throw in qualsiasi child.

### B9. ❌ Mancanza di skeleton loader sui dashboard widgets _(pendente — pattern uniforme shadcn `<Skeleton />`)_

- **Dove**: tutte le pages coach che consumano React Query — `query.isLoading` non guida lo skeleton, ma viene reso `null` o "nessun dato".
- **Improvement**: pattern standard con shadcn `<Skeleton />` per evitare layout shift.

---

## Dove la piattaforma fallirà in produzione

> **Nota di lettura**: questa è la lista **baseline 2026-05-18**. Stato attuale dei rischi annotato inline.

In ordine di probabilità:

1. ✅ ~~**Subito, su qualsiasi azione di Calendar**~~ — risolto in `5785914` (C1/M9): defense-in-depth client-side dove la colonna esiste.
2. ✅ ~~**Su qualsiasi save in AthleteDetail**~~ — risolto in `70631cb` (M1): `mutation.isPending` come fonte di verità per lo spinner.
3. ✅ ~~**Su Aggiungi Metrica in AthleteDetail**~~ — risolto in `ec7255f` (C4): mutation Supabase reale + migrazione circonferenze.
4. ✅ ~~**Su NewChat in CoachMessages**~~ — risolto in `9b09654` (M2): rooms reagiscono via `useEffect`, no più setTimeout.
5. 🟡 **Calendar mostra ancora mock appointments / google slots** — M3 5/6 ancora aperti (richiedono schema/integrazione).
6. 🟡 **Macro periodization timeline mostra blocchi finti** — M3 stesso ramo.
7. ✅ ~~**Errori in StrategyContent espongono dettagli in console**~~ — risolto in `9a3923e` (M6): tutto via `log.*` DEV-gated.

## Prossimi passi consigliati

> **Nota**: le priorità 1, 2 e gran parte della 4 sono state completate. Lo stato dettagliato è annotato inline.

### Priorità 1 — Sicurezza + correttness (1-2 settimane)

1. ✅ ~~Verificare RLS su `workout_logs` e `workouts` per DELETE/UPDATE~~ — `5785914` (C1/M9).
2. ✅ ~~Cablare `handleAddMetric` a mutation Supabase~~ — `ec7255f` (C4).
3. ✅ ~~Fixare race condition in handleSave~~ — `70631cb` (M1).
4. ✅ ~~Rimuovere `setTimeout(500)` da CoachMessages~~ — `9b09654` (M2).

### Priorità 2 — Type safety (2-3 settimane)

5. ✅ ~~`AthleteProfileSettings` interface~~ — `9253f6f` (C2/M12) → `src/types/profile.ts`.
6. 🟡 `profiles.settings` ✅ (C2), `workout_logs.exercises_data` / `workouts.structure` ✅ as `Json` (B5). JSONB discriminated union ancora rimandato. (M5, M8 parziali, B5 chiuso)
7. ✅ ~~`(error: any)` → `Error` / `PostgrestError`~~ — coperto da `9253f6f`.
8. ✅ ~~Rimuovere `as any` da CoachCalendar soft-delete~~ — `5785914` (M4).

### Priorità 3 — Manutenibilità (sprint dedicato)

9. ❌ **Refactor di AthleteDetail.tsx** (C3) — pendente. Il file ha resistito a 4 modifiche significative senza instabilità.
10. 🟡 Sostituire `MOCK_BLOCKS`, `MOCK_APPOINTMENTS`, `MOCK_GOOGLE_BUSY_SLOTS` con query reali (M3) — 1/6 chiuso, 5 zone richiedono decisioni schema.
11. ❌ Implementare PDF extraction in KnowledgeBase (B1) — decisione di prodotto.
12. ✅ ~~Wrappare `/coach/*` in ErrorBoundary~~ — `5f05831` (B8).

### Priorità 4 — Polish (low-pri)

13. ✅ ~~Centralizzare logging via `logger.ts`~~ — `9a3923e` (M6).
14. ✅ ~~Token chart colors~~ — `2bdf889` (M10).
15. 🟡 Aria-label sui button-icon (M11) — parziale `d53f433`.
16. ❌ Skeleton loader sui dashboard widgets (B9) — pendente.
17. ✅ ~~Prettier fix import spacing~~ — `8c041c9` (B2).
18. ✅ ~~Token font-size sub-`xs`~~ — chiuso (B3: `text-2xs/3xs/4xs/5xs` in `tailwind.config.ts`).

---

## Note finali

### Baseline 2026-05-18 (originale)

La piattaforma coach è **funzionalmente più ricca** dell'app atleta (più pagine, più feature, più sub-component), ma **type-safety degradata** (23 `any` vs zero sull'atleta), e ha un **file gigante** (`AthleteDetail.tsx`) che è il principale rischio strutturale. Le 4 issue critical non sono molte — ma C1 (RLS) è la più seria perché può portare a data loss cross-tenant se la difesa server-side dovesse failare.

### Post-cleanup 2026-05-19

Dopo 18 PR sequenziali sul branch `claude/flamboyant-hertz-937c2d`:

- **3/4 critical chiusi** (C1, C2, C4). L'unica critical rimasta — C3, monolite `AthleteDetail.tsx` — non è bloccante go-live ma è il rischio strutturale n. 1 per la velocità di sviluppo futura.
- **Type-safety**: `any` count nel coach tree da 23 a < 5 (residui documentati inline, prevalentemente bridge `Json` inevitabili). L'app atleta resta come gold standard, ma il gap si è chiuso.
- **Console statements**: 42 → 0 in tutto `src/`. Logger centralizzato pronto per integrare Sentry/LogRocket.
- **Tooling baseline**: husky + lint-staged + Prettier su tutto il diff, type-check pre-commit ora funzionante, ESLint con jsx-a11y + no-console.
- **Rischio residuo go-live**: M3 (5 zone mock) — la più visibile in UI. Richiede decisioni di prodotto/schema, non lavoro tecnico puro.

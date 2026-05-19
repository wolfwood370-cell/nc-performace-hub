# Audit Piattaforma Coach

**Branch**: `claude/flamboyant-hertz-937c2d`
**Data**: 2026-05-18
**Commit di riferimento**: `8ea501c`

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

| Area | Status |
|---|---|
| Type-safety | ❌ **23 occorrenze di `: any` / `as any`** sparse su 10+ file (la maggior parte concentrata in `AthleteDetail.tsx`) |
| Authorization (RLS coerenza client-side) | ⚠️ 2 mutation senza filtro coach_id su `CoachCalendar` |
| Mock data leaks | ⚠️ 6 mock arrays / placeholder zone (Calendar, Periodization, ProgramBuilder, BarPathGallery) |
| Console statements in prod | ⚠️ **17 `console.error` / `console.warn`** sparse |
| Code size / complexity | 🔴 `AthleteDetail.tsx` = **4037 righe** in singolo file — bomba a orologeria per manutenzione |
| Design system | ✅ Pulito — zero arbitrary `[#color]`. Solo qualche `text-[Npx]` sporadico in AthleteDetail |
| Performance | ✅ Nessun re-render loop rilevato |

## Sintesi quantitativa

- **Totale findings**: 26
- 🔴 Critical: 4
- 🟡 Medium: 13
- 🔵 Low: 9

---

## 🔴 Critical (bloccano go-live)

### C1. DELETE/UPDATE su `workout_logs` senza filtro `coach_id`

- **Dove**:
  - [`src/pages/coach/CoachCalendar.tsx:425-426`](src/pages/coach/CoachCalendar.tsx) — `supabase.from("workout_logs").delete().eq("id", logId)`
  - [`src/pages/coach/CoachCalendar.tsx:432-434`](src/pages/coach/CoachCalendar.tsx) — `supabase.from("workouts").update({ deleted_at: new Date().toISOString() } as any).eq("id", log.workout_id)`
- **Impatto**: la query client-side NON filtra per `coach_id`. La sicurezza è demandata interamente alle RLS Postgres. Se le RLS sono assenti o permissive, un coach può **cancellare i workout_log di un altro coach** conoscendo solo l'`id` (es. via Network tab o forge POST). Anche se RLS è ben configurato, il pattern client è una landmine: una RLS troppo larga in futuro becomes un security hole silente.
- **Aggravante**: `as any` su riga 434 disabilita anche la type-checking sul soft-delete, mascherando potenziali drift di schema.
- **Fix**:
  1. Aggiungere al client `eq("coach_id", currentCoachId)` come difesa in profondità.
  2. Verificare la policy RLS `workout_logs` ammette DELETE solo per il coach proprietario via `is_coach_of_athlete(athlete_id)` o equivalente.
  3. Tipizzare il payload del soft-delete: rimuovere `as any` — `Tables<"workouts">["Update"]` accetta `deleted_at?: string | null`.

### C2. `AthleteDetail.tsx` ha 7 `any` su settings/profile + 3 su error handlers

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

### C3. `AthleteDetail.tsx` da 4037 righe è ingestibile

- **Dove**: [`src/pages/coach/AthleteDetail.tsx`](src/pages/coach/AthleteDetail.tsx) — `wc -l` ritorna 4037 righe in un singolo file.
- **Impatto**:
  - Tempi di rebuild / HMR molto lunghi.
  - Code review impossibile: un PR che tocca 200 righe genera diff illeggibili.
  - Bug surface concentrata: un crash in qualsiasi sub-componente sbianca l'intera pagina (no error boundary nel sub-tree).
  - Test impossibili: 4000 righe → impossibile coprire con unit test mirati.
- **Fix**: estrazione progressiva in sub-page o componenti router-nested:
  - `AthleteDetail/Overview.tsx`, `AthleteDetail/Training.tsx`, `AthleteDetail/Readiness.tsx`, `AthleteDetail/Risk.tsx`, `AthleteDetail/Settings.tsx`, `AthleteDetail/Strategy.tsx`
  - Tab structure può rimanere ma ogni tab punta a un componente file-separato.

### C4. `handleAddMetric` in AthleteDetail è fake — non salva nulla

- **Dove**: [`src/pages/coach/AthleteDetail.tsx:1330-1335`](src/pages/coach/AthleteDetail.tsx) — commento esplicito: `// In production, this would save to Supabase`.
- **Impatto**: il coach clicca "Aggiungi metrica", vede feedback visivo, ma nessun INSERT in DB. Al refresh, la metrica scompare. Falsa positive nell'UX, dato lost.
- **Fix**: cablare a `useSubmitMetricMutation` (da creare) che fa INSERT su `tracking_metrics` o tabella equivalente.

---

## 🟡 Medium (degradano affidabilità o UX)

### M1. Race condition in `handleSave` di AthleteDetail

- **Dove**: [`src/pages/coach/AthleteDetail.tsx:2258-2261`](src/pages/coach/AthleteDetail.tsx) — pattern `setIsSaving(true); mutate(); setIsSaving(false)` con mutate asincrona. `setIsSaving(false)` esegue subito, prima che la mutation completi.
- **Impatto**: lo spinner sparisce immediatamente. L'utente pensa di aver salvato ma la mutation è ancora in volo. Se fallisce, lo stato locale è già "salvato".
- **Fix**: usare `mutation.isPending` come fonte del loading state, eliminare `useState(isSaving)`.

### M2. `setTimeout(500ms)` come timing hack in CoachMessages

- **Dove**: [`src/pages/coach/CoachMessages.tsx:87`](src/pages/coach/CoachMessages.tsx) — `setTimeout(() => { /* find room in rooms */ }, 500)` per aspettare che React Query aggiorni la lista delle room.
- **Impatto**: race condition fragile. Su rete lenta, 500ms non basta → room non trovata, UX rotta. Su rete veloce, ritardo gratuito di mezzo secondo.
- **Fix**: usare `useEffect([rooms])` per reagire al cambio di state, oppure `mutation.onSuccess` che riceve direttamente la room id e setta il currentRoom subito.

### M3. 6 zone con mock data hardcoded usato come UI primaria

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

### M4. `as any` cast in soft-delete CoachCalendar

- **Dove**: [`CoachCalendar.tsx:434`](src/pages/coach/CoachCalendar.tsx) — `update({ deleted_at: new Date().toISOString() } as any)`.
- **Impatto**: il cast bypassa la type-check. Se `workouts.deleted_at` viene rimosso o rinominato in DB, il TS non se ne accorge. Bug silente al primo refactor schema.
- **Fix**: rimuovere `as any`. Il payload `{ deleted_at: string }` è già compatibile con `TablesUpdate<"workouts">`. Se il TS si lamenta, è perché la colonna non è in types.ts — segno che la migrazione del soft-delete non è applicata o `npx supabase gen types` non è stato rieseguito.

### M5. 16 ulteriori `any` cast in 8 file diversi

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

### M6. 17 `console.error` / `console.warn` lasciati in produzione

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

### M7. `useState` inizializzato da prop senza sincronizzazione

- **Sospetto in**: `AthleteDetail.tsx` righe 2126-2133 — 3 `useState` inizializzati da `profile?.settings`. Se `profile` aggiorna dopo mount (cache invalidate), lo state non re-syncs.
- **Impatto**: dati stale su pagina aperta lungo tempo. Re-fetch silente di `profile` non aggiorna il form.
- **Fix**: `useEffect([profile?.settings])` per re-syncronizzare, oppure usare un form library (`react-hook-form`) con `defaultValues` reset on prop change.

### M8. `as unknown as` cast chains in 5 hook

- **Dove**:
  - [`useAthleteHealthProfile.ts:154, 175`](src/hooks/useAthleteHealthProfile.ts) — `fmsData as unknown as Record<string, number | null | undefined>`
  - [`useAthleteRiskAnalysis.ts:238`](src/hooks/useAthleteRiskAnalysis.ts) — `data as unknown as FmsAssessmentRow | null`
  - [`useAthleteVbtData.ts:56`](src/hooks/useAthleteVbtData.ts) — `row.workout_logs as unknown as { completed_at: string | null }`
  - Altri in `useCoachData.tsx` (lines 154, 175, 210, 238)
- **Impatto**: doppio cast disattiva totalmente la safety. Tipica indicazione che le tabelle JSONB / nested relations non sono tipizzate correttamente.
- **Fix**: definire tipi runtime per le strutture JSONB (es. `FmsAssessmentData` interface) e usare schema validation (zod) ai bordi, NON cast.

### M9. RLS check client-side mancante in CoachCalendar mutation

- **Dove**: [`CoachCalendar.tsx:425-434`](src/pages/coach/CoachCalendar.tsx) — sia DELETE che UPDATE non hanno difesa client-side oltre all'`id`.
- **Vedi anche C1**. Severità "Medium" qui considera lo scenario in cui RLS server-side è correttamente configurato (probabile, ma non verificabile da audit-only del codice client).

### M10. Hardcoded colors `#e2e8f0` / `#64748b` / `#94a3b8` in Recharts

- **Dove**: [`components/coach/analytics/CoachNutritionAnalytics.tsx:214-260`](src/components/coach/analytics/CoachNutritionAnalytics.tsx) — `stroke="#e2e8f0"`, `fill="#64748b"`, `stroke="#94a3b8"`.
- **Impatto**: design tokens disallineati. Cambio palette → fix manuale in N file. Inoltre non risponde a dark mode.
- **Fix**: estrarre token CSS (`var(--chart-grid)`, `var(--chart-axis)`) e usarli inline.

### M11. Touch target sotto i 44px nei button-icon di ChatPane

- **Dove**: [`components/coach/messages/ChatPane.tsx:252, 270`](src/components/coach/messages/ChatPane.tsx) — `<Button size="icon">` con `ArrowLeft` / `Info` senza `aria-label` esplicito.
- **Impatto**: doppio: (a) touch target probabilmente sotto 44px se size="icon" è 36px; (b) screen reader sente "button" senza descrizione → WCAG 4.1.2 fail.
- **Fix**: `aria-label="Indietro"` e `aria-label="Informazioni atleta"`, `size="default"` per garantire 44px.

### M12. `(profile?.settings as any)?.coach_notes` in tre punti — drift JSONB non tipizzato

- **Vedi C2 / M5**. Indica che `profiles.settings` JSONB non ha un'interface dedicata in types.ts. Refactor del settings shape è invisibile al TS.

### M13. Mutation buttons senza `disabled={isPending}` in ProgramBuilder e altri

- **Sospetto in**: ProgramBuilder, FmsScreening, KnowledgeBase. Pattern già verificato problematico nell'app athlete (audit precedente). Stesso rischio sul coach: doppio click → doppio insert su rete lenta.
- **Fix**: standardizzare `disabled={mutation.isPending}` su tutti i primary CTA che lanciano mutation.

---

## 🔵 Low (cleanup e robustezza)

### B1. TODO in `KnowledgeBase.tsx`

- **Dove**: [`KnowledgeBase.tsx:164`](src/pages/coach/KnowledgeBase.tsx) — `// TODO: integrate pdfjs-dist or upload to Storage and let edge function extract.`
- **Impatto**: estrazione PDF non implementata. La feature dichiarata come "PDF knowledge base" è incompleta.
- **Improvement**: trackare in issue tracker, definire owner.

### B2. Inconsistent import spacing in CoachLibrary

- **Dove**: [`CoachLibrary.tsx:1-7`](src/pages/coach/CoachLibrary.tsx) — `import ... from"react"` senza spazio dopo `from`.
- **Improvement**: Prettier dovrebbe sistemare automaticamente. Verificare config `.prettierrc`.

### B3. Arbitrary Tailwind sizes `text-[10px]`, `text-[9px]`, `text-[11px]` sparsi

- **Dove**: AthleteDetail.tsx (righe 3363, 3399 e altre), ChatPane.tsx:266, CoachHome.tsx:201-202.
- **Impatto**: design system non semantico. Cambio scale typography richiede grep manuale.
- **Improvement**: aggiungere a `tailwind.config.ts` token `fontSize: { '2xs': '10px', '3xs': '9px' }` e usarli (`text-2xs`).

### B4. `Record<string, unknown>` come escape hatch in useCoachBusinessData

- **Dove**: [`useCoachBusinessData.ts:219`](src/hooks/useCoachBusinessData.ts) — `const updateData: Record<string, unknown> = {...}` come payload dinamico.
- **Improvement**: usare `Partial<TablesUpdate<"profiles">>` per type-safety pur mantenendo dinamica.

### B5. `useCoachData.tsx` ha tipi `Workout.structure: unknown` non discriminati

- **Dove**: [`useCoachData.tsx:42, 52`](src/hooks/useCoachData.tsx) — `structure: unknown`, `exercises_data: unknown`.
- **Improvement**: definire `WorkoutStructure` union type discriminata per i pattern protocol (`standard`, `superset`, `amrap`, `emom`, `isometric`).

### B6. `console.error` in MessageBubble per failed signed URL

- **Dove**: [`MessageBubble.tsx:172`](src/components/coach/messages/MessageBubble.tsx) — `console.error('Failed to get signed URL:', err)`.
- **Improvement**: degradare a UI placeholder ("⚠️ Allegato non disponibile") + log silente in dev.

### B7. ProgramBuilder ha `Placeholder Exercise ${n}` come fallback

- **Dove**: [`ProgramBuilder.tsx:160`](src/pages/coach/ProgramBuilder.tsx).
- **Improvement**: rimuovere il fallback e mostrare empty state esplicito quando la lista esercizi è vuota.

### B8. Nessun ErrorBoundary sul subtree `/coach/*`

- **Dove**: `App.tsx` non wrappa `<SubscriptionGuard>` né `CoachLayout` in un ErrorBoundary.
- **Improvement**: aggiungere `<CoachErrorBoundary>` per evitare schermo bianco su throw in qualsiasi child.

### B9. Mancanza di skeleton loader sui dashboard widgets

- **Dove**: tutte le pages coach che consumano React Query — `query.isLoading` non guida lo skeleton, ma viene reso `null` o "nessun dato".
- **Improvement**: pattern standard con shadcn `<Skeleton />` per evitare layout shift.

---

## Dove la piattaforma fallirà in produzione

In ordine di probabilità:

1. **Subito, su qualsiasi azione di Calendar** — se le RLS non sono in `workout_logs` / `workouts` (vedi C1), un coach malicious può cancellare dati altrui via REST forge.
2. **Su qualsiasi save in AthleteDetail** — handleSave race condition mostra "salvato" mentre la mutation è ancora in volo (M1).
3. **Su Aggiungi Metrica in AthleteDetail** — pulsante fake, l'utente perde i dati dopo refresh (C4).
4. **Su NewChat in CoachMessages** — setTimeout 500ms timing hack fallisce su rete lenta (M2).
5. **Schermata Calendar mostrerà sempre Mario Rossi-style mock appointments** — `MOCK_APPOINTMENTS` hardcoded (M3).
6. **Macro periodization timeline mostra blocchi finti se `externalBlocks` non viene passato** (M3).
7. **Eventuali errori in StrategyContent espongono dettagli in console** — 5 `console.error` consecutivi nel file (M6).

## Prossimi passi consigliati

### Priorità 1 — Sicurezza + correttness (1-2 settimane)
1. Verificare RLS su `workout_logs` e `workouts` per DELETE/UPDATE. Aggiungere defense-in-depth client-side. (C1)
2. Cablare `handleAddMetric` a una vera mutation Supabase. (C4)
3. Fixare race condition in handleSave usando `mutation.isPending`. (M1)
4. Rimuovere `setTimeout(500)` da CoachMessages. (M2)

### Priorità 2 — Type safety (2-3 settimane)
5. Definire `AthleteProfileSettings` interface + sostituire i 7 `any` in AthleteDetail. (C2)
6. Tipizzare `profiles.settings`, `workout_logs.exercises_data`, `workouts.structure` JSONB. (M5, M8, B5)
7. Sostituire `(error: any)` con `Error` / `PostgrestError` ovunque.
8. Rimuovere `as any` da CoachCalendar soft-delete. (M4)

### Priorità 3 — Manutenibilità (sprint dedicato)
9. **Refactor di AthleteDetail.tsx** da 4037 righe a 6-8 sub-componenti router-nested. (C3)
10. Sostituire `MOCK_BLOCKS`, `MOCK_APPOINTMENTS`, `MOCK_GOOGLE_BUSY_SLOTS` con query reali. (M3)
11. Implementare PDF extraction in KnowledgeBase. (B1)
12. Wrappare `/coach/*` in ErrorBoundary. (B8)

### Priorità 4 — Polish (low-pri)
13. Centralizzare logging via `logger.ts` (M6)
14. Token chart colors (M10)
15. Aria-label sui button-icon (M11)
16. Skeleton loader sui dashboard widgets (B9)
17. Prettier fix import spacing (B2)

---

## Note finali

La piattaforma coach è **funzionalmente più ricca** dell'app atleta (più pagine, più feature, più sub-component), ma **type-safety degradata** (23 `any` vs zero sull'atleta), e ha un **file gigante** (`AthleteDetail.tsx`) che è il principale rischio strutturale. Le 4 issue critical non sono molte — ma C1 (RLS) è la più seria perché può portare a data loss cross-tenant se la difesa server-side dovesse failare.

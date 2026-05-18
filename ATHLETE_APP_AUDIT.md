# Athlete App Audit Report

**Branch**: `claude/flamboyant-hertz-937c2d`
**Data audit**: 2026-05-18
**Scope**:
- `src/pages/athlete/**` (13 file)
- `src/components/athlete/**` (8 file, di cui 5 drawer in `drawers/`)
- `src/hooks/athlete/**` (2 file)
- `src/stores/useAthleteWorkoutStore.ts` + `src/stores/useAthleteReadinessStore.ts`
- File correlati: `src/hooks/useAthlete*.ts` (5 file analytics)

**Metodologia**: lettura diretta dei sorgenti + grep mirati per pattern di rischio (any/cast, console, FIXME, color arbitrari, raw shadow), tracciamento dei flussi mutation→store, verifica delle dipendenze `useEffect`, controllo del comportamento al primo render + mount race.

**Status complessivo**:
- ✅ Zero `any`/`as any`/`@ts-ignore` — type safety pulita
- ✅ Layout responsivo molto buono dopo i fix recenti
- ✅ Accessibilità di base presente (aria-label, role=radiogroup)
- ⚠️ Il **70%** delle criticità deriva da dati ancora mock: i drawer di esecuzione (4/5), il workout attivo, gli stat post-workout sono fixed strings. La frontend funziona, ma il "data layer" è completo SOLO per readiness + standard sets.
- 🔴 In runtime con DB reale ci sono **3 bug certi** che generano duplicati o errori FK silenziosi.

---

## 🔴 High Priority (Critical Issues)

### H1. Mock exercise IDs causano FK violation al primo `logSet` in produzione

- **Dove**: [`src/pages/athlete/ActiveWorkout.tsx:104-115`](src/pages/athlete/ActiveWorkout.tsx) — `ACTIVE_EXERCISE.id = "a1"`, `UPCOMING[0].id = "b1"`, `UPCOMING[1].id = "b2"`. Stesso pattern in [`AthleteTraining.tsx`](src/pages/athlete/AthleteTraining.tsx) (`id: "1"`, `"a1"`, `"b1"`, `"c1"`).
- **Impatto**: `exercise_logs.exercise_id` è `UUID NOT NULL REFERENCES exercises(id)`. Quando l'atleta apre `StandardSetDrawer` e tappa "Aggiungi Set", `useLogSetMutation` invia `exercise_id: "a1"`. Postgres: `invalid input syntax for type uuid: "a1"` o `foreign key violation`. Toast errore visibile, set non salvato. **L'app SEMBRA funzionare ma non persiste niente**.
- **Fix**:
  1. Creare un hook `useExercisesQuery()` che legge `exercises` table (filtrata per coach o pubbliche).
  2. Sostituire array hardcoded in `AthleteTraining`/`ActiveWorkout` con dati da quel hook (le `id` saranno UUID).
  3. Aggiungere uno "skeleton state" per quando la query non è ancora pronta.

### H2. 4 drawer su 5 non persistono nulla — l'atleta perde dati al close

- **Dove**:
  - [`SupersetDrawer.tsx:62`](src/components/athlete/drawers/SupersetDrawer.tsx) — `useState(INITIAL)` con esercizi mock; nessuna mutation
  - [`AmrapDrawer.tsx`](src/components/athlete/drawers/AmrapDrawer.tsx) — countdown + rounds/extraReps in `useState`, nessun save
  - [`IntensityDrawer.tsx:58-59`](src/components/athlete/drawers/IntensityDrawer.tsx) — `useState(INITIAL)`, nessun save
  - [`IsometricDrawer.tsx`](src/components/athlete/drawers/IsometricDrawer.tsx) — timer + sets locali, nessun save
- **Impatto**: se la sessione include un superset o un AMRAP, l'atleta logga manualmente kg/reps/round nel drawer, lo chiude per passare al prossimo esercizio, e tutto è perso. La dashboard del coach non vedrà mai questi dati.
- **Fix**: replicare il pattern di `StandardSetDrawer` (`useLogSetMutation` + `useSessionSetsQuery`) per gli altri 4. Per AMRAP/Isometric c'è anche da modellare nuovi tipi di set in `exercise_logs` (oggi: `weight`+`reps`+`set_number`; servirebbe un `duration_seconds` o un `rounds` per i protocolli speciali).

### H3. Mutation senza disabled UI → doppio insert su rete lenta

- **Dove**:
  - [`PostWorkoutDebrief.tsx`](src/pages/athlete/PostWorkoutDebrief.tsx) `handleSave` — il bottone "Salva e Torna alla Home" è cliccabile durante `finishSession.isPending`
  - [`DailyCheckin.tsx`](src/pages/athlete/DailyCheckin.tsx) `handleSave` — stesso problema per `submitReadiness.isPending`
- **Impatto**: su 4G/2G l'utente tap "Salva", non vede feedback immediato, tap di nuovo → due INSERT in DB. Per `daily_readiness` la UNIQUE `(athlete_id, date)` salva la situazione, ma per `workout_logs` due UPDATE consecutivi vanno entrambi a buon fine e si sovrascrivono.
- **Fix**: aggiungere `disabled={mutation.isPending}` a ogni primary CTA che lancia una mutation. Aggiungere uno spinner o stato visual quando pending. `StandardSetDrawer.tsx:90-93` lo fa già correttamente — replicare ovunque.

### H4. `DailyCheckin` aggiorna lo store locale PRIMA della mutation, senza rollback su errore

- **Dove**: [`src/pages/athlete/DailyCheckin.tsx:325-349`](src/pages/athlete/DailyCheckin.tsx) — chiama `submitDailyCheckin(payload)` (Zustand) → poi `submitReadiness.mutate(...)`. Solo `onSuccess` gestito; `onError` non rolla indietro il cambio locale.
- **Impatto**: l'atleta vede il dashboard aggiornato istantaneamente (Sonno passa da `null` a `8`), poi la mutation fallisce (RLS, network, ecc.), un toast errore appare, ma il dashboard mantiene il valore ottimistico. Al refresh successivo il valore sparisce (la query DB ritorna `null`), creando inconsistenza visibile.
- **Fix**: salvare il valore previo prima del local update; in `onError` ripristinarlo. Oppure: invertire l'ordine — fare prima `mutate`, sull'`onSuccess` chiamare `submitDailyCheckin` (perdi la snappiness ma elimini il drift).

### H5. `crypto.randomUUID()` può lanciare in contesti SSR / Node < 15.7

- **Dove**: [`src/hooks/athlete/useAthleteWorkoutHooks.ts:66-67`](src/hooks/athlete/useAthleteWorkoutHooks.ts) — `id: crypto.randomUUID()`, `athlete_id: crypto.randomUUID()`. Anche nel main repo se si fa SSR build.
- **Impatto**: oggi è solo client (`Vite + React`), quindi safe. Ma se domani si introduce SSR (Next, Remix, Astro), il primo render server-side crasha con `ReferenceError: crypto is not defined`. Inoltre `crypto.randomUUID()` richiede secure context (HTTPS o localhost) — su HTTP non-secure browser dà errore.
- **Fix**: import polyfill `import { v4 as uuidv4 } from "uuid"` (la dipendenza è già in `package.json` con buona probabilità) oppure feature-detect: `typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : fallback`.

### H6. `daily_readiness.score` è hardcoded a 85 in submit

- **Dove**: [`src/pages/athlete/DailyCheckin.tsx:339`](src/pages/athlete/DailyCheckin.tsx) — `score: 85` literal nella `submitReadiness.mutate({...})`.
- **Impatto**: ogni atleta che fa check-in vede `dailyScore = 85` sul dashboard, indipendentemente dai valori reali di sleep/fatigue/stress. La metrica principale del prodotto è una costante.
- **Fix**: trigger Postgres `BEFORE INSERT/UPDATE` su `daily_readiness` che computa lo score da `sleep_quality`, `fatigue_score`, `stress_level`, `mood`, `soreness_map`. La logica matematica esiste già in [`src/lib/math/readinessMath.ts`](src/lib/math/readinessMath.ts) — portarla a SQL o chiamarla client-side prima del mutate.

### H7. `SessionStatsCard` propaga NaN se `weight`/`reps` sono null

- **Dove**: [`src/pages/athlete/PostWorkoutDebrief.tsx:82-87`](src/pages/athlete/PostWorkoutDebrief.tsx)
  ```ts
  for (const row of rows) {
    totalVolumeKg += row.weight * row.reps;
  }
  ```
  `exercise_logs.weight` è `NUMERIC NOT NULL CHECK (>= 0)` e `reps` è `SMALLINT NOT NULL CHECK (>= 0)`, quindi NULL non dovrebbero arrivare. Ma il type TS è `number` (dal generated `types.ts`) e in caso di INSERT manuale via Studio o di SQL anomalo, `null * number = NaN`.
- **Impatto**: il totale diventa `NaN`, mostrato come "NaN kg" all'utente. Aspetto poco professionale e potenzialmente confusion-driver per il coach che vede stats inutili.
- **Fix**:
  ```ts
  const w = Number(row.weight) || 0;
  const r = Number(row.reps) || 0;
  totalVolumeKg += w * r;
  ```

### H8. La schermata ActiveWorkout vede un workout finto

- **Dove**: [`src/pages/athlete/ActiveWorkout.tsx:96-118`](src/pages/athlete/ActiveWorkout.tsx) — `COMPLETED_PHASE` (Movement Prep), `ACTIVE_EXERCISE` (A1 Barbell Back Squat), `UPCOMING` (B1 RDL, B2 Pull-ups), `SESSION_PROGRESS_PERCENT = 30`. Tutto literal.
- **Impatto**: indipendentemente dal workout che il coach prescrive (che sta nella tabella `workouts` collegata a `workout_logs.workout_id`), l'atleta vede sempre questa coreografia mock. La sessione persiste in DB (`workout_logs` row con `started_at`), ma i sets loggati sono associati a `exercise_id` mock ("a1") che non esiste → veggi H1.
- **Fix**: estrarre il "workout corrente" dalla `workout_logs.workout_id` (popolarlo dal flusso AthleteTraining → "Inizia Sessione") e fetchare gli esercizi reali con un `useWorkoutQuery(workoutId)` hook. Fino a quel punto, il flow di esecuzione è demo only.

### H9. `PostWorkoutDebrief` mostra titoli e muscoli hardcoded

- **Dove**: [`src/pages/athlete/PostWorkoutDebrief.tsx:45-49`](src/pages/athlete/PostWorkoutDebrief.tsx) — `WORKOUT_SUMMARY.title = "Lower Body Power"`, `muscles = [...]`.
- **Impatto**: dopo qualsiasi workout (Upper, HIIT, mobility) l'atleta vede "Lower Body Power" e i 4 stessi muscoli. Disconnessione totale dai dati reali.
- **Fix**: idem H8 — passare il workout id come route state, fetchare titolo/muscoli dal DB.

---

## 🟡 Medium Priority (UX & State Logic)

### M1. Design system: 134 occorrenze di colori/shadow arbitrari `[#...]` o `[rgba(...)]`

- **Dove**: grep `bg-\[# / text-\[# / border-\[# / shadow-\[` su athlete pages + components → 134 hit, di cui ~17 specifiche di `#c0c7d0` (border/divider) ripetute in `ActiveWorkout`, `DailyCheckin`, `AmrapDrawer`, `ExitWorkoutDialog`, `DrawerShell`, `SupersetDrawer`, ecc.
- **Impatto**: cambi del design system (dark mode, ridipingere i bordi su contrast WCAG AA) richiedono touching di 130+ file. Inoltre rgba inline non sopravvivono a un cambio della palette brand.
- **Suggerimento**: estrarre tre token in `tailwind.config.ts`:
  - `colors.outline-soft: '#c0c7d0'` (con varianti `/30`, `/40`)
  - `boxShadow.elevation-1`, `elevation-2`, `elevation-3` con le rgba esistenti
- Poi grep-replace via codemod (è meccanico, ~20 min).

### M2. Timer `useEffect` con `remaining` nelle deps → cleanup/recreate ad ogni tick

- **Dove**:
  - [`AmrapDrawer.tsx:63-77`](src/components/athlete/drawers/AmrapDrawer.tsx) — deps `[open, isPaused, remaining]`
  - [`IsometricDrawer.tsx:54-68`](src/components/athlete/drawers/IsometricDrawer.tsx) — deps `[runningSetId, remaining]`
- **Impatto**: ogni secondo il tick aggiorna `remaining`, l'effect si re-esegue, cleanup dell'interval e ricreazione. Funzionalmente il countdown è corretto, ma c'è drift: se il render è lento (es. heavy parent re-rendering), il prossimo tick parte da `tick + render_time`, non `tick + 1000ms`. Su sessioni AMRAP da 20 minuti la deriva può sommare 5-10 secondi.
- **Suggerimento**: rimuovere `remaining` dalle deps. Il pattern corretto è dichiarare l'interval una volta, usare `setRemaining((r) => r - 1)` (già fatto) e gestire la condizione di stop dentro il setter, non nelle deps.

### M3. `ActiveWorkout` mount-race: stale render prima della nuova session

- **Dove**: [`src/pages/athlete/ActiveWorkout.tsx:586-602`](src/pages/athlete/ActiveWorkout.tsx) — `stopSession()` è sincrono, ma `startSessionMutation.mutate({...})` ha latency di rete. Tra i due c'è un render con `activeSessionId = null`.
- **Impatto**: durante 100-500ms il timer mostra 00:00, le card esercizi mostrano "0/4", il header è blank. Brutto se l'atleta arriva da "Inizia Sessione" e si aspetta apparizione immediata.
- **Suggerimento**: render condizionale — se `startSessionMutation.isPending` e `activeSessionId === null`, mostrare uno spinner full-screen invece del layout vuoto. Oppure usare `optimistic update`: settare un UUID locale come `activeSessionId` prima del mutate; sull'`onSuccess` aggiornarlo all'id reale.

### M4. Nessun ErrorBoundary nel sottoalbero athlete

- **Dove**: nessuno dei file in `src/pages/athlete/**` o `src/components/athlete/**` è wrappato in un ErrorBoundary; nessun `<ErrorBoundary>` neanche in `App.tsx` per il segmento `/athlete/*`.
- **Impatto**: un singolo errore non gestito (es. accesso a `query.data.foo.bar` dove `.foo` è undefined) blanca tutta la pagina. L'utente vede schermo bianco senza modo di tornare indietro.
- **Suggerimento**: aggiungere `<AthleteErrorBoundary>` in `AthleteLayout.tsx` con fallback UI ("Qualcosa è andato storto") + bottone "Torna alla Home".

### M5. `WeeklyCheckin.tsx` invia su `console.info` invece che su DB

- **Dove**: [`src/pages/athlete/WeeklyCheckin.tsx:58-69`](src/pages/athlete/WeeklyCheckin.tsx) — `handleSubmit` chiama `console.info("[WeeklyCheckin] payload preview", ...)` e mostra toast successo, ma nessun INSERT su `weekly_checkins` table (esiste lato DB).
- **Impatto**: l'utente pensa di aver inviato il check-in settimanale al coach, in realtà non arriva niente. Falsa positiva nell'UX, vuoto totale lato coach.
- **Suggerimento**: scrivere `useSubmitWeeklyCheckinMutation` (pattern identico a `useSubmitReadinessMutation`) che INSERT su `weekly_checkins` con i campi del payload. Rimuovere il `console.info` e l'orphan `// eslint-disable-next-line no-console` rimasto.

### M6. Nessun loading skeleton mentre le query sono pending

- **Dove**: tutti i consumer di React Query (`AthleteDashboard`, `ActiveWorkout`, `StandardSetDrawer`, `PostWorkoutDebrief`) non mostrano skeleton durante `isLoading`. Risultato: prima il dashboard mostra "0/3 metriche" / `ringValue=0` / "Inizia il check-in" (perché `todayQuery.data === undefined` = falsy = `isCompletedToday=false`), poi se la query carica una riga "today done" il dashboard salta improvvisamente al ring pieno.
- **Impatto**: flicker di stato visibile su rete lenta. Coach demo / first-impression viene compromesso.
- **Suggerimento**: usare `query.isLoading` per renderizzare skeleton (es. `<Skeleton className="h-24 w-full rounded-3xl" />` esistente in shadcn). Distinguere `isLoading` (mai caricato) da `isFetching` (refetch background) per evitare skeleton ad ogni invalidate.

### M7. `computeWorstMetrics` ritorna un nuovo array a ogni render

- **Dove**: [`src/pages/athlete/AthleteDashboard.tsx`](src/pages/athlete/AthleteDashboard.tsx) — `const worstMetrics = computeWorstMetrics(metrics, 3);` viene chiamato in `ReadinessCard()` ogni render, ricalcolando sort/filter sull'intero `MetricsMap`.
- **Impatto**: la funzione è O(N log N) su 6 chiavi → nulla. Ma costa: re-render → nuovo array → potenzialmente nuovi ref per child memoizzati. Oggi `MetricTrendRow` non è memo, quindi è invisibile. Domani se viene aggiunto `React.memo(MetricTrendRow)`, il re-render forzato dal cambio ref di `displayedMetricKeys` annullerebbe il memo.
- **Suggerimento**: avvolgere il calcolo in `useMemo([metrics])` o passare `metrics` direttamente alle MetricTrendRow e farle decidere se mostrarsi.

### M8. Drawer non hanno focus trap né return-focus sull'opener

- **Dove**: tutti i 5 drawer in `src/components/athlete/drawers/` usano il `DrawerShell` custom. Verificando rapidamente: gestisce `open`/`onClose` e backdrop, ma nessuna gestione esplicita di `aria-modal`, `inert` sul background, o `useEffect` per spostare il focus sul primo elemento focusable del drawer all'apertura e ridarlo all'opener alla chiusura.
- **Impatto**: utenti screen-reader (e tab-keyboard users) possono "uscire" dal drawer con Tab e tornare sul contenuto della pagina sotto. Compromesso WCAG.
- **Suggerimento**: sostituire `DrawerShell` con la primitiva shadcn `Drawer` (già presente in `src/components/ui/drawer.tsx`) che usa `vaul` e gestisce focus trap. Oppure aggiungere manualmente focus-trap (libreria `focus-trap-react`).

### M9. Touch target sotto 44px sui pulsanti score (1-5)

- **Dove**: [`src/pages/athlete/DailyCheckin.tsx:131-137`](src/pages/athlete/DailyCheckin.tsx) — pulsanti `ScoreScaleRow` sono `h-10 w-10` (40px). Apple HIG e WCAG 2.5.5 raccomandano minimo 44px.
- **Impatto**: utenti con dita grosse o motor impairment hanno difficoltà a centrare i pulsanti. Mistapping frequente.
- **Suggerimento**: `h-11 w-11` (44px) o `min-h-[44px] min-w-[44px]`. Già fatto nel `PostWorkoutDebrief` RPE scale dopo la fix recente — replicare lo stesso pattern qui.

### M10. La mutation `useSubmitReadinessMutation` non disabilita il submit

- **Dove**: il button "Salva" in `DailyCheckin.tsx` (cerca per `handleSave`) — verificare se `submitReadiness.isPending` è cablato a `disabled`. Dal codice letto: no.
- **Impatto**: stesso problema di H3 ma con scope readiness anziché workout.
- **Suggerimento**: `disabled={!canSubmit || submitReadiness.isPending}` + spinner inline.

---

## 🔵 Low Priority (Code Cleanliness & Documentation)

### L1. `console.warn` in produzione per ogni utente non-autenticato

- **Dove**: [`src/hooks/athlete/useAthleteWorkoutHooks.ts:108-110`](src/hooks/athlete/useAthleteWorkoutHooks.ts)
  ```ts
  console.warn("[useStartSessionMutation] No authenticated user — falling back to local-only session.");
  ```
- **Impatto**: ad ogni mount di ActiveWorkout senza auth, il console viene riempito. Sentinel utile in dev, rumore in prod.
- **Improvement**: `if (import.meta.env.DEV) console.warn(...)` per limitarlo al solo build di sviluppo.

### L2. `Array.from({ length: ... })` ricreato ad ogni render

- **Dove**: [`src/pages/athlete/ActiveWorkout.tsx:344`](src/pages/athlete/ActiveWorkout.tsx) — `Array.from({ length: exercise.targetSets }).map(...)` nel rendering delle pill segments.
- **Impatto**: trascurabile per `targetSets <= 10`. Allocazione GC minore.
- **Improvement**: estrarre come `useMemo` se diventa hot path, altrimenti lasciar stare.

### L3. `Date.now()` come id locale può collidere

- **Dove**: [`src/components/athlete/drawers/IsometricDrawer.tsx:99`](src/components/athlete/drawers/IsometricDrawer.tsx) — `id: String(Date.now())`.
- **Impatto**: due "Add Round" cliccati nello stesso millisecondo generano lo stesso id → React reconciliation glitch. Improbabile con click umani, possibile con automation.
- **Improvement**: `crypto.randomUUID()` (con caveat di H5) o un counter ref `useRef(0)` + increment.

### L4. Commenti "No Supabase wiring. Backend integration lands in the next commit." sono datati

- **Dove**: header docblock di [`ActiveWorkout.tsx:33`](src/pages/athlete/ActiveWorkout.tsx), [`AthleteTraining.tsx:34`](src/pages/athlete/AthleteTraining.tsx), [`WorkoutPhaseDetail.tsx`](src/pages/athlete/WorkoutPhaseDetail.tsx), e altri.
- **Impatto**: nuovi sviluppatori leggono il commento e pensano che il backend sia in arrivo, mentre in realtà parte è già live (sessioni + set log) e parte mock (esercizi).
- **Improvement**: rivedere i docblock e scrivere lo stato reale: "Backend wired for session + per-set logging. Exercise content still mock."

### L5. Type-export di `SetEntry` rimosso ma commento stale

- **Dove**: [`src/pages/athlete/ActiveWorkout.tsx:76`](src/pages/athlete/ActiveWorkout.tsx) — `/** Stable id used as the key in \`loggedSets[id]\`. */` riferimento a `loggedSets` che non esiste più nello store.
- **Impatto**: confusione per chi legge.
- **Improvement**: aggiornare il commento: "Stable id used as the `exercise_id` in `exercise_logs` rows."

### L6. Border-radius non semanticamente codificato

- **Dove**: mix di `rounded-2xl` e `rounded-3xl` in tutti i page/drawer senza una regola chiara.
- **Impatto**: trascurabile, ma indica assenza di mapping "container = 3xl / interactive = 2xl / chip = full".
- **Improvement**: aggiungere `tailwind.config.ts` `borderRadius: { card: '1.5rem', surface: '2rem', chip: '9999px' }` e migrare gradualmente.

### L7. Drawer non-Standard salvano in `useState`, non in store, non in DB

- **Dove**: `SupersetDrawer`, `AmrapDrawer`, `IntensityDrawer`, `IsometricDrawer` — il loro state è `useState(...)` locale al componente.
- **Impatto**: legato a H2 ma con sfumatura diversa: l'atleta NON può minimizzare il drawer e riaprirlo dopo (lo state si resetta). Per ora le interazioni sono finte, quindi accettabile, ma è una landmine per Phase 9.
- **Improvement**: anche prima del backend wiring, considerare di sollevare lo state in un context o un Zustand slice "drawer state" così che sopravviva al close/reopen.

### L8. Mock data inline al posto di seed query reale

- **Dove**: `AthleteTraining.tsx` ha array di esercizi inline (~80 righe); `ActiveWorkout.tsx` ha `COMPLETED_PHASE`/`ACTIVE_EXERCISE`/`UPCOMING`; `PostWorkoutDebrief.tsx` ha `WORKOUT_SUMMARY`.
- **Impatto**: aggiornare il "workout demo" mostrato richiede modificare codice TS, non semplicemente cambiare seed SQL.
- **Improvement**: spostare in un `src/lib/athlete/mockWorkout.ts` (consolidare in un solo posto) o, meglio, popolarli da `seed.sql` e fetchare. Quando arriverà il vero workout flow, basterà rimuovere l'import.

### L9. `eslint-disable-next-line no-console` orfano in WeeklyCheckin

- **Dove**: [`src/pages/athlete/WeeklyCheckin.tsx:60`](src/pages/athlete/WeeklyCheckin.tsx) — la directive è attaccata al `console.info` ma il lint config probabilmente non flagga `console.info` (solo `log`), quindi la disable è inutile.
- **Improvement**: rimuovere la riga `// eslint-disable-next-line no-console` (è il warning preesistente al baseline lint).

---

## Sommario

| Severità | Count | Tema principale |
|---|---|---|
| 🔴 High | 9 | Data layer incompleto (mock IDs, hardcoded session, no rollback), 1 bug runtime (`crypto`) |
| 🟡 Medium | 10 | UX (loading/empty/focus), perf marginali, design tokens, error boundary, weekly check-in non persistito |
| 🔵 Low | 9 | Cleanup commenti, lint orfani, semantica radius/shadow |

**Dove l'app fallirà in produzione (in ordine di probabilità)**:

1. **Subito**: il primo atleta che apre un esercizio + tappa "Aggiungi Set" → FK violation, set non salvato (H1).
2. **Subito**: l'atleta che fa il check-in vede sempre `dailyScore = 85` indipendentemente dai suoi numeri (H6).
3. **Quando un drawer non-Standard viene aperto**: dati persi al close (H2).
4. **Su rete lenta**: doppi insert / mutazioni duplicate da bottoni non disabilitati (H3, M10).
5. **Su errori di rete**: store locale e DB divergono fino al refresh (H4).
6. **Quando il PostWorkoutDebrief contiene dati anomali**: "NaN kg" mostrato (H7).

**Prima di considerare la app "production-ready" lato Athlete**, le 9 voci High vanno tutte risolte. Le Medium sono tutte improvement, ma M5 (WeeklyCheckin che logga su console invece di salvare) è effettivamente un bug funzionale travestito da medium.

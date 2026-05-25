// Onboarding Data Types — NC Personal Trainer Profiling Engine

export type YesNoIDK = "yes" | "no" | "idk";

export interface LegalConsent {
  termsAccepted: boolean; // 1.1 — must be true to proceed
}

type Gender = "male" | "female" | "other";

export interface BiometricsData {
  gender: Gender | null;
  dateOfBirth: string | null;
  heightCm: number | null;
  weightKg: number | null;
}

// Area 1 — PAR-Q (1.2 .. 1.8)
interface MedicalSafetyAnswers {
  q12: YesNoIDK | null;
  q13: YesNoIDK | null;
  q14: YesNoIDK | null;
  q15: YesNoIDK | null;
  q16: YesNoIDK | null;
  q17: YesNoIDK | null;
  q18: YesNoIDK | null;
}

// Area 2 — FMS / Red Flags
interface OrthopedicAnswers {
  q21: YesNoIDK | null;
  q22: YesNoIDK | null; // spine
  q23: YesNoIDK | null; // lower body
  q24: YesNoIDK | null; // upper body
}

// Area 3 — Sports background
interface SportsBackgroundAnswers {
  q31: YesNoIDK | null;
  q32: YesNoIDK | null;
  q33: YesNoIDK | null;
  q34: YesNoIDK | null;
  q35: YesNoIDK | null;
}

// Area 4 — Lifestyle
interface LifestyleAnswers {
  q41: YesNoIDK | null;
  q42: YesNoIDK | null;
  q43: YesNoIDK | null;
  q44: YesNoIDK | null;
  q45: YesNoIDK | null;
}

// Area 5 — Goals
interface GoalsAnswers {
  q51: YesNoIDK | null;
  q52: YesNoIDK | null;
  q53: YesNoIDK | null;
  q54: YesNoIDK | null;
}

// Area 6 — Neurotyping (15 items)
export type NeurotypType = "1A" | "1B" | "2A" | "2B" | "3";

interface NeurotypingAnswers {
  q61: YesNoIDK | null;
  q62: YesNoIDK | null;
  q63: YesNoIDK | null;
  q64: YesNoIDK | null;
  q65: YesNoIDK | null;
  q66: YesNoIDK | null;
  q67: YesNoIDK | null;
  q68: YesNoIDK | null;
  q69: YesNoIDK | null;
  q610: YesNoIDK | null;
  q611: YesNoIDK | null;
  q612: YesNoIDK | null;
  q613: YesNoIDK | null;
  q614: YesNoIDK | null;
  q615: YesNoIDK | null;
}

export interface OnboardingData {
  legal: LegalConsent;
  biometrics: BiometricsData;
  medical: MedicalSafetyAnswers;
  orthopedic: OrthopedicAnswers;
  sports: SportsBackgroundAnswers;
  lifestyle: LifestyleAnswers;
  goals: GoalsAnswers;
  neurotyping: NeurotypingAnswers;
}

export const defaultOnboardingData: OnboardingData = {
  legal: { termsAccepted: false },
  biometrics: { gender: null, dateOfBirth: null, heightCm: null, weightKg: null },
  medical: { q12: null, q13: null, q14: null, q15: null, q16: null, q17: null, q18: null },
  orthopedic: { q21: null, q22: null, q23: null, q24: null },
  sports: { q31: null, q32: null, q33: null, q34: null, q35: null },
  lifestyle: { q41: null, q42: null, q43: null, q44: null, q45: null },
  goals: { q51: null, q52: null, q53: null, q54: null },
  neurotyping: {
    q61: null,
    q62: null,
    q63: null,
    q64: null,
    q65: null,
    q66: null,
    q67: null,
    q68: null,
    q69: null,
    q610: null,
    q611: null,
    q612: null,
    q613: null,
    q614: null,
    q615: null,
  },
};

// ============= QUESTION CATALOG =============

export interface YesNoQuestion {
  id: string;
  text: string;
}

export const MEDICAL_QUESTIONS: YesNoQuestion[] = [
  {
    id: "q12",
    text: "Il medico ti ha mai detto che hai una condizione cardiaca e che dovresti svolgere solo attività fisica raccomandata da un medico?",
  },
  { id: "q13", text: "Avverti dolore al petto quando fai attività fisica?" },
  {
    id: "q14",
    text: "Nell'ultimo mese hai avuto dolore al petto anche senza fare attività fisica?",
  },
  { id: "q15", text: "Perdi l'equilibrio per vertigini o ti capita mai di perdere conoscenza?" },
  {
    id: "q16",
    text: "Hai un problema osseo o articolare (es. schiena, ginocchio, anca) che potrebbe peggiorare con un cambiamento di attività fisica?",
  },
  {
    id: "q17",
    text: "Il medico ti sta attualmente prescrivendo farmaci per la pressione sanguigna o per una condizione cardiaca?",
  },
  {
    id: "q18",
    text: "Sei a conoscenza di altri motivi medici per cui non dovresti fare attività fisica?",
  },
];

export const ORTHOPEDIC_QUESTIONS: YesNoQuestion[] = [
  {
    id: "q21",
    text: "Hai mai subito interventi chirurgici, traumi gravi o infortuni che senti ancora oggi limitino i tuoi movimenti?",
  },
  {
    id: "q22",
    text: "Provi attualmente dolore acuto o disagio nella colonna vertebrale (cervicale, toracica o lombare) durante o dopo l'allenamento?",
  },
  {
    id: "q23",
    text: "Provi attualmente dolore o limitazioni significative nelle articolazioni della parte inferiore del corpo (anche, ginocchia, caviglie)?",
  },
  {
    id: "q24",
    text: "Provi attualmente dolore o limitazioni significative nelle articolazioni della parte superiore del corpo (spalle, gomiti, polsi)?",
  },
];

export const SPORTS_QUESTIONS: YesNoQuestion[] = [
  {
    id: "q31",
    text: "Hai praticato sport a livello competitivo o costante per più di 3 anni in passato?",
  },
  { id: "q32", text: "Ti alleni in sala pesi in modo costante da più di 12 mesi ininterrotti?" },
  {
    id: "q33",
    text: "Sai eseguire i fondamentali con bilanciere (Squat, Panca, Stacco) con sicurezza e buona tecnica?",
  },
  {
    id: "q34",
    text: "Hai mai seguito un programma basato su autoregolazione (RPE / RIR) o percentuali di carico?",
  },
  {
    id: "q35",
    text: "Sei mentalmente abituato e pronto a sessioni che portano i muscoli a esaurimento severo (cedimento muscolare)?",
  },
];

export const LIFESTYLE_QUESTIONS: YesNoQuestion[] = [
  {
    id: "q41",
    text: "Hai un lavoro o una routine quotidiana fisicamente impegnativa (es. cammini molto, stai in piedi tutto il giorno, sollevi oggetti pesanti)?",
  },
  {
    id: "q42",
    text: 'Consideri il tuo livello attuale di stress mentale e psicologico quotidiano "alto" o "molto alto"?',
  },
  {
    id: "q43",
    text: "Riesci quasi sempre a dormire almeno 7-8 ore di sonno ininterrotto e di buona qualità?",
  },
  {
    id: "q44",
    text: "Stai attualmente seguendo una dieta precisa (con conteggio calorie e macro) o un piano nutrizionale altamente strutturato?",
  },
  {
    id: "q45",
    text: "Pensi di essere stato/a in un deficit calorico severo (mangiando molto meno di quanto consumi) per diverse settimane o mesi?",
  },
];

export const GOALS_QUESTIONS: YesNoQuestion[] = [
  {
    id: "q51",
    text: "Il tuo obiettivo principale in questo momento è puramente estetico (es. ipertrofia muscolare, ricomposizione corporea, perdita di grasso)?",
  },
  {
    id: "q52",
    text: "Il tuo obiettivo include diventare significativamente più forte o prepararti per uno sport specifico (diverso dal powerlifting)?",
  },
  { id: "q53", text: "Ti stai specificamente preparando a competere nel Powerlifting?" },
  {
    id: "q54",
    text: "Ti aspetti di vedere cambiamenti fisici o di performance drastici e definitivi in meno di 12 settimane?",
  },
];

export interface NeurotypingQuestion extends YesNoQuestion {
  type: NeurotypType;
}

export const NEUROTYPING_QUESTIONS: NeurotypingQuestion[] = [
  // 1A — Neural Intensity / Dopamine
  {
    id: "q61",
    type: "1A",
    text: "Mi sento molto più motivato/a sollevando carichi vicini al mio limite massimo (poche ripetizioni, carico pesante) piuttosto che eseguire molte ripetizioni leggere.",
  },
  {
    id: "q62",
    type: "1A",
    text: "Sono una persona estremamente competitiva, sia nello sport che nella vita, e faccio fatica ad accettare la sconfitta.",
  },
  {
    id: "q63",
    type: "1A",
    text: "Mi frustro o mi annoio se il programma include troppa varietà di esercizi accessori invece di concentrarsi sulla progressione dei lift principali.",
  },
  // 1B — Explosiveness / Adrenaline
  {
    id: "q64",
    type: "1B",
    text: "Sento un forte bisogno di caricarmi emotivamente (es. musica alta, mentalità aggressiva) prima di affrontare una serie pesante.",
  },
  {
    id: "q65",
    type: "1B",
    text: "Detesto gli esercizi eseguiti lentamente e con controllo rigoroso; preferisco i movimenti in cui posso esprimere forza ed esplosività in modo dinamico.",
  },
  {
    id: "q66",
    type: "1B",
    text: "Faccio fatica a mantenere la massima concentrazione se un allenamento dura troppo a lungo o se i tempi di recupero tra le serie sono molto brevi.",
  },
  // 2A — Variation / Adaptability
  {
    id: "q67",
    type: "2A",
    text: "Perdo rapidamente entusiasmo e motivazione se devo ripetere la stessa identica routine di allenamento per più di 3-4 settimane.",
  },
  {
    id: "q68",
    type: "2A",
    text: "Mi piace imparare nuovi pattern motori e sento di avere una buona attitudine a padroneggiare nuovi sport o esercizi abbastanza rapidamente.",
  },
  {
    id: "q69",
    type: "2A",
    text: "Tendo a procrastinare o a fare le cose all'ultimo minuto, ma di solito mi adatto bene a situazioni inaspettate.",
  },
  // 2B — Sensation / Connection / Serotonin
  {
    id: "q610",
    type: "2B",
    text: 'Preferisco di gran lunga la sensazione del "muscolo che brucia e si pompa" piuttosto che sollevare carichi molto pesanti, che spesso mi mettono a disagio.',
  },
  {
    id: "q611",
    type: "2B",
    text: "Mi alleno molto meglio quando ho una routine familiare e rassicurante, e non amo cambiamenti drastici o improvvisi nel programma di allenamento.",
  },
  {
    id: "q612",
    type: "2B",
    text: "Sono una persona molto empatica ed emotiva: se ho avuto una giornata difficile o un conflitto personale, le mie performance e la voglia di allenarmi calano drasticamente.",
  },
  // 3 — Structure / Analysis / Cortisol
  {
    id: "q613",
    type: "3",
    text: "Ho un bisogno assoluto di avere il mio allenamento pianificato in modo meticoloso prima di entrare in palestra; detesto improvvisare.",
  },
  {
    id: "q614",
    type: "3",
    text: "Mi sento ansioso/a o molto preoccupato/a prima di tentare esercizi che percepisco come rischiosi, molto complessi o in cui potrei fallire.",
  },
  {
    id: "q615",
    type: "3",
    text: "Prendo quasi sempre decisioni basate sulla logica, sui dati e su un'analisi approfondita, piuttosto che lasciarmi guidare da istinto o emozioni.",
  },
];

// ============= ANALYSIS HELPERS =============

export interface ProfilingResult {
  red_flags: {
    medical_clearance_required: boolean;
    medical_yes_questions: string[];
    fms_exclusion_zones: string[]; // 'spine' | 'lower_body' | 'upper_body' | 'general'
    reduced_systemic_volume: boolean;
  };
  experience_level: "beginner" | "intermediate" | "advanced";
  calibration_requirements: string[]; // e.g. '1RM_SQUAT', '1RM_BENCH', '1RM_DEADLIFT', '1RM_OHP', 'AMRAP'
  expectation_management_flag: boolean;
  dominant_neurotype: NeurotypType;
  neurotype_scores: Record<NeurotypType, number>;
}

export function analyzeOnboarding(data: OnboardingData): ProfilingResult {
  // Medical
  const medicalYes: string[] = [];
  (Object.keys(data.medical) as Array<keyof MedicalSafetyAnswers>).forEach((k) => {
    if (data.medical[k] === "yes") medicalYes.push(k);
  });

  // FMS exclusion zones
  const fmsZones: string[] = [];
  if (data.orthopedic.q21 === "yes") fmsZones.push("general");
  if (data.orthopedic.q22 === "yes") fmsZones.push("spine");
  if (data.orthopedic.q23 === "yes") fmsZones.push("lower_body");
  if (data.orthopedic.q24 === "yes") fmsZones.push("upper_body");

  // Experience level: count yes in sports area
  const sportsYes = (Object.values(data.sports) as Array<YesNoIDK | null>).filter(
    (v) => v === "yes",
  ).length;
  let experience: ProfilingResult["experience_level"] = "beginner";
  if (sportsYes >= 4) experience = "advanced";
  else if (sportsYes >= 2) experience = "intermediate";

  // Calibration requirements
  const calibration: string[] = [];
  if (data.goals.q53 === "yes") {
    calibration.push("1RM_SQUAT", "1RM_BENCH", "1RM_DEADLIFT");
  } else if (data.goals.q52 === "yes") {
    calibration.push("1RM_SQUAT", "1RM_BENCH", "1RM_DEADLIFT", "1RM_OHP", "AMRAP");
  }

  // Reduced systemic volume: high stress OR poor sleep
  const reducedVolume = data.lifestyle.q42 === "yes" || data.lifestyle.q43 === "no";

  // Expectation management
  const expectationFlag = data.goals.q54 === "yes";

  // Neurotype: count 'yes' per type
  const scores: Record<NeurotypType, number> = { "1A": 0, "1B": 0, "2A": 0, "2B": 0, "3": 0 };
  NEUROTYPING_QUESTIONS.forEach((q) => {
    const ans = (data.neurotyping as any)[q.id] as YesNoIDK | null;
    if (ans === "yes") scores[q.type] += 1;
  });
  const dominant = (Object.entries(scores) as [NeurotypType, number][]).sort(
    ([, a], [, b]) => b - a,
  )[0][0];

  return {
    red_flags: {
      medical_clearance_required: medicalYes.length > 0,
      medical_yes_questions: medicalYes,
      fms_exclusion_zones: fmsZones,
      reduced_systemic_volume: reducedVolume,
    },
    experience_level: experience,
    calibration_requirements: calibration,
    expectation_management_flag: expectationFlag,
    dominant_neurotype: dominant,
    neurotype_scores: scores,
  };
}

export const NEUROTYPE_LABELS: Record<NeurotypType, { name: string; description: string }> = {
  "1A": {
    name: "Type 1A — Neural Intensity",
    description:
      "Dominante, competitivo, guidato dalla dopamina. Risponde meglio a tensione meccanica, basse ripetizioni e carichi vicini al massimale.",
  },
  "1B": {
    name: "Type 1B — Explosiveness",
    description:
      "Reattivo, esplosivo, spinto dall'adrenalina. Eccelle in movimenti dinamici, lavoro di forza-velocità e varietà di stimoli.",
  },
  "2A": {
    name: "Type 2A — Variation",
    description:
      "Versatile, adattabile, motivato dalla varietà. Necessita di rotazione esercizi e nuovi stimoli ogni 3-4 settimane.",
  },
  "2B": {
    name: "Type 2B — Sensation",
    description:
      "Sensoriale, empatico, orientato alla connessione muscolo-mente. Predilige stress metabolico, pump e routine familiari.",
  },
  "3": {
    name: "Type 3 — Structure",
    description:
      "Analitico, metodico, avverso al rischio. Ottimale con programmi rigidi, progressioni lineari e dati misurabili.",
  },
};

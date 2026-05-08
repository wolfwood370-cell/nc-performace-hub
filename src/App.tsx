import { Suspense, lazy } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { SunThemeSync } from "@/components/logic/SunThemeSync";
import { OfflineSyncProvider } from "@/providers/OfflineSyncProvider";
import { InstallPrompt } from "@/components/mobile/InstallPrompt";
import { NetworkBadge } from "@/components/ui/NetworkBadge";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { SubscriptionGuard } from "@/components/auth/SubscriptionGuard";
import { SwUpdatePrompt } from "@/components/pwa/SwUpdatePrompt";
import { CelebrationOverlay } from "@/components/celebration/Confetti";


// Lazy-loaded pages
const Index = lazy(() => import("./pages/Index"));
const Auth = lazy(() => import("./pages/Auth"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const CoachHome = lazy(() => import("./pages/coach/CoachHome"));
const CoachAthletes = lazy(() => import("./pages/coach/CoachAthletes"));
const AthleteDetail = lazy(() => import("./pages/coach/AthleteDetail"));
const CoachCalendar = lazy(() => import("./pages/coach/CoachCalendar"));
const CoachMessages = lazy(() => import("./pages/coach/CoachMessages"));
const CoachAnalytics = lazy(() => import("./pages/coach/CoachAnalytics"));
const CoachSettings = lazy(() => import("./pages/coach/CoachSettings"));
const CoachBusiness = lazy(() => import("./pages/coach/CoachBusiness"));
const ProgramBuilder = lazy(() => import("./pages/coach/ProgramBuilder"));
const CoachLibrary = lazy(() => import("./pages/coach/CoachLibrary"));
const ExerciseDatabase = lazy(() => import("./pages/coach/ExerciseDatabase"));
const CoachCheckinInbox = lazy(() => import("./pages/coach/CoachCheckinInbox"));
const FmsScreening = lazy(() => import("./pages/coach/FmsScreening"));
const KnowledgeBase = lazy(() => import("./pages/coach/KnowledgeBase"));
const MasterCopilot = lazy(() => import("./pages/coach/MasterCopilot"));
const AthleteDashboard = lazy(() => import("./pages/athlete/AthleteDashboard"));
const AthleteTraining = lazy(() => import("./pages/athlete/AthleteTraining"));
const AthleteNutrition = lazy(() => import("./pages/athlete/AthleteNutrition"));
const AthleteTDEEAnalytics = lazy(() => import("./pages/athlete/AthleteTDEEAnalytics"));
const AthleteCopilot = lazy(() => import("./pages/athlete/AthleteCopilot"));
const AthleteCopilotMeal = lazy(() => import("./pages/athlete/AthleteCopilotMeal"));
const AthleteCopilotIntervention = lazy(() => import("./pages/athlete/AthleteCopilotIntervention"));
const AthleteMealAnalysis = lazy(() => import("./pages/athlete/AthleteMealAnalysis"));
const PaymentSuccess = lazy(() => import("./pages/athlete/PaymentSuccess"));
const WorkoutDebrief = lazy(() => import("./pages/athlete/WorkoutDebrief"));
const SupersetExecution = lazy(() => import("./pages/athlete/SupersetExecution"));
const ActiveWorkout = lazy(() => import("./pages/athlete/ActiveWorkout"));
const AthleteReadinessDetails = lazy(() => import("./pages/athlete/AthleteReadinessDetails"));
const DailyCheckin = lazy(() => import("./pages/athlete/DailyCheckin"));
const WeeklyCheckin = lazy(() => import("./pages/athlete/WeeklyCheckin"));
const Notifications = lazy(() => import("./pages/athlete/Notifications"));
const CoachChat = lazy(() => import("./pages/athlete/CoachChat"));
const FormAnalysis = lazy(() => import("./pages/athlete/FormAnalysis"));
const PlanUpdate = lazy(() => import("./pages/athlete/PlanUpdate"));
const AchievementStreak = lazy(() => import("./pages/athlete/AchievementStreak"));
const ACWRAnalysis = lazy(() => import("./pages/athlete/ACWRAnalysis"));
const AMRAPExecution = lazy(() => import("./pages/athlete/AMRAPExecution"));
const TodayPlan = lazy(() => import("./pages/athlete/TodayPlan"));
const AthleteTrainingMetrics = lazy(() => import("./pages/athlete/AthleteTrainingMetrics"));
const ExerciseExecution = lazy(() => import("./pages/athlete/ExerciseExecution"));
const ExerciseDetail = lazy(() => import("./pages/athlete/ExerciseDetail"));
const ExercisePreview = lazy(() => import("./pages/athlete/ExercisePreview"));
const WorkoutPhaseDetail = lazy(() => import("./pages/athlete/WorkoutPhaseDetail"));
import { AthleteLayout } from "./components/athlete/AthleteLayout";
const OnboardingWizard = lazy(() => import("./pages/onboarding/OnboardingWizard"));
const NutritionWizardStep1 = lazy(() => import("./pages/athlete/onboarding/NutritionWizardStep1"));
const NutritionWizardStep2 = lazy(() => import("./pages/athlete/onboarding/NutritionWizardStep2"));
const NutritionWizardStep3 = lazy(() => import("./pages/athlete/onboarding/NutritionWizardStep3"));
const NutritionWizardReveal = lazy(() => import("./pages/athlete/onboarding/NutritionWizardReveal"));
const NotFound = lazy(() => import("./pages/NotFound"));
const PrivacyPolicy = lazy(() => import("./pages/legal/PrivacyPolicy"));
const TermsOfService = lazy(() => import("./pages/legal/TermsOfService"));

const App = () => (
  <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false} forcedTheme="light">
    <OfflineSyncProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <NetworkBadge />
        <InstallPrompt />
        <SwUpdatePrompt />
        <CelebrationOverlay />

        <BrowserRouter>
          <Suspense fallback={<LoadingSpinner />}>
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/auth" element={<Auth />} />
              <Route path="/reset-password" element={<ResetPassword />} />
              
              {/* Coach Routes — wrapped in SubscriptionGuard */}
              <Route path="/coach" element={<SubscriptionGuard><CoachHome /></SubscriptionGuard>} />
              <Route path="/coach/athletes" element={<SubscriptionGuard><CoachAthletes /></SubscriptionGuard>} />
              <Route path="/coach/athlete/:id" element={<SubscriptionGuard><AthleteDetail /></SubscriptionGuard>} />
              <Route path="/coach/programs" element={<SubscriptionGuard><ProgramBuilder /></SubscriptionGuard>} />
              <Route path="/coach/calendar" element={<SubscriptionGuard><CoachCalendar /></SubscriptionGuard>} />
              <Route path="/coach/messages" element={<SubscriptionGuard><CoachMessages /></SubscriptionGuard>} />
              <Route path="/coach/library" element={<SubscriptionGuard><CoachLibrary /></SubscriptionGuard>} />
              <Route path="/coach/exercises" element={<SubscriptionGuard><ExerciseDatabase /></SubscriptionGuard>} />
              <Route path="/coach/analytics" element={<SubscriptionGuard><CoachAnalytics /></SubscriptionGuard>} />
              <Route path="/coach/business" element={<SubscriptionGuard><CoachBusiness /></SubscriptionGuard>} />
              <Route path="/coach/inbox" element={<SubscriptionGuard><CoachCheckinInbox /></SubscriptionGuard>} />
              <Route path="/coach/fms" element={<SubscriptionGuard><FmsScreening /></SubscriptionGuard>} />
              <Route path="/coach/knowledge" element={<SubscriptionGuard><KnowledgeBase /></SubscriptionGuard>} />
              <Route path="/coach/copilot" element={<SubscriptionGuard><MasterCopilot /></SubscriptionGuard>} />
              <Route path="/coach/settings" element={<SubscriptionGuard><CoachSettings /></SubscriptionGuard>} />
              
              {/* Athlete Routes */}
              <Route path="/athlete" element={<AthleteLayout />}>
                <Route index element={<Navigate to="/athlete/dashboard" replace />} />
                <Route path="dashboard" element={<AthleteDashboard />} />
                <Route path="readiness" element={<AthleteReadinessDetails />} />
                <Route path="checkin" element={<DailyCheckin />} />
                <Route path="checkin/weekly" element={<WeeklyCheckin />} />
                <Route path="notifications" element={<Notifications />} />
                <Route path="chat" element={<CoachChat />} />
                <Route path="form-analysis" element={<FormAnalysis />} />
                <Route path="plan-update" element={<PlanUpdate />} />
                <Route path="achievement-streak" element={<AchievementStreak />} />
                <Route path="acwr-analysis" element={<ACWRAnalysis />} />
                <Route path="amrap-execution" element={<AMRAPExecution />} />
                <Route path="today-plan" element={<TodayPlan />} />
                <Route path="training-metrics" element={<AthleteTrainingMetrics />} />
                <Route path="exercise-execution" element={<ExerciseExecution />} />
                <Route path="exercise-detail" element={<ExerciseDetail />} />
                <Route path="exercise-preview" element={<ExercisePreview />} />
                <Route path="workout/:workoutId/phase/:phaseIndex" element={<WorkoutPhaseDetail />} />
                <Route path="training" element={<AthleteTraining />} />
                <Route path="training/active" element={<ActiveWorkout />} />
                <Route path="nutrition" element={<AthleteNutrition />} />
                <Route path="copilot" element={<AthleteCopilot />} />
                <Route path="analytics/tdee" element={<AthleteTDEEAnalytics />} />
                <Route path="copilot/meal" element={<AthleteCopilotMeal />} />
                <Route path="copilot/intervention" element={<AthleteCopilotIntervention />} />
                <Route path="meal-analysis" element={<AthleteMealAnalysis />} />
                <Route path="payment-success" element={<PaymentSuccess />} />
                <Route path="workout/debrief" element={<WorkoutDebrief />} />
              </Route>
              {/* Legacy redirect */}
              <Route path="/athlete/workout" element={<Navigate to="/athlete/training" replace />} />
              <Route path="/athlete/workout/active" element={<Navigate to="/athlete/training/active" replace />} />
              
              {/* Onboarding */}
              <Route path="/onboarding" element={<OnboardingWizard />} />
              <Route path="/athlete/onboarding/nutrition/step-1" element={<NutritionWizardStep1 />} />
              <Route path="/athlete/onboarding/nutrition/step-2" element={<NutritionWizardStep2 />} />
              <Route path="/athlete/onboarding/nutrition/step-3" element={<NutritionWizardStep3 />} />
              <Route path="/athlete/onboarding/nutrition/reveal" element={<NutritionWizardReveal />} />
              
              {/* Legal */}
              <Route path="/privacy" element={<PrivacyPolicy />} />
              <Route path="/terms" element={<TermsOfService />} />
              
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </BrowserRouter>
      </TooltipProvider>
    </OfflineSyncProvider>
  </ThemeProvider>
);

export default App;

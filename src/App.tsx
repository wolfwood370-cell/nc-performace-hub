import { Suspense, lazy } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { SunThemeSync } from "@/components/logic/SunThemeSync";
import { OfflineSyncProvider } from "@/providers/OfflineSyncProvider";
import { InstallPrompt } from "@/components/mobile/InstallPrompt";
import { NetworkBadge } from "@/components/ui/NetworkBadge";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { SubscriptionGuard } from "@/components/auth/SubscriptionGuard";
import { ProtectedAthleteRoute } from "@/components/auth/ProtectedAthleteRoute";
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
const OnboardingWizard = lazy(() => import("./pages/onboarding/OnboardingWizard"));
const NotFound = lazy(() => import("./pages/NotFound"));
const PrivacyPolicy = lazy(() => import("./pages/legal/PrivacyPolicy"));
const TermsOfService = lazy(() => import("./pages/legal/TermsOfService"));

// Athlete App — fresh scaffold (Training + Readiness only; no nutrition).
const AthleteLayout = lazy(() => import("./components/athlete/AthleteLayout"));
const AthleteDashboard = lazy(() => import("./pages/athlete/AthleteDashboard"));
const AthleteTraining = lazy(() => import("./pages/athlete/AthleteTraining"));
const AthleteProfile = lazy(() => import("./pages/athlete/AthleteProfile"));
const DailyCheckin = lazy(() => import("./pages/athlete/DailyCheckin"));
const AthleteReadinessDetails = lazy(() => import("./pages/athlete/AthleteReadinessDetails"));
const WeeklyCheckin = lazy(() => import("./pages/athlete/WeeklyCheckin"));
const WorkoutPhaseDetail = lazy(() => import("./pages/athlete/WorkoutPhaseDetail"));
const ExercisePreview = lazy(() => import("./pages/athlete/ExercisePreview"));
const ActiveWorkout = lazy(() => import("./pages/athlete/ActiveWorkout"));
const PostWorkoutDebrief = lazy(() => import("./pages/athlete/PostWorkoutDebrief"));
const TrainingAnalytics = lazy(() => import("./pages/athlete/TrainingAnalytics"));
const AcwrAnalysis = lazy(() => import("./pages/athlete/AcwrAnalysis"));
const DailyReadiness = lazy(() => import("./pages/athlete/DailyReadiness"));

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
              
              {/* Athlete App — guarded shell + three pages.
                  ProtectedAthleteRoute handles: auth required, role===athlete,
                  onboarding_completed. Unauthenticated users → /auth; coaches
                  who land here → /coach. */}
              <Route
                path="/athlete"
                element={
                  <ProtectedAthleteRoute>
                    <AthleteLayout />
                  </ProtectedAthleteRoute>
                }
              >
                <Route index element={<AthleteDashboard />} />
                <Route path="training" element={<AthleteTraining />} />
                <Route path="profile" element={<AthleteProfile />} />
              </Route>

              {/* Daily Check-in — sibling of the layout, NOT a child, because
                  the page is a modal-style full-screen flow with its own
                  sticky bottom action bar that replaces the BottomNavBar. */}
              <Route
                path="/athlete/checkin"
                element={
                  <ProtectedAthleteRoute>
                    <DailyCheckin />
                  </ProtectedAthleteRoute>
                }
              />

              {/* Readiness Analysis — stack-pushed detail page with its own
                  back affordance; no bottom nav. Sibling, not child. */}
              <Route
                path="/athlete/readiness"
                element={
                  <ProtectedAthleteRoute>
                    <AthleteReadinessDetails />
                  </ProtectedAthleteRoute>
                }
              />

              {/* Weekly Check-in — focus-mode full-screen flow with its own
                  sticky bottom action bar. Sibling, not child (same reason
                  as DailyCheckin: two competing bottom bars otherwise). */}
              <Route
                path="/athlete/weekly-checkin"
                element={
                  <ProtectedAthleteRoute>
                    <WeeklyCheckin />
                  </ProtectedAthleteRoute>
                }
              />

              {/* Phase 6 — Session preview (phase overview) and single
                  exercise preview. Both are stack-pushed detail flows with
                  their own sticky CTA, so they sit as siblings of the
                  AthleteLayout rather than children. */}
              <Route
                path="/athlete/training/phase"
                element={
                  <ProtectedAthleteRoute>
                    <WorkoutPhaseDetail />
                  </ProtectedAthleteRoute>
                }
              />
              <Route
                path="/athlete/training/exercise"
                element={
                  <ProtectedAthleteRoute>
                    <ExercisePreview />
                  </ProtectedAthleteRoute>
                }
              />

              {/* Phase 7 — Active Workout Hub (focus mode).
                  Full-screen overlay (z-50) that intentionally obscures
                  the global BottomNavBar; back/X opens a friction modal
                  rather than navigating immediately. */}
              <Route
                path="/athlete/workout"
                element={
                  <ProtectedAthleteRoute>
                    <ActiveWorkout />
                  </ProtectedAthleteRoute>
                }
              />

              {/* Phase 9 — Post-workout debrief + deep analytics surfaces.
                  All stack-pushed detail flows; siblings of the layout
                  so they own their own headers / CTAs without the
                  global BottomNavBar competing. */}
              <Route
                path="/athlete/debrief"
                element={
                  <ProtectedAthleteRoute>
                    <PostWorkoutDebrief />
                  </ProtectedAthleteRoute>
                }
              />
              <Route
                path="/athlete/analytics"
                element={
                  <ProtectedAthleteRoute>
                    <TrainingAnalytics />
                  </ProtectedAthleteRoute>
                }
              />
              <Route
                path="/athlete/analytics/acwr"
                element={
                  <ProtectedAthleteRoute>
                    <AcwrAnalysis />
                  </ProtectedAthleteRoute>
                }
              />
              <Route
                path="/athlete/readiness/today"
                element={
                  <ProtectedAthleteRoute>
                    <DailyReadiness />
                  </ProtectedAthleteRoute>
                }
              />

              {/* Onboarding */}
              <Route path="/onboarding" element={<OnboardingWizard />} />
              
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

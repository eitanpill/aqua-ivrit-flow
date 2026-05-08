import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { lazy, Suspense } from "react";
import { Loader2 } from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { AdminRoute } from "@/components/auth/AdminRoute";
import { StaffRoute } from "@/components/auth/StaffRoute";
import { AuthProvider } from "@/hooks/useAuth";
import { SchoolProvider } from "@/contexts/SchoolContext";
import { DeviceProvider } from "@/hooks/useDeviceType";
import { DemoModeProvider } from "@/hooks/useDemoMode";
import { DemoBanner } from "@/components/layout/DemoBanner";
import { useAuth } from "@/hooks/useAuth";
import { useOnboardingCheck } from "@/hooks/useOnboardingCheck";

// Eagerly loaded - always needed
import Auth from "@/pages/Auth";
import Dashboard from "@/pages/Dashboard";
import NotFound from "@/pages/NotFound";

// Lazily loaded - split by route
const SetupSchool = lazy(() => import("@/pages/SetupSchool"));
const SubscriptionRequired = lazy(() => import("@/pages/SubscriptionRequired"));
const Welcome = lazy(() => import("@/pages/Welcome"));
const Locations = lazy(() => import("@/pages/Locations"));
const UsersPage = lazy(() => import("@/pages/UsersPage"));
const Settings = lazy(() => import("@/pages/Settings"));
const CustomerSettings = lazy(() => import("@/pages/CustomerSettings"));
const Pedagogy = lazy(() => import("@/pages/Pedagogy"));
const Products = lazy(() => import("@/pages/Products"));
const Calendar = lazy(() => import("@/pages/Calendar"));
const MyFamily = lazy(() => import("@/pages/MyFamily"));
const Booking = lazy(() => import("@/pages/Booking"));
const CoachDashboard = lazy(() => import("@/pages/CoachDashboard"));
const Billing = lazy(() => import("@/pages/Billing"));
const Reports = lazy(() => import("@/pages/Reports"));
const ScheduleBuilder = lazy(() => import("@/pages/ScheduleBuilder"));
const EnrollmentWizard = lazy(() => import("@/pages/EnrollmentWizard"));
const SkillsManagement = lazy(() => import("@/pages/SkillsManagement"));
const Substitutions = lazy(() => import("@/pages/Substitutions"));
const Onboarding = lazy(() => import("@/pages/Onboarding"));
const Payroll = lazy(() => import("@/pages/Payroll"));

function PageLoader() {
  return (
    <div className="flex items-center justify-center h-64">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  );
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 2, // 2 minutes before refetch
      gcTime: 1000 * 60 * 10,   // 10 minutes cache retention
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

// Settings route that shows appropriate page based on role
function SettingsRoute() {
  const { isAdmin } = useAuth();
  return isAdmin ? <Settings /> : <CustomerSettings />;
}

// Dashboard with onboarding check for admins
function DashboardWithOnboarding() {
  useOnboardingCheck();
  return <Dashboard />;
}

const App = () => (
  <ErrorBoundary>
  <QueryClientProvider client={queryClient}>
    <DeviceProvider>
      <BrowserRouter>
        <AuthProvider>
          <SchoolProvider>
            <TooltipProvider>
              <Toaster />
              <Sonner />
              <DemoModeProvider>
                <Suspense fallback={<PageLoader />}>
                <Routes>
                  <Route path="/auth" element={<Auth />} />
                  <Route path="/auth/setup-school" element={<SetupSchool />} />
                  <Route path="/auth/subscription" element={<SubscriptionRequired />} />
                  <Route path="/welcome" element={<Welcome />} />
                  <Route path="/" element={<Navigate to="/dashboard" replace />} />
                  <Route
                    path="/onboarding"
                    element={
                      <ProtectedRoute>
                        <Onboarding />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    element={
                      <ProtectedRoute>
                        <>
                          <DemoBanner />
                          <AppLayout />
                        </>
                      </ProtectedRoute>
                    }
                  >
                    {/* All authenticated users */}
                    <Route path="/dashboard" element={<DashboardWithOnboarding />} />
                    <Route path="/family" element={<MyFamily />} />
                    <Route path="/booking" element={<Booking />} />
                    <Route path="/billing" element={<Billing />} />
                    <Route path="/settings" element={<SettingsRoute />} />
                    
                    {/* Staff only (admin + coach) */}
                    <Route path="/calendar" element={<StaffRoute><Calendar /></StaffRoute>} />
                    <Route path="/coach" element={<StaffRoute><CoachDashboard /></StaffRoute>} />
                    <Route path="/substitutions" element={<StaffRoute><Substitutions /></StaffRoute>} />
                    
                    {/* Admin only */}
                    <Route path="/locations" element={<AdminRoute><Locations /></AdminRoute>} />
                    <Route path="/users" element={<AdminRoute><UsersPage /></AdminRoute>} />
                    <Route path="/pedagogy" element={<AdminRoute><Pedagogy /></AdminRoute>} />
                    <Route path="/products" element={<AdminRoute><Products /></AdminRoute>} />
                    <Route path="/reports" element={<AdminRoute><Reports /></AdminRoute>} />
                    <Route path="/schedule-builder" element={<AdminRoute><ScheduleBuilder /></AdminRoute>} />
                    <Route path="/enrollment-wizard" element={<AdminRoute><EnrollmentWizard /></AdminRoute>} />
                    <Route path="/skills-management" element={<AdminRoute><SkillsManagement /></AdminRoute>} />
                    <Route path="/payroll" element={<AdminRoute><Payroll /></AdminRoute>} />
                  </Route>
                  <Route path="*" element={<NotFound />} />
                </Routes>
                </Suspense>
              </DemoModeProvider>
            </TooltipProvider>
          </SchoolProvider>
        </AuthProvider>
      </BrowserRouter>
    </DeviceProvider>
  </QueryClientProvider>
  </ErrorBoundary>
);

export default App;

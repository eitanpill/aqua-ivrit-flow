import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { AdminRoute } from "@/components/auth/AdminRoute";
import { StaffRoute } from "@/components/auth/StaffRoute";
import { AuthProvider } from "@/hooks/useAuth";
import Auth from "@/pages/Auth";
import Dashboard from "@/pages/Dashboard";
import Locations from "@/pages/Locations";
import UsersPage from "@/pages/UsersPage";
import Settings from "@/pages/Settings";
import CustomerSettings from "@/pages/CustomerSettings";
import Pedagogy from "@/pages/Pedagogy";
import Products from "@/pages/Products";
import Calendar from "@/pages/Calendar";
import MyFamily from "@/pages/MyFamily";
import Booking from "@/pages/Booking";
import CoachDashboard from "@/pages/CoachDashboard";
import Billing from "@/pages/Billing";
import Reports from "@/pages/Reports";
import ScheduleBuilder from "@/pages/ScheduleBuilder";
import EnrollmentWizard from "@/pages/EnrollmentWizard";
import NotFound from "@/pages/NotFound";
import { useAuth } from "@/hooks/useAuth";

const queryClient = new QueryClient();

// Settings route that shows appropriate page based on role
function SettingsRoute() {
  const { isAdmin } = useAuth();
  return isAdmin ? <Settings /> : <CustomerSettings />;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/auth" element={<Auth />} />
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route
              element={
                <ProtectedRoute>
                  <AppLayout />
                </ProtectedRoute>
              }
            >
              {/* All authenticated users */}
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/family" element={<MyFamily />} />
              <Route path="/booking" element={<Booking />} />
              <Route path="/billing" element={<Billing />} />
              <Route path="/settings" element={<SettingsRoute />} />
              
              {/* Staff only (admin + coach) */}
              <Route path="/calendar" element={<StaffRoute><Calendar /></StaffRoute>} />
              <Route path="/coach" element={<StaffRoute><CoachDashboard /></StaffRoute>} />
              
              {/* Admin only */}
              <Route path="/locations" element={<AdminRoute><Locations /></AdminRoute>} />
              <Route path="/users" element={<AdminRoute><UsersPage /></AdminRoute>} />
              <Route path="/pedagogy" element={<AdminRoute><Pedagogy /></AdminRoute>} />
              <Route path="/products" element={<AdminRoute><Products /></AdminRoute>} />
              <Route path="/reports" element={<AdminRoute><Reports /></AdminRoute>} />
              <Route path="/schedule-builder" element={<AdminRoute><ScheduleBuilder /></AdminRoute>} />
              <Route path="/enrollment-wizard" element={<AdminRoute><EnrollmentWizard /></AdminRoute>} />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;

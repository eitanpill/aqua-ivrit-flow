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
import Pedagogy from "@/pages/Pedagogy";
import Products from "@/pages/Products";
import Calendar from "@/pages/Calendar";
import MyFamily from "@/pages/MyFamily";
import Booking from "@/pages/Booking";
import CoachDashboard from "@/pages/CoachDashboard";
import Billing from "@/pages/Billing";
import Reports from "@/pages/Reports";
import NotFound from "@/pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
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
              
              {/* Staff only (admin + coach) */}
              <Route path="/calendar" element={<StaffRoute><Calendar /></StaffRoute>} />
              <Route path="/coach" element={<StaffRoute><CoachDashboard /></StaffRoute>} />
              
              {/* Admin only */}
              <Route path="/locations" element={<AdminRoute><Locations /></AdminRoute>} />
              <Route path="/users" element={<AdminRoute><UsersPage /></AdminRoute>} />
              <Route path="/settings" element={<AdminRoute><Settings /></AdminRoute>} />
              <Route path="/pedagogy" element={<AdminRoute><Pedagogy /></AdminRoute>} />
              <Route path="/products" element={<AdminRoute><Products /></AdminRoute>} />
              <Route path="/reports" element={<AdminRoute><Reports /></AdminRoute>} />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;

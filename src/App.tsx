import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
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
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/calendar" element={<Calendar />} />
            <Route path="/locations" element={<Locations />} />
            <Route path="/users" element={<UsersPage />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/pedagogy" element={<Pedagogy />} />
            <Route path="/products" element={<Products />} />
            <Route path="/family" element={<MyFamily />} />
            <Route path="/booking" element={<Booking />} />
            <Route path="/coach" element={<CoachDashboard />} />
            <Route path="/billing" element={<Billing />} />
            <Route path="/reports" element={<Reports />} />
          </Route>
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;

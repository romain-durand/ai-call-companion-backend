import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import { DashboardLayout } from "@/components/DashboardLayout";
import Dashboard from "./pages/Dashboard";
import Assistant from "./pages/Assistant";
import Profiles from "./pages/Profiles";
import CallHistory from "./pages/CallHistory";
import CalendarPage from "./pages/CalendarPage";
import SettingsPage from "./pages/SettingsPage";
import TestAssistant from "./pages/TestAssistant";
import WhoCanReachMe from "./pages/WhoCanReachMe";
import HowToHandle from "./pages/HowToHandle";
import WhenToAlert from "./pages/WhenToAlert";
import Login from "./pages/Login";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route
              path="/*"
              element={
                <ProtectedRoute>
                  <DashboardLayout>
                    <Routes>
                      <Route path="/" element={<Dashboard />} />
                      <Route path="/assistant" element={<Assistant />} />
                      <Route path="/profiles" element={<Profiles />} />
                      <Route path="/who" element={<WhoCanReachMe />} />
                      <Route path="/how" element={<HowToHandle />} />
                      <Route path="/when" element={<WhenToAlert />} />
                      <Route path="/history" element={<CallHistory />} />
                      <Route path="/calendar" element={<CalendarPage />} />
                      <Route path="/settings" element={<SettingsPage />} />
                      {/* contacts moved under /who */}
                      <Route path="/test" element={<TestAssistant />} />
                      <Route path="*" element={<NotFound />} />
                    </Routes>
                  </DashboardLayout>
                </ProtectedRoute>
              }
            />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;

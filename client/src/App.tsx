import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { useQuery } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { WelcomeModal } from "@/components/welcome-modal";
import Landing from "@/pages/landing";
import UploadPage from "@/pages/upload";
import ResultsPage from "@/pages/results";
import HistoryPage from "@/pages/history";
import ScanDetailPage from "@/pages/scan-detail";
import OnboardingPage from "@/pages/onboarding";
import SettingsPage from "@/pages/settings";
import FeedbackPage from "@/pages/feedback";
import AdminPage from "@/pages/admin";
import AccountPage from "@/pages/account";
import NotFound from "@/pages/not-found";
import "./i18n/config";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import type { User } from "@shared/schema";
import { initGA } from "./lib/analytics";
import { useAnalytics } from "./hooks/use-analytics";

function ProtectedPage({ component: Component }: { component: any }) {
  const { isAuthenticated, isLoading } = useAuth();
  const { toast } = useToast();
  const { t } = useTranslation();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      toast({
        title: t("auth.required"),
        description: t("auth.accessDenied"),
        variant: "destructive",
      });
      setTimeout(() => {
        window.location.href = "/api/login";
      }, 500);
    }
  }, [isAuthenticated, isLoading, toast, t]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return <Component />;
}

function Router() {
  useAnalytics();
  
  return (
    <Switch>
      <Route path="/" component={Landing} />
      <Route path="/onboarding">
        <ProtectedPage component={OnboardingPage} />
      </Route>
      <Route path="/settings">
        <ProtectedPage component={SettingsPage} />
      </Route>
      <Route path="/upload">
        <ProtectedPage component={UploadPage} />
      </Route>
      <Route path="/results">
        <ProtectedPage component={ResultsPage} />
      </Route>
      <Route path="/history">
        <ProtectedPage component={HistoryPage} />
      </Route>
      <Route path="/history/:scanId">
        <ProtectedPage component={ScanDetailPage} />
      </Route>
      <Route path="/feedback" component={FeedbackPage} />
      <Route path="/account">
        <ProtectedPage component={AccountPage} />
      </Route>
      <Route path="/admin">
        <ProtectedPage component={AdminPage} />
      </Route>
      <Route component={NotFound} />
    </Switch>
  );
}

function AppContent() {
  const { user, isAuthenticated } = useAuth();

  return (
    <>
      <Router />
      {isAuthenticated && user && (
        <WelcomeModal user={user as User} />
      )}
    </>
  );
}

function App() {
  useEffect(() => {
    if (!import.meta.env.VITE_GA_MEASUREMENT_ID) {
      console.warn('Missing Google Analytics Measurement ID');
    } else {
      initGA();
    }
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <AppContent />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;

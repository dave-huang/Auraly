import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { useQuery } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import Landing from "@/pages/landing";
import UploadPage from "@/pages/upload";
import ResultsPage from "@/pages/results";
import HistoryPage from "@/pages/history";
import ScanDetailPage from "@/pages/scan-detail";
import OnboardingPage from "@/pages/onboarding";
import SettingsPage from "@/pages/settings";
import FeedbackPage from "@/pages/feedback";
import AdminPage from "@/pages/admin";
import NotFound from "@/pages/not-found";
import "./i18n/config";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";

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
      <Route path="/admin">
        <ProtectedPage component={AdminPage} />
      </Route>
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;

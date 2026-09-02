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
import "./i18n/config";
import { useEffect, lazy, Suspense } from "react";
import { useTranslation } from "react-i18next";
import type { User } from "@shared/schema";
import { initGA } from "./lib/analytics";
import { useAnalytics } from "./hooks/use-analytics";

const UploadPage = lazy(() => import("@/pages/upload"));
const ResultsPage = lazy(() => import("@/pages/results"));
const HistoryPage = lazy(() => import("@/pages/history"));
const ScanDetailPage = lazy(() => import("@/pages/scan-detail"));
const OnboardingPage = lazy(() => import("@/pages/onboarding"));
const SettingsPage = lazy(() => import("@/pages/settings"));
const FeedbackPage = lazy(() => import("@/pages/feedback"));
const AdminPage = lazy(() => import("@/pages/admin"));
const AccountPage = lazy(() => import("@/pages/account"));
const NotFound = lazy(() => import("@/pages/not-found"));

function PageLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
    </div>
  );
}

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
    return <PageLoader />;
  }

  if (!isAuthenticated) {
    return null;
  }

  return <Component />;
}

function Router() {
  useAnalytics();
  
  return (
    <Suspense fallback={<PageLoader />}>
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
    </Suspense>
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

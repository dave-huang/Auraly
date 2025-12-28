import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Sparkles, ScanLine, Sliders, History, ArrowRight, Lock } from "lucide-react";
import { Link } from "wouter";
import type { User } from "@shared/schema";

interface WelcomeModalProps {
  user: User;
}

export function WelcomeModal({ user }: WelcomeModalProps) {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (!user?.id) return;

    // Show welcome modal if user is on trial and hasn't completed onboarding
    // Uses database state instead of localStorage so deleting a user fully resets them
    if (user.subscriptionStatus === "trial" && user.onboardingCompleted === false) {
      const timer = setTimeout(() => {
        setIsOpen(true);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [user?.id, user?.subscriptionStatus, user?.onboardingCompleted]);

  const handleClose = () => {
    setIsOpen(false);
  };

  const handleStartScanning = () => {
    setIsOpen(false);
  };

  const benefits = [
    { icon: ScanLine, text: t('welcome.benefit1') },
    { icon: Sliders, text: t('welcome.benefit2') },
    { icon: History, text: t('welcome.benefit3') },
  ];

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="sm:max-w-md border-border/50 bg-background animate-in fade-in-0 zoom-in-95 duration-200">
        <DialogHeader className="text-center pb-1">
          <div className="mx-auto w-12 h-12 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center mb-3 ring-4 ring-primary/10">
            <Sparkles className="w-6 h-6 text-primary" />
          </div>
          <DialogTitle className="font-display text-2xl text-center">
            {t('welcome.title')}
          </DialogTitle>
          <DialogDescription className="sr-only">
            {t('welcome.welcomeIntro')}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-1">
          <p className="text-center text-sm text-foreground leading-relaxed">
            {t('welcome.welcomeIntro')}
          </p>

          <div className="rounded-xl bg-primary/5 border border-primary/10 p-4 shadow-sm">
            <div className="flex items-center gap-1.5 mb-3">
              <Sparkles className="w-3.5 h-3.5 text-primary" />
              <p className="text-xs font-medium text-primary">
                {t('welcome.includedWith')}
              </p>
            </div>
            <div className="space-y-2.5">
              {benefits.map((benefit, index) => (
                <div key={index} className="flex items-center gap-2.5">
                  <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <benefit.icon className="w-3.5 h-3.5 text-primary" />
                  </div>
                  <p className="text-sm text-foreground">{benefit.text}</p>
                </div>
              ))}
            </div>
          </div>

          <p className="text-xs text-muted-foreground leading-relaxed">
            {t('welcome.afterTrial')}
          </p>
        </div>

        <div className="pt-2 space-y-2">
          <Link href="/onboarding" onClick={handleStartScanning}>
            <Button className="w-full rounded-full gap-2" size="lg" data-testid="button-welcome-start">
              {t('welcome.startMyTrial')}
              <ArrowRight className="w-4 h-4" />
            </Button>
          </Link>
          <div className="flex items-center justify-center gap-1.5">
            <Lock className="w-3 h-3 text-muted-foreground" />
            <p className="text-xs text-muted-foreground">
              {t('landing.hero.trust.noCreditCard')}
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

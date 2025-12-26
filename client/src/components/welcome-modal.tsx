import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Sparkles, Check, ArrowRight } from "lucide-react";
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

    const storageKey = `auraly_welcome_seen_${user.id}`;
    const hasSeenWelcome = localStorage.getItem(storageKey);

    if (!hasSeenWelcome && user.subscriptionStatus === "trial") {
      const timer = setTimeout(() => {
        setIsOpen(true);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [user?.id, user?.subscriptionStatus]);

  const handleClose = () => {
    if (user?.id) {
      localStorage.setItem(`auraly_welcome_seen_${user.id}`, "true");
    }
    setIsOpen(false);
  };

  const handleStartScanning = () => {
    handleClose();
  };

  const benefits = [
    t('welcome.benefit1'),
    t('welcome.benefit2'),
    t('welcome.benefit3'),
  ];

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="sm:max-w-md border-border/50 bg-background">
        <DialogHeader className="text-center pb-1">
          <div className="mx-auto w-14 h-14 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center mb-3 ring-4 ring-primary/10">
            <Sparkles className="w-7 h-7 text-primary" />
          </div>
          <DialogTitle className="font-display text-2xl text-center">
            {t('welcome.title')}
          </DialogTitle>
          <DialogDescription className="sr-only">
            {t('welcome.trialDescription')}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-1">
          <p className="text-center text-muted-foreground">
            {t('welcome.trialDescription')}
          </p>

          <div className="rounded-xl bg-card/40 border border-border/30 p-4">
            <p className="text-sm font-medium text-foreground mb-3">
              {t('welcome.benefitsHeading')}
            </p>
            <div className="space-y-2">
              {benefits.map((benefit, index) => (
                <div key={index} className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-primary flex-shrink-0" />
                  <p className="text-sm text-muted-foreground">{benefit}</p>
                </div>
              ))}
            </div>
          </div>

          <p className="text-sm text-muted-foreground leading-relaxed">
            {t('welcome.afterTrial')}
          </p>
        </div>

        <div className="pt-1 space-y-2">
          <Link href="/onboarding" onClick={handleStartScanning}>
            <Button className="w-full rounded-full gap-2" size="lg" data-testid="button-welcome-start">
              {t('welcome.getStarted')}
              <ArrowRight className="w-4 h-4" />
            </Button>
          </Link>
          <p className="text-center text-xs text-muted-foreground">
            {t('landing.hero.trust.noCreditCard')}
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}

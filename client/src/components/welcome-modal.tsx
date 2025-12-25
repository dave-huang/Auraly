import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Sparkles, ScanLine, Sliders, History, ArrowRight } from "lucide-react";
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
    { icon: ScanLine, text: t('welcome.benefit1') },
    { icon: Sliders, text: t('welcome.benefit2') },
    { icon: History, text: t('welcome.benefit3') },
  ];

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="sm:max-w-md border-border/50 bg-background">
        <DialogHeader className="text-center pb-2">
          <div className="mx-auto w-16 h-16 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center mb-4 ring-4 ring-primary/10">
            <Sparkles className="w-8 h-8 text-primary" />
          </div>
          <DialogTitle className="font-display text-2xl text-center">
            {t('welcome.title')}
          </DialogTitle>
          <DialogDescription className="sr-only">
            {t('welcome.trialDescription')}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-2">
          <p className="text-center text-muted-foreground">
            {t('welcome.trialDescription')}
          </p>

          <div className="grid gap-3">
            {benefits.map((benefit, index) => (
              <div 
                key={index}
                className="flex items-center gap-4 p-3 rounded-xl bg-card/60 border border-border/30"
              >
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <benefit.icon className="w-5 h-5 text-primary" />
                </div>
                <p className="text-sm text-foreground font-medium">{benefit.text}</p>
              </div>
            ))}
          </div>

          <p className="text-center text-sm text-muted-foreground">
            {t('welcome.afterTrial')}
          </p>
        </div>

        <div className="pt-2 space-y-3">
          <Link href="/upload" onClick={handleStartScanning}>
            <Button className="w-full rounded-full gap-2" size="lg" data-testid="button-welcome-start">
              {t('welcome.startScanning')}
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

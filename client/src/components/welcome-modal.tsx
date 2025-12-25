import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Sparkles, Check, Heart, ArrowRight } from "lucide-react";
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

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="sm:max-w-md border-border/50 bg-background">
        <DialogHeader className="text-center pb-2">
          <div className="mx-auto w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mb-4">
            <Sparkles className="w-7 h-7 text-primary" />
          </div>
          <DialogTitle className="font-display text-2xl text-center">
            {t('welcome.title')}
          </DialogTitle>
          <DialogDescription className="text-center text-muted-foreground leading-relaxed sr-only">
            {t('welcome.trialDescription')}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          <p className="text-center text-muted-foreground leading-relaxed" aria-hidden="true">
            {t('welcome.trialDescription')}
          </p>

          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <div className="w-5 h-5 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center flex-shrink-0 mt-0.5">
                <Check className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
              </div>
              <p className="text-sm text-foreground">{t('welcome.benefit1')}</p>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-5 h-5 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center flex-shrink-0 mt-0.5">
                <Check className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
              </div>
              <p className="text-sm text-foreground">{t('welcome.benefit2')}</p>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-5 h-5 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center flex-shrink-0 mt-0.5">
                <Check className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
              </div>
              <p className="text-sm text-foreground">{t('welcome.benefit3')}</p>
            </div>
          </div>

          <div className="bg-card/60 rounded-xl p-4 border border-border/30">
            <p className="text-sm text-muted-foreground leading-relaxed">
              {t('welcome.afterTrial')}
            </p>
          </div>

          <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <Heart className="w-4 h-4 text-primary/60" />
            <span>{t('welcome.continueMessage')}</span>
          </div>
        </div>

        <div className="pt-2">
          <Link href="/upload" onClick={handleStartScanning}>
            <Button className="w-full rounded-full gap-2" size="lg" data-testid="button-welcome-start">
              {t('welcome.startScanning')}
              <ArrowRight className="w-4 h-4" />
            </Button>
          </Link>
        </div>
      </DialogContent>
    </Dialog>
  );
}

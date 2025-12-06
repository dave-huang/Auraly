import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Sparkles, Shield, Zap, Camera, Leaf } from "lucide-react";
import { useTranslation } from "react-i18next";
import { LanguageSwitcher } from "@/components/language-switcher";
import { NavigationMenu } from "@/components/navigation-menu";
import { useAuth } from "@/hooks/useAuth";

export default function Landing() {
  const { t } = useTranslation();
  const { isAuthenticated } = useAuth();
  
  return (
    <div className="min-h-screen bg-background">
      {/* Header - Language Switcher (logged out) or Navigation Menu (logged in) */}
      <div className="fixed top-6 right-6 z-50 flex items-center gap-2">
        {isAuthenticated ? (
          <NavigationMenu />
        ) : (
          <LanguageSwitcher />
        )}
      </div>

      {/* Hero Section - Serene and spacious */}
      <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
        {/* Subtle organic background shapes */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-primary/5 rounded-full blur-3xl translate-x-1/3 -translate-y-1/4" />
          <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-accent/30 rounded-full blur-3xl -translate-x-1/3 translate-y-1/4" />
        </div>

        {/* Content */}
        <div className="relative z-10 max-w-3xl mx-auto px-6 text-center">
          {/* Brand mark */}
          <div className="mb-10 inline-flex flex-col items-center">
            <div className="flex items-center gap-2.5 mb-8">
              <div className="p-2.5 bg-primary/10 rounded-full">
                <Leaf className="w-5 h-5 text-primary" />
              </div>
              <span className="text-label">{t('landing.hero.guardian')}</span>
            </div>
            <h1 className="font-display text-5xl md:text-6xl lg:text-7xl text-foreground mb-6">
              {t('app.title')}
            </h1>
          </div>

          {/* Tagline - generous line height */}
          <p className="text-lg md:text-xl text-muted-foreground max-w-xl mx-auto mb-12 leading-relaxed">
            {t('landing.hero.subtitle')}
          </p>

          {/* CTA Button - refined and elegant */}
          {isAuthenticated ? (
            <Link href="/upload" data-testid="link-upload">
              <Button 
                size="lg" 
                className="rounded-full px-10 py-6 text-base font-medium shadow-md hover:shadow-lg transition-all duration-300 gap-3"
                data-testid="button-start-scanning"
              >
                <Camera className="w-4 h-4" />
                {t('landing.hero.cta')}
              </Button>
            </Link>
          ) : (
            <Button
              size="lg"
              className="rounded-full px-10 py-6 text-base font-medium shadow-md hover:shadow-lg transition-all duration-300 gap-3"
              onClick={() => window.location.href = "/api/login"}
              data-testid="button-login"
            >
              <Camera className="w-4 h-4" />
              {t('auth.signIn')}
            </Button>
          )}

          {/* Trust indicators - minimal and elegant */}
          <div className="mt-16 flex flex-wrap items-center justify-center gap-10 text-sm">
            <div className="flex items-center gap-2.5 text-muted-foreground">
              <Zap className="w-4 h-4 text-primary/70" />
              <span className="font-light">{t('landing.hero.trust.instant')}</span>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works - Clean with generous spacing */}
      <section className="section-spacing bg-card/40">
        <div className="max-w-4xl mx-auto px-6">
          <div className="text-center mb-16">
            <p className="text-label mb-3">{t('landing.howItWorks.subtitle')}</p>
            <h2 className="font-display text-3xl md:text-4xl">{t('landing.howItWorks.title')}</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-12 md:gap-8">
            {/* Step 1 */}
            <div className="flex flex-col items-center text-center">
              <div className="w-20 h-20 rounded-full bg-primary/8 flex items-center justify-center mb-6 border border-primary/10">
                <Camera className="w-8 h-8 text-primary/80" />
              </div>
              <h3 className="text-lg font-medium mb-3">{t('landing.howItWorks.step1.title')}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{t('landing.howItWorks.step1.description')}</p>
            </div>

            {/* Step 2 */}
            <div className="flex flex-col items-center text-center">
              <div className="w-20 h-20 rounded-full bg-primary/8 flex items-center justify-center mb-6 border border-primary/10">
                <Sparkles className="w-8 h-8 text-primary/80" />
              </div>
              <h3 className="text-lg font-medium mb-3">{t('landing.howItWorks.step2.title')}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{t('landing.howItWorks.step2.description')}</p>
            </div>

            {/* Step 3 */}
            <div className="flex flex-col items-center text-center">
              <div className="w-20 h-20 rounded-full bg-primary/8 flex items-center justify-center mb-6 border border-primary/10">
                <Shield className="w-8 h-8 text-primary/80" />
              </div>
              <h3 className="text-lg font-medium mb-3">{t('landing.howItWorks.step3.title')}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{t('landing.howItWorks.step3.description')}</p>
            </div>
          </div>
        </div>
      </section>

      {/* Features - Elegant cards with subtle styling */}
      <section className="section-spacing">
        <div className="max-w-4xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="font-display text-3xl md:text-4xl">{t('landing.features.title')}</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="p-8 rounded-lg bg-card/60 border border-border/50 hover-elevate transition-all duration-300 text-center">
              <div className="w-12 h-12 bg-primary/8 rounded-full flex items-center justify-center mx-auto mb-5">
                <Leaf className="w-5 h-5 text-primary/80" />
              </div>
              <h3 className="font-medium mb-2">{t('landing.features.multilang.title')}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{t('landing.features.multilang.description')}</p>
            </div>

            <div className="p-8 rounded-lg bg-card/60 border border-border/50 hover-elevate transition-all duration-300 text-center">
              <div className="w-12 h-12 bg-primary/8 rounded-full flex items-center justify-center mx-auto mb-5">
                <Sparkles className="w-5 h-5 text-primary/80" />
              </div>
              <h3 className="font-medium mb-2">{t('landing.features.smart.title')}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{t('landing.features.smart.description')}</p>
            </div>

            <div className="p-8 rounded-lg bg-card/60 border border-border/50 hover-elevate transition-all duration-300 text-center">
              <div className="w-12 h-12 bg-primary/8 rounded-full flex items-center justify-center mx-auto mb-5">
                <Shield className="w-5 h-5 text-primary/80" />
              </div>
              <h3 className="font-medium mb-2">{t('landing.features.risk.title')}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{t('landing.features.risk.description')}</p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer - Minimal and refined */}
      <footer className="py-16 text-center border-t border-border/30">
        <p className="font-display text-xl mb-2">{t('app.title')}</p>
        <p className="text-xs text-muted-foreground font-light">{t('landing.footer.tagline')}</p>
      </footer>
    </div>
  );
}

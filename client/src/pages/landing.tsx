import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Sparkles, Shield, Zap, Camera, Globe } from "lucide-react";
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
      <div className="fixed top-4 right-4 z-50 flex items-center gap-2">
        {isAuthenticated ? (
          <NavigationMenu />
        ) : (
          <LanguageSwitcher />
        )}
      </div>

      {/* Hero Section */}
      <section className="relative min-h-[90vh] flex items-center justify-center overflow-hidden pt-20">
        {/* Background gradient blobs */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -top-1/2 -right-1/2 w-full h-full bg-primary/8 rounded-full blur-3xl" />
          <div className="absolute -bottom-1/2 -left-1/2 w-full h-full bg-primary/5 rounded-full blur-3xl" />
        </div>

        {/* Content */}
        <div className="relative z-10 max-w-5xl mx-auto px-4 text-center">
          {/* Logo/Brand */}
          <div className="mb-6 inline-block">
            <div className="flex items-center justify-center gap-2 mb-2">
              <div className="p-2 bg-primary/10 rounded-lg">
                <Shield className="w-5 h-5 text-primary" />
              </div>
              <span className="text-sm font-semibold text-primary">{t('landing.hero.guardian')}</span>
            </div>
            <h1 className="font-serif text-5xl md:text-6xl font-bold text-foreground tracking-tight">
              {t('app.title')}
            </h1>
          </div>

          {/* Main headline - simple and bold */}
          <p className="text-xl md:text-2xl text-muted-foreground max-w-3xl mx-auto mb-8 leading-relaxed">
            {t('landing.hero.subtitle')}
          </p>

          {/* CTA Button */}
          {isAuthenticated ? (
            <Link href="/upload" data-testid="link-upload">
              <Button 
                size="lg" 
                className="rounded-full px-10 py-7 text-lg font-semibold shadow-lg hover:shadow-xl transition-all gap-2"
                data-testid="button-start-scanning"
              >
                <Camera className="w-5 h-5" />
                {t('landing.hero.cta')}
              </Button>
            </Link>
          ) : (
            <Button
              size="lg"
              className="rounded-full px-10 py-7 text-lg font-semibold shadow-lg hover:shadow-xl transition-all gap-2"
              onClick={() => window.location.href = "/api/login"}
              data-testid="button-login"
            >
              <Camera className="w-5 h-5" />
              {t('auth.signIn')}
            </Button>
          )}

          {/* Trust indicators - simplified */}
          <div className="mt-12 flex flex-wrap items-center justify-center gap-8 text-sm">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Zap className="w-4 h-4 text-primary flex-shrink-0" />
              <span>{t('landing.hero.trust.instant')}</span>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <Sparkles className="w-4 h-4 text-primary flex-shrink-0" />
              <span>{t('landing.hero.trust.noAccount')}</span>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works - Visual Steps */}
      <section className="py-24 bg-card/50">
        <div className="max-w-5xl mx-auto px-4">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-4">{t('landing.howItWorks.title')}</h2>
          <p className="text-center text-muted-foreground mb-16">{t('landing.howItWorks.subtitle')}</p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Step 1 */}
            <div className="relative">
              <div className="flex flex-col items-center text-center">
                <div className="w-20 h-20 rounded-full bg-primary/15 flex items-center justify-center mb-6 relative z-10 border-2 border-primary/20">
                  <Camera className="w-10 h-10 text-primary" />
                </div>
                <h3 className="text-lg font-semibold mb-2">{t('landing.howItWorks.step1.title')}</h3>
                <p className="text-sm text-muted-foreground">{t('landing.howItWorks.step1.description')}</p>
              </div>
              {/* Connector line */}
              <div className="hidden md:block absolute top-10 left-[60%] w-[80%] h-0.5 bg-gradient-to-r from-primary/50 to-transparent" />
            </div>

            {/* Step 2 */}
            <div className="relative">
              <div className="flex flex-col items-center text-center">
                <div className="w-20 h-20 rounded-full bg-primary/15 flex items-center justify-center mb-6 relative z-10 border-2 border-primary/20">
                  <Sparkles className="w-10 h-10 text-primary" />
                </div>
                <h3 className="text-lg font-semibold mb-2">{t('landing.howItWorks.step2.title')}</h3>
                <p className="text-sm text-muted-foreground">{t('landing.howItWorks.step2.description')}</p>
              </div>
              {/* Connector line */}
              <div className="hidden md:block absolute top-10 left-[60%] w-[80%] h-0.5 bg-gradient-to-r from-primary/50 to-transparent" />
            </div>

            {/* Step 3 */}
            <div>
              <div className="flex flex-col items-center text-center">
                <div className="w-20 h-20 rounded-full bg-primary/15 flex items-center justify-center mb-6 relative z-10 border-2 border-primary/20">
                  <Shield className="w-10 h-10 text-primary" />
                </div>
                <h3 className="text-lg font-semibold mb-2">{t('landing.howItWorks.step3.title')}</h3>
                <p className="text-sm text-muted-foreground">{t('landing.howItWorks.step3.description')}</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features - Quick highlights */}
      <section className="py-24">
        <div className="max-w-5xl mx-auto px-4">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-16">{t('landing.features.title')}</h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="p-8 hover-elevate transition-all text-center bg-card/50">
              <div className="w-14 h-14 bg-primary/10 rounded-lg flex items-center justify-center mx-auto mb-4">
                <Globe className="w-7 h-7 text-primary" />
              </div>
              <h3 className="font-semibold mb-2">{t('landing.features.multilang.title')}</h3>
              <p className="text-sm text-muted-foreground">{t('landing.features.multilang.description')}</p>
            </Card>

            <Card className="p-8 hover-elevate transition-all text-center bg-card/50">
              <div className="w-14 h-14 bg-primary/10 rounded-lg flex items-center justify-center mx-auto mb-4">
                <Sparkles className="w-7 h-7 text-primary" />
              </div>
              <h3 className="font-semibold mb-2">{t('landing.features.smart.title')}</h3>
              <p className="text-sm text-muted-foreground">{t('landing.features.smart.description')}</p>
            </Card>

            <Card className="p-8 hover-elevate transition-all text-center bg-card/50">
              <div className="w-14 h-14 bg-primary/10 rounded-lg flex items-center justify-center mx-auto mb-4">
                <Shield className="w-7 h-7 text-primary" />
              </div>
              <h3 className="font-semibold mb-2">{t('landing.features.risk.title')}</h3>
              <p className="text-sm text-muted-foreground">{t('landing.features.risk.description')}</p>
            </Card>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 text-center border-t">
        <p className="font-serif text-xl font-bold mb-1">{t('app.title')}</p>
        <p className="text-xs text-muted-foreground">{t('landing.footer.tagline')}</p>
      </footer>
    </div>
  );
}

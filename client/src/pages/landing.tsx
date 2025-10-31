import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Sparkles, Shield, Zap, Camera, Globe, Lock } from "lucide-react";
import { useTranslation } from "react-i18next";
import { LanguageSwitcher } from "@/components/language-switcher";

export default function Landing() {
  const { t } = useTranslation();
  
  return (
    <div className="min-h-screen bg-background">
      {/* Language Switcher - Fixed position */}
      <div className="fixed top-4 right-4 z-50">
        <LanguageSwitcher />
      </div>

      {/* Hero Section */}
      <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
        {/* Background gradient */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-background to-accent/5" />
        
        {/* Decorative elements */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -top-1/2 -right-1/2 w-full h-full bg-primary/5 rounded-full blur-3xl" />
          <div className="absolute -bottom-1/2 -left-1/2 w-full h-full bg-accent/5 rounded-full blur-3xl" />
        </div>

        {/* Content */}
        <div className="relative z-10 max-w-6xl mx-auto px-4 py-20 text-center">
          {/* Logo/Brand */}
          <div className="mb-8">
            <h1 className="font-serif text-4xl md:text-5xl font-bold text-foreground mb-2 tracking-tight">
              {t('app.title')}
            </h1>
            <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
              <Shield className="w-4 h-4" />
              <span>{t('landing.hero.guardian')}</span>
            </div>
          </div>

          {/* Main headline */}
          <h2 className="text-5xl md:text-6xl font-bold tracking-tight mb-8 pb-2 bg-gradient-to-br from-foreground to-foreground/70 bg-clip-text text-transparent">{t('landing.hero.title')}</h2>

          {/* Subtext */}
          <p className="text-lg md:text-xl text-muted-foreground max-w-3xl mx-auto mb-12">
            {t('landing.hero.subtitle')}
          </p>

          {/* CTA Button */}
          <Link href="/upload" data-testid="link-upload">
            <Button 
              size="lg" 
              className="rounded-full px-8 py-6 text-lg font-semibold shadow-lg hover:shadow-xl transition-all"
              data-testid="button-start-scanning"
            >
              <Camera className="mr-2 h-5 w-5" />
              {t('landing.hero.cta')}
            </Button>
          </Link>

          {/* Trust indicators */}
          <div className="mt-8 flex flex-wrap items-center justify-center gap-6 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <Lock className="w-4 h-4 text-primary" />
              <span>{t('landing.hero.trust.privacy')}</span>
            </div>
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-primary" />
              <span>{t('landing.hero.trust.noAccount')}</span>
            </div>
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-primary" />
              <span>{t('landing.hero.trust.instant')}</span>
            </div>
          </div>
        </div>
      </section>
      {/* How It Works Section */}
      <section className="py-20 bg-card">
        <div className="max-w-6xl mx-auto px-4">
          <h3 className="text-3xl md:text-4xl font-bold text-center mb-4">
            {t('landing.howItWorks.title')}
          </h3>
          <p className="text-center text-muted-foreground mb-16 max-w-2xl mx-auto">
            {t('landing.howItWorks.subtitle')}
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Step 1 */}
            <div className="text-center">
              <div className="relative mb-6">
                <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
                  <Camera className="w-8 h-8 text-primary" />
                </div>
                <div className="absolute -top-2 -right-2 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold mx-auto left-0 right-0 w-fit">
                  1
                </div>
              </div>
              <h4 className="text-xl font-semibold mb-3">{t('landing.howItWorks.step1.title')}</h4>
              <p className="text-muted-foreground">
                {t('landing.howItWorks.step1.description')}
              </p>
            </div>

            {/* Step 2 */}
            <div className="text-center">
              <div className="relative mb-6">
                <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
                  <Sparkles className="w-8 h-8 text-primary" />
                </div>
                <div className="absolute -top-2 -right-2 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold mx-auto left-0 right-0 w-fit">
                  2
                </div>
              </div>
              <h4 className="text-xl font-semibold mb-3">{t('landing.howItWorks.step2.title')}</h4>
              <p className="text-muted-foreground">
                {t('landing.howItWorks.step2.description')}
              </p>
            </div>

            {/* Step 3 */}
            <div className="text-center">
              <div className="relative mb-6">
                <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
                  <Shield className="w-8 h-8 text-primary" />
                </div>
                <div className="absolute -top-2 -right-2 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold mx-auto left-0 right-0 w-fit">
                  3
                </div>
              </div>
              <h4 className="text-xl font-semibold mb-3">{t('landing.howItWorks.step3.title')}</h4>
              <p className="text-muted-foreground">
                {t('landing.howItWorks.step3.description')}
              </p>
            </div>
          </div>
        </div>
      </section>
      {/* Features Section */}
      <section className="py-20">
        <div className="max-w-6xl mx-auto px-4">
          <h3 className="text-3xl md:text-4xl font-bold text-center mb-16">
            {t('landing.features.title')}
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="p-6 hover-elevate transition-all text-center">
              <Globe className="w-10 h-10 text-primary mb-4 mx-auto" />
              <h4 className="text-lg font-semibold mb-2">{t('landing.features.multilang.title')}</h4>
              <p className="text-sm text-muted-foreground">
                {t('landing.features.multilang.description')}
              </p>
            </Card>

            <Card className="p-6 hover-elevate transition-all text-center">
              <Shield className="w-10 h-10 text-primary mb-4 mx-auto" />
              <h4 className="text-lg font-semibold mb-2">{t('landing.features.risk.title')}</h4>
              <p className="text-sm text-muted-foreground">
                {t('landing.features.risk.description')}
              </p>
            </Card>

            <Card className="p-6 hover-elevate transition-all text-center">
              <Sparkles className="w-10 h-10 text-primary mb-4 mx-auto" />
              <h4 className="text-lg font-semibold mb-2">{t('landing.features.smart.title')}</h4>
              <p className="text-sm text-muted-foreground">
                {t('landing.features.smart.description')}
              </p>
            </Card>
          </div>
        </div>
      </section>
      {/* Privacy Section */}
      <section className="py-16 bg-muted/30">
        <div className="max-w-3xl mx-auto px-4 text-center">
          <Lock className="w-12 h-12 text-primary mx-auto mb-4" />
          <h3 className="text-2xl md:text-3xl font-bold mb-4">
            {t('landing.privacy.title')}
          </h3>
          <p className="text-muted-foreground mb-6">
            {t('landing.privacy.description')}
          </p>
          <div className="flex flex-wrap justify-center gap-4 text-sm">
            <div className="flex items-center gap-2 bg-background px-4 py-2 rounded-lg">
              <div className="w-2 h-2 rounded-full bg-primary" />
              <span>{t('landing.privacy.features.noAccount')}</span>
            </div>
            <div className="flex items-center gap-2 bg-background px-4 py-2 rounded-lg">
              <div className="w-2 h-2 rounded-full bg-primary" />
              <span>{t('landing.privacy.features.notStored')}</span>
            </div>
            <div className="flex items-center gap-2 bg-background px-4 py-2 rounded-lg">
              <div className="w-2 h-2 rounded-full bg-primary" />
              <span>{t('landing.privacy.features.localOnly')}</span>
            </div>
          </div>
        </div>
      </section>
      {/* Footer */}
      <footer className="py-12 border-t">
        <div className="max-w-6xl mx-auto px-4 text-center">
          <p className="font-serif text-2xl font-bold mb-2">{t('app.title')}</p>
          <p className="text-sm text-muted-foreground mb-4">
            {t('landing.footer.tagline')}
          </p>
          <p className="text-xs text-muted-foreground">
            {t('landing.footer.copyright')}
          </p>
        </div>
      </footer>
    </div>
  );
}

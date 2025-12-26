import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Sparkles, Shield, Camera, Leaf, Globe, ArrowRight, Check } from "lucide-react";
import { useTranslation } from "react-i18next";
import { LanguageSwitcher } from "@/components/language-switcher";
import { NavigationMenu } from "@/components/navigation-menu";
import { useAuth } from "@/hooks/useAuth";

import phoneScanImage from "@assets/Gemini_Generated_Image_jemw1wjemw1wjemw_1765241060713.png";
import skincareImage from "@assets/stock_images/natural_skincare_pro_821a26b5.jpg";
import organicFoodImage from "@assets/stock_images/healthy_organic_food_ca6a79e0.jpg";
import womanReadingLabel from "@assets/stock_images/woman_reading_produc_8340e9f2.jpg";
import heroSkincareImage from "@assets/image_1765003551521.png";
import featureMultilangImage from "@assets/image_1765003664657.png";

export default function Landing() {
  const { t } = useTranslation();
  const { isAuthenticated } = useAuth();
  
  return (
    <div className="min-h-screen bg-background overflow-x-hidden">
      {/* Header */}
      <div className="fixed top-6 right-6 z-50 flex items-center gap-3">
        {isAuthenticated ? (
          <NavigationMenu />
        ) : (
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.location.href = "/api/login"}
              className="rounded-full px-5 border-primary/40 text-primary hover:bg-primary/5 hover:border-primary/60"
              data-testid="link-signin"
            >
              {t('auth.signInShort')}
            </Button>
            <LanguageSwitcher />
          </>
        )}
      </div>

      {/* Hero Section - Visual-first with layered imagery */}
      <section className="relative min-h-screen flex items-center overflow-hidden">
        {/* Background imagery layer */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute top-0 right-0 w-[55%] h-full">
            <div className="absolute inset-0 bg-gradient-to-l from-transparent via-background/50 to-background z-10" />
            <img 
              src={womanReadingLabel} 
              alt="Mindful ingredient awareness" 
              className="w-full h-full object-cover object-center opacity-40"
            />
          </div>
          <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-primary/5 rounded-full blur-3xl translate-x-1/3 -translate-y-1/4" />
          <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-accent/30 rounded-full blur-3xl -translate-x-1/3 translate-y-1/4" />
        </div>

        {/* Content */}
        <div className="relative z-10 max-w-7xl mx-auto px-6 w-full">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            {/* Left: Text content */}
            <div className="max-w-xl">
              <div className="flex items-center gap-2.5 mb-8">
                <div className="p-2.5 bg-primary/10 rounded-full">
                  <Leaf className="w-5 h-5 text-primary" />
                </div>
                <span className="text-label">{t('landing.hero.guardian')}</span>
              </div>
              
              <h1 className="font-display text-5xl md:text-6xl lg:text-7xl text-foreground mb-6">
                {t('app.title')}
              </h1>
              
              <p className="text-lg text-muted-foreground max-w-md mb-10 leading-relaxed">
                {t('landing.hero.subtitle')}
              </p>

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
                  data-testid="button-start-trial"
                >
                  <Camera className="w-4 h-4" />
                  {t('landing.hero.ctaTrial')}
                </Button>
              )}
            </div>

            {/* Right: Layered product imagery */}
            <div className="hidden lg:block relative h-[600px]">
              {/* Floating skincare products image */}
              <div className="absolute top-0 right-0 w-72 h-80 rounded-2xl overflow-hidden shadow-2xl transform rotate-3 hover:rotate-0 transition-transform duration-500">
                <img 
                  src={heroSkincareImage} 
                  alt="Natural skincare products" 
                  className="w-full h-full object-cover"
                />
              </div>
              
              {/* Skincare products image */}
              <div className="absolute bottom-0 left-0 w-80 h-64 rounded-2xl overflow-hidden shadow-2xl transform -rotate-2 hover:rotate-0 transition-transform duration-500">
                <img 
                  src={skincareImage} 
                  alt="Natural skincare products" 
                  className="w-full h-full object-cover"
                />
              </div>
              
              {/* Decorative accent */}
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-32 h-32 bg-primary/10 rounded-full blur-2xl" />
            </div>
          </div>
        </div>
      </section>

      {/* How It Works - Visual demonstration */}
      <section className="section-spacing bg-card/40 relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            {/* Left: Phone scanning demonstration image */}
            <div className="relative order-2 lg:order-1">
              <div className="relative">
                {/* Main phone scanning image */}
                <div className="rounded-3xl overflow-hidden shadow-2xl">
                  <img 
                    src={phoneScanImage} 
                    alt="Scanning product ingredients with phone" 
                    className="w-full h-auto object-cover"
                  />
                </div>
                
                {/* Floating result card overlay */}
                <div className="absolute -bottom-6 -right-6 bg-background rounded-2xl shadow-xl p-5 border border-border/50 max-w-[200px]">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                      <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                    </div>
                    <span className="font-medium text-sm">{t('landing.howItWorks.resultCard.title')}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">{t('landing.howItWorks.resultCard.description')}</p>
                </div>
              </div>
            </div>

            {/* Right: Steps content */}
            <div className="order-1 lg:order-2">
              <p className="text-label mb-3">{t('landing.howItWorks.subtitle')}</p>
              <h2 className="font-display text-3xl md:text-4xl mb-10">{t('landing.howItWorks.title')}</h2>

              <div className="space-y-8">
                <div className="flex gap-5">
                  <div className="flex-shrink-0 w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center border border-primary/20">
                    <Camera className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-medium mb-1.5">{t('landing.howItWorks.step1.title')}</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">{t('landing.howItWorks.step1.description')}</p>
                  </div>
                </div>

                <div className="flex gap-5">
                  <div className="flex-shrink-0 w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center border border-primary/20">
                    <Sparkles className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-medium mb-1.5">{t('landing.howItWorks.step2.title')}</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">{t('landing.howItWorks.step2.description')}</p>
                  </div>
                </div>

                <div className="flex gap-5">
                  <div className="flex-shrink-0 w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center border border-primary/20">
                    <Shield className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-medium mb-1.5">{t('landing.howItWorks.step3.title')}</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">{t('landing.howItWorks.step3.description')}</p>
                  </div>
                </div>
              </div>

              <div className="mt-10">
                {isAuthenticated ? (
                  <Link href="/upload">
                    <Button variant="outline" className="rounded-full gap-2">
                      {t('landing.hero.cta')}
                      <ArrowRight className="w-4 h-4" />
                    </Button>
                  </Link>
                ) : (
                  <Button 
                    variant="outline" 
                    className="rounded-full gap-2"
                    onClick={() => window.location.href = "/api/login"}
                    data-testid="button-try-free-how"
                  >
                    {t('landing.hero.ctaTrial')}
                    <ArrowRight className="w-4 h-4" />
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features - Visual cards with imagery */}
      <section className="section-spacing relative">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="font-display text-3xl md:text-4xl">{t('landing.features.title')}</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Multi-language */}
            <div className="group relative overflow-hidden rounded-2xl bg-card border border-border/50 hover-elevate transition-all duration-300">
              <div className="aspect-[4/3] overflow-hidden">
                <img 
                  src={featureMultilangImage} 
                  alt="Global ingredients" 
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-card via-card/50 to-transparent" />
              </div>
              <div className="absolute bottom-0 left-0 right-0 p-6">
                <div className="w-10 h-10 bg-background/60 rounded-full flex items-center justify-center mb-3 backdrop-blur-sm border border-primary/10">
                  <Globe className="w-5 h-5 text-primary" />
                </div>
                <h3 className="font-medium mb-1.5">{t('landing.features.multilang.title')}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{t('landing.features.multilang.description')}</p>
              </div>
            </div>

            {/* Smart Analysis */}
            <div className="group relative overflow-hidden rounded-2xl bg-card border border-border/50 hover-elevate transition-all duration-300">
              <div className="aspect-[4/3] overflow-hidden">
                <img 
                  src={skincareImage} 
                  alt="Smart ingredient analysis" 
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-card via-card/50 to-transparent" />
              </div>
              <div className="absolute bottom-0 left-0 right-0 p-6">
                <div className="w-10 h-10 bg-background/60 rounded-full flex items-center justify-center mb-3 backdrop-blur-sm border border-primary/10">
                  <Sparkles className="w-5 h-5 text-primary" />
                </div>
                <h3 className="font-medium mb-1.5">{t('landing.features.smart.title')}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{t('landing.features.smart.description')}</p>
              </div>
            </div>

            {/* Risk Assessment */}
            <div className="group relative overflow-hidden rounded-2xl bg-card border border-border/50 hover-elevate transition-all duration-300">
              <div className="aspect-[4/3] overflow-hidden">
                <img 
                  src={womanReadingLabel} 
                  alt="Health risk awareness" 
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-card via-card/50 to-transparent" />
              </div>
              <div className="absolute bottom-0 left-0 right-0 p-6">
                <div className="w-10 h-10 bg-background/60 rounded-full flex items-center justify-center mb-3 backdrop-blur-sm border border-primary/10">
                  <Shield className="w-5 h-5 text-primary" />
                </div>
                <h3 className="font-medium mb-1.5">{t('landing.features.risk.title')}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{t('landing.features.risk.description')}</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Final CTA - Full-width with imagery */}
      <section className="relative py-24 overflow-hidden">
        <div className="absolute inset-0">
          <img 
            src={skincareImage} 
            alt="Natural wellness products" 
            className="w-full h-full object-cover opacity-20"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-background via-background/95 to-background" />
        </div>
        
        <div className="relative z-10 max-w-3xl mx-auto px-6 text-center">
          <h2 className="font-display text-3xl md:text-4xl mb-6">{t('landing.cta.title')}</h2>
          <p className="text-muted-foreground mb-8 max-w-xl mx-auto">{t('landing.cta.description')}</p>
          
          {isAuthenticated ? (
            <Link href="/upload">
              <Button 
                size="lg" 
                className="rounded-full px-10 py-6 text-base font-medium shadow-md gap-3"
              >
                <Camera className="w-4 h-4" />
                {t('landing.hero.cta')}
              </Button>
            </Link>
          ) : (
            <div className="space-y-3 inline-flex flex-col items-center">
              <Button
                size="lg"
                className="rounded-full px-10 py-6 text-base font-medium shadow-md gap-3"
                onClick={() => window.location.href = "/api/login"}
                data-testid="button-start-trial-footer"
              >
                <Camera className="w-4 h-4" />
                {t('landing.hero.ctaTrial')}
              </Button>
              
              {/* Trust signal */}
              <p className="text-sm text-muted-foreground">
                {t('landing.hero.trust.noCreditCard')}
              </p>
            </div>
          )}
        </div>
      </section>

      {/* Footer */}
      <footer className="py-16 text-center border-t border-border/30">
        <p className="font-display text-xl mb-2">{t('app.title')}</p>
        <p className="text-xs text-muted-foreground font-light mb-4">{t('landing.footer.tagline')}</p>
        <Link href="/feedback">
          <Button 
            variant="ghost" 
            size="sm" 
            className="text-muted-foreground/70 hover:text-primary font-light text-xs"
            data-testid="link-contact-us"
          >
            {t('landing.footer.contact')}
          </Button>
        </Link>
      </footer>
    </div>
  );
}

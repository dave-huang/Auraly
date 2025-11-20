import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Sparkles, Shield, Zap, Camera, Globe, Lock } from "lucide-react";
import { useTranslation } from "react-i18next";
import { LanguageSwitcher } from "@/components/language-switcher";
import scanningImage from "@assets/generated_images/hand_scanning_product_with_phone.png";
import ingredientsImage from "@assets/generated_images/ingredients_and_health_particles.png";
import productsImage from "@assets/generated_images/product_types_arrangement.png";

export default function Landing() {
  const { t } = useTranslation();
  
  return (
    <div className="min-h-screen bg-background">
      {/* Language Switcher */}
      <div className="fixed top-4 right-4 z-50">
        <LanguageSwitcher />
      </div>

      {/* Hero Section - Mobile First */}
      <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
        {/* Background gradient blobs */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -top-1/2 -right-1/2 w-full h-full bg-primary/8 rounded-full blur-3xl" />
          <div className="absolute -bottom-1/2 -left-1/2 w-full h-full bg-primary/5 rounded-full blur-3xl" />
        </div>

        {/* Content Grid - Stacks on mobile, side-by-side on desktop */}
        <div className="relative z-10 max-w-6xl mx-auto px-4 py-12 sm:py-20 w-full">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 items-center">
            {/* Left: Text Content */}
            <div className="flex flex-col justify-center order-2 lg:order-1">
              {/* Logo/Brand */}
              <div className="mb-6 sm:mb-8">
                <div className="flex items-center gap-2 mb-3 sm:mb-4">
                  <div className="p-2 bg-primary/10 rounded-lg">
                    <Shield className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
                  </div>
                  <span className="text-xs sm:text-sm font-semibold text-primary">{t('landing.hero.guardian')}</span>
                </div>
                <h1 className="font-serif text-4xl sm:text-5xl lg:text-6xl font-bold text-foreground tracking-tight mb-4">
                  {t('app.title')}
                </h1>
              </div>

              {/* Main headline */}
              <p className="text-base sm:text-lg lg:text-xl text-muted-foreground mb-6 sm:mb-8 leading-relaxed max-w-lg">
                {t('landing.hero.subtitle')}
              </p>

              {/* CTA Button */}
              <Link href="/upload" data-testid="link-upload">
                <Button 
                  size="lg" 
                  className="rounded-full px-6 sm:px-10 py-5 sm:py-7 text-base sm:text-lg font-semibold shadow-lg hover:shadow-xl transition-all gap-2 mb-8 w-full sm:w-auto"
                  data-testid="button-start-scanning"
                >
                  <Camera className="w-5 h-5" />
                  {t('landing.hero.cta')}
                </Button>
              </Link>

              {/* Trust indicators */}
              <div className="flex flex-col sm:flex-row sm:flex-wrap gap-4 sm:gap-6 text-xs sm:text-sm">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Lock className="w-4 h-4 text-primary flex-shrink-0" />
                  <span>{t('landing.hero.trust.privacy')}</span>
                </div>
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

            {/* Right: Hero Image - Mobile optimized */}
            <div className="order-1 lg:order-2 mb-6 lg:mb-0">
              <img 
                src={scanningImage} 
                alt="Scanning product with phone" 
                className="w-full h-auto rounded-2xl shadow-lg max-w-sm sm:max-w-none mx-auto"
                loading="lazy"
              />
            </div>
          </div>
        </div>
      </section>

      {/* How It Works - Visual Steps */}
      <section className="py-16 sm:py-24 bg-card/50">
        <div className="max-w-6xl mx-auto px-4">
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-center mb-3 sm:mb-4">{t('landing.howItWorks.title')}</h2>
          <p className="text-center text-muted-foreground text-sm sm:text-base mb-12 sm:mb-20">{t('landing.howItWorks.subtitle')}</p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 sm:gap-8 mb-12 sm:mb-16">
            {/* Step 1 */}
            <div className="relative">
              <div className="flex flex-col items-center text-center">
                <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-primary/15 flex items-center justify-center mb-4 sm:mb-6 relative z-10 border-2 border-primary/20">
                  <Camera className="w-8 h-8 sm:w-10 sm:h-10 text-primary" />
                </div>
                <h3 className="text-base sm:text-lg font-semibold mb-2">{t('landing.howItWorks.step1.title')}</h3>
                <p className="text-xs sm:text-sm text-muted-foreground">{t('landing.howItWorks.step1.description')}</p>
              </div>
              <div className="hidden sm:block absolute top-8 sm:top-10 left-[60%] w-[80%] h-0.5 bg-gradient-to-r from-primary/50 to-transparent" />
            </div>

            {/* Step 2 */}
            <div className="relative">
              <div className="flex flex-col items-center text-center">
                <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-primary/15 flex items-center justify-center mb-4 sm:mb-6 relative z-10 border-2 border-primary/20">
                  <Sparkles className="w-8 h-8 sm:w-10 sm:h-10 text-primary" />
                </div>
                <h3 className="text-base sm:text-lg font-semibold mb-2">{t('landing.howItWorks.step2.title')}</h3>
                <p className="text-xs sm:text-sm text-muted-foreground">{t('landing.howItWorks.step2.description')}</p>
              </div>
              <div className="hidden sm:block absolute top-8 sm:top-10 left-[60%] w-[80%] h-0.5 bg-gradient-to-r from-primary/50 to-transparent" />
            </div>

            {/* Step 3 */}
            <div>
              <div className="flex flex-col items-center text-center">
                <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-primary/15 flex items-center justify-center mb-4 sm:mb-6 relative z-10 border-2 border-primary/20">
                  <Shield className="w-8 h-8 sm:w-10 sm:h-10 text-primary" />
                </div>
                <h3 className="text-base sm:text-lg font-semibold mb-2">{t('landing.howItWorks.step3.title')}</h3>
                <p className="text-xs sm:text-sm text-muted-foreground">{t('landing.howItWorks.step3.description')}</p>
              </div>
            </div>
          </div>

          {/* Ingredients Illustration - Mobile optimized */}
          <div className="flex justify-center">
            <img 
              src={ingredientsImage} 
              alt="Ingredient analysis" 
              className="w-full max-w-2xl sm:max-w-4xl h-auto rounded-2xl shadow-lg"
              loading="lazy"
            />
          </div>
        </div>
      </section>

      {/* Features - Quick highlights */}
      <section className="py-16 sm:py-24">
        <div className="max-w-6xl mx-auto px-4">
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-center mb-4 sm:mb-6">{t('landing.features.title')}</h2>
          <p className="text-center text-muted-foreground text-sm sm:text-base mb-12 sm:mb-16 max-w-2xl mx-auto">{t('landing.howItWorks.subtitle')}</p>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 items-center">
            {/* Features List */}
            <div className="space-y-4 sm:space-y-6 order-2 lg:order-1">
              <Card className="p-4 sm:p-6 hover-elevate transition-all bg-card/50">
                <div className="flex gap-3 sm:gap-4">
                  <div className="w-10 h-10 sm:w-12 sm:h-12 bg-primary/10 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Globe className="w-5 h-5 sm:w-6 sm:h-6 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-semibold text-sm sm:text-base mb-1">{t('landing.features.multilang.title')}</h3>
                    <p className="text-xs sm:text-sm text-muted-foreground">{t('landing.features.multilang.description')}</p>
                  </div>
                </div>
              </Card>

              <Card className="p-4 sm:p-6 hover-elevate transition-all bg-card/50">
                <div className="flex gap-3 sm:gap-4">
                  <div className="w-10 h-10 sm:w-12 sm:h-12 bg-primary/10 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Sparkles className="w-5 h-5 sm:w-6 sm:h-6 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-semibold text-sm sm:text-base mb-1">{t('landing.features.smart.title')}</h3>
                    <p className="text-xs sm:text-sm text-muted-foreground">{t('landing.features.smart.description')}</p>
                  </div>
                </div>
              </Card>

              <Card className="p-4 sm:p-6 hover-elevate transition-all bg-card/50">
                <div className="flex gap-3 sm:gap-4">
                  <div className="w-10 h-10 sm:w-12 sm:h-12 bg-primary/10 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Shield className="w-5 h-5 sm:w-6 sm:h-6 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-semibold text-sm sm:text-base mb-1">{t('landing.features.risk.title')}</h3>
                    <p className="text-xs sm:text-sm text-muted-foreground">{t('landing.features.risk.description')}</p>
                  </div>
                </div>
              </Card>
            </div>

            {/* Products Image - Mobile optimized */}
            <div className="order-1 lg:order-2 mb-6 lg:mb-0">
              <img 
                src={productsImage} 
                alt="Product types" 
                className="w-full max-w-md sm:max-w-none h-auto rounded-2xl shadow-lg mx-auto"
                loading="lazy"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Privacy Notice - Mobile optimized */}
      <section className="py-12 sm:py-16 bg-gradient-to-r from-primary/5 to-primary/10 border-t border-b">
        <div className="max-w-3xl mx-auto px-4 text-center">
          <div className="flex items-center justify-center gap-2 mb-3 sm:mb-4">
            <Lock className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
            <span className="font-semibold text-sm sm:text-base text-primary">{t('landing.privacy.title')}</span>
          </div>
          <p className="text-muted-foreground text-xs sm:text-sm mb-4 sm:mb-6">{t('landing.privacy.description')}</p>
          <div className="flex flex-col sm:flex-row sm:flex-wrap justify-center gap-3 sm:gap-6 text-xs sm:text-sm text-muted-foreground">
            <div className="flex items-center gap-2 justify-center">
              <div className="w-1.5 h-1.5 rounded-full bg-primary" />
              {t('landing.privacy.features.noAccount')}
            </div>
            <div className="flex items-center gap-2 justify-center">
              <div className="w-1.5 h-1.5 rounded-full bg-primary" />
              {t('landing.privacy.features.notStored')}
            </div>
            <div className="flex items-center gap-2 justify-center">
              <div className="w-1.5 h-1.5 rounded-full bg-primary" />
              {t('landing.privacy.features.localOnly')}
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 sm:py-12 text-center border-t px-4">
        <p className="font-serif text-lg sm:text-xl font-bold mb-1">{t('app.title')}</p>
        <p className="text-xs sm:text-sm text-muted-foreground">{t('landing.footer.tagline')}</p>
      </footer>
    </div>
  );
}

import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Sparkles, Shield, Zap, Camera, Globe, Lock } from "lucide-react";
import { useTranslation } from "react-i18next";
import { LanguageSwitcher } from "@/components/language-switcher";
import scanningImage from "@assets/generated_images/realistic_product_label_scanning_photo.png";
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

      {/* Hero Section */}
      <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
        {/* Background gradient */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -top-1/2 -right-1/2 w-full h-full bg-primary/8 rounded-full blur-3xl" />
          <div className="absolute -bottom-1/2 -left-1/2 w-full h-full bg-primary/5 rounded-full blur-3xl" />
        </div>

        {/* Content */}
        <div className="relative z-10 w-full px-4">
          <div className="max-w-6xl mx-auto">
            {/* Image first on mobile */}
            <div className="mb-8 lg:mb-0 lg:hidden text-center">
              <img 
                src={scanningImage} 
                alt="Scanning product labels" 
                className="w-full h-auto rounded-2xl shadow-lg"
                loading="lazy"
              />
            </div>

            {/* Desktop: Two column grid */}
            <div className="hidden lg:grid grid-cols-2 gap-12 items-center">
              {/* Left: Image */}
              <div>
                <img 
                  src={scanningImage} 
                  alt="Scanning product labels" 
                  className="w-full h-auto rounded-2xl shadow-lg"
                  loading="lazy"
                />
              </div>

              {/* Right: Text */}
              <div>
                <h1 className="text-5xl font-bold font-serif mb-6 text-foreground">
                  {t('app.title')}
                </h1>
                <p className="text-xl text-muted-foreground mb-8">
                  Instantly understand what's in every product
                </p>
                <Link href="/upload" data-testid="link-upload">
                  <Button 
                    size="lg" 
                    className="rounded-full px-8 py-7 text-lg font-semibold shadow-lg hover:shadow-xl transition-all gap-2"
                    data-testid="button-start-scanning"
                  >
                    <Camera className="w-5 h-5" />
                    Scan Now
                  </Button>
                </Link>
                <div className="flex gap-6 mt-8 text-sm">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Lock className="w-4 h-4 text-primary" />
                    Private
                  </div>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Zap className="w-4 h-4 text-primary" />
                    Instant
                  </div>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Sparkles className="w-4 h-4 text-primary" />
                    No Account
                  </div>
                </div>
              </div>
            </div>

            {/* Mobile: Centered text below image */}
            <div className="lg:hidden text-center">
              <h1 className="text-4xl sm:text-5xl font-bold font-serif mb-4 text-foreground">
                {t('app.title')}
              </h1>
              <p className="text-lg sm:text-xl text-muted-foreground mb-8">
                Instantly understand what's in every product
              </p>
              <Link href="/upload" data-testid="link-upload">
                <Button 
                  size="lg" 
                  className="rounded-full px-8 py-6 text-base font-semibold shadow-lg hover:shadow-xl transition-all gap-2 inline-flex"
                  data-testid="button-start-scanning"
                >
                  <Camera className="w-5 h-5" />
                  Scan Now
                </Button>
              </Link>
              <div className="flex flex-col sm:flex-row gap-4 sm:gap-6 mt-8 justify-center text-sm">
                <div className="flex items-center justify-center gap-2 text-muted-foreground">
                  <Lock className="w-4 h-4 text-primary" />
                  Private
                </div>
                <div className="flex items-center justify-center gap-2 text-muted-foreground">
                  <Zap className="w-4 h-4 text-primary" />
                  Instant
                </div>
                <div className="flex items-center justify-center gap-2 text-muted-foreground">
                  <Sparkles className="w-4 h-4 text-primary" />
                  No Account
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-20 sm:py-32 bg-card/50">
        <div className="max-w-5xl mx-auto px-4">
          <h2 className="text-4xl sm:text-5xl font-bold font-serif text-center mb-20">How it works</h2>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 mb-20">
            {/* Step 1 */}
            <div className="flex flex-col items-center text-center">
              <div className="w-24 h-24 rounded-full bg-primary/15 flex items-center justify-center mb-6 border-2 border-primary/20">
                <Camera className="w-12 h-12 text-primary" />
              </div>
              <h3 className="text-2xl font-bold mb-3">Scan</h3>
              <p className="text-muted-foreground">Point your camera at any label</p>
            </div>

            {/* Step 2 */}
            <div className="flex flex-col items-center text-center">
              <div className="w-24 h-24 rounded-full bg-primary/15 flex items-center justify-center mb-6 border-2 border-primary/20">
                <Sparkles className="w-12 h-12 text-primary" />
              </div>
              <h3 className="text-2xl font-bold mb-3">Analyze</h3>
              <p className="text-muted-foreground">AI reads every ingredient</p>
            </div>

            {/* Step 3 */}
            <div className="flex flex-col items-center text-center">
              <div className="w-24 h-24 rounded-full bg-primary/15 flex items-center justify-center mb-6 border-2 border-primary/20">
                <Shield className="w-12 h-12 text-primary" />
              </div>
              <h3 className="text-2xl font-bold mb-3">Understand</h3>
              <p className="text-muted-foreground">Get clear health insights</p>
            </div>
          </div>

          {/* Ingredients image */}
          <img 
            src={ingredientsImage} 
            alt="Ingredient analysis" 
            className="w-full max-w-3xl mx-auto rounded-2xl shadow-lg"
            loading="lazy"
          />
        </div>
      </section>

      {/* Features */}
      <section className="py-20 sm:py-32">
        <div className="max-w-5xl mx-auto px-4">
          <h2 className="text-4xl sm:text-5xl font-bold font-serif text-center mb-20">Why Auraly</h2>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            {/* Left: Products image */}
            <div className="order-2 lg:order-1">
              <img 
                src={productsImage} 
                alt="Product types" 
                className="w-full rounded-2xl shadow-lg"
                loading="lazy"
              />
            </div>

            {/* Right: Features list */}
            <div className="order-1 lg:order-2 space-y-6">
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <Globe className="w-6 h-6 text-primary" />
                  <h3 className="text-2xl font-bold">Multi-Language</h3>
                </div>
                <p className="text-muted-foreground text-lg">Scan labels in any language</p>
              </div>

              <div>
                <div className="flex items-center gap-3 mb-2">
                  <Sparkles className="w-6 h-6 text-primary" />
                  <h3 className="text-2xl font-bold">AI Powered</h3>
                </div>
                <p className="text-muted-foreground text-lg">Smart ingredient analysis</p>
              </div>

              <div>
                <div className="flex items-center gap-3 mb-2">
                  <Shield className="w-6 h-6 text-primary" />
                  <h3 className="text-2xl font-bold">Health Focused</h3>
                </div>
                <p className="text-muted-foreground text-lg">Risk assessment for your health</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Trust Section */}
      <section className="py-16 bg-gradient-to-r from-primary/5 to-primary/10 border-t border-b">
        <div className="max-w-3xl mx-auto px-4 text-center">
          <h3 className="text-2xl font-bold mb-6 flex items-center justify-center gap-2">
            <Lock className="w-6 h-6 text-primary" />
            Your Privacy Matters
          </h3>
          <p className="text-muted-foreground text-lg mb-8">No account needed. Your images stay on your device.</p>
          <div className="flex flex-col sm:flex-row justify-center gap-4 sm:gap-8 text-sm font-medium">
            <div className="flex items-center justify-center gap-2">
              <div className="w-2 h-2 rounded-full bg-primary" />
              No tracking
            </div>
            <div className="flex items-center justify-center gap-2">
              <div className="w-2 h-2 rounded-full bg-primary" />
              No storage
            </div>
            <div className="flex items-center justify-center gap-2">
              <div className="w-2 h-2 rounded-full bg-primary" />
              Always private
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 text-center border-t">
        <p className="font-serif text-2xl font-bold mb-2">{t('app.title')}</p>
        <p className="text-sm text-muted-foreground">Understand what you eat, drink, and use</p>
      </footer>
    </div>
  );
}

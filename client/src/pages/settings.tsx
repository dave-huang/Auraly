import { useState, useEffect } from "react";
import { useLocation, Link } from "wouter";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Check, Settings, RefreshCw, Shield, AlertTriangle, UtensilsCrossed, Flower2, FlaskConical, Leaf, Crown, Lock, Loader2, Sliders } from "lucide-react";
import { NavigationMenu } from "@/components/navigation-menu";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useSubscriptionStatus, useLogGatedContentTap, useCreateCheckout, useStripeProducts } from "@/hooks/use-subscription";
import type { RiskPreferences, AllergenPreferences, PreferenceCategory, AllergenCategory, RiskTolerance } from "@shared/schema";
import { defaultRiskPreferences, defaultAllergenPreferences, preferenceCategories, allergenCategories } from "@shared/schema";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

const categoryInfo: Record<PreferenceCategory, { icon: string; group: string }> = {
  artificial_fragrances: { icon: "🌸", group: "fragrances" },
  artificial_colors: { icon: "🎨", group: "colors" },
  fragrance_allergens: { icon: "⚠️", group: "fragrances" },
  preservatives: { icon: "🧪", group: "chemicals" },
  parabens: { icon: "🔬", group: "chemicals" },
  endocrine_disruptors: { icon: "⚗️", group: "chemicals" },
  sulfates: { icon: "🫧", group: "surfactants" },
  silicones: { icon: "✨", group: "surfactants" },
  pegs_ethoxylated: { icon: "💧", group: "surfactants" },
  contact_sensitizers: { icon: "🚨", group: "sensitizers" },
  alcohols: { icon: "🍷", group: "sensitizers" },
};

interface AllergenCategoryInfo {
  key: AllergenCategory;
  group: 'food' | 'cosmetic' | 'chemical';
  example: {
    en: string;
    es: string;
    zh: string;
  };
}

const allergenCategoryInfo: AllergenCategoryInfo[] = [
  { key: "nuts", group: "food", example: { en: "Almonds, peanuts, shea butter", es: "Almendras, cacahuetes, karité", zh: "杏仁、花生、乳木果" } },
  { key: "soy", group: "food", example: { en: "Soy lecithin, soy protein", es: "Lecitina de soja, proteína de soja", zh: "大豆卵磷脂、大豆蛋白" } },
  { key: "dairy", group: "food", example: { en: "Milk, lactose, casein, whey", es: "Leche, lactosa, caseína", zh: "牛奶、乳糖、酪蛋白" } },
  { key: "gluten_wheat", group: "food", example: { en: "Wheat, barley, oat", es: "Trigo, cebada, avena", zh: "小麦、大麦、燕麦" } },
  { key: "eggs", group: "food", example: { en: "Albumin, lysozyme", es: "Albúmina, lisozima", zh: "白蛋白、溶菌酶" } },
  { key: "seafood_shellfish", group: "food", example: { en: "Fish oil, chitosan", es: "Aceite de pescado, quitosano", zh: "鱼油、壳聚糖" } },
  { key: "fragrance_allergens_cosmetic", group: "cosmetic", example: { en: "Limonene, linalool, coumarin", es: "Limoneno, linalool, cumarina", zh: "柠檬烯、芳樟醇、香豆素" } },
  { key: "preservative_allergens", group: "cosmetic", example: { en: "MI, MCI, formaldehyde releasers", es: "MI, MCI, liberadores de formaldehído", zh: "MI、MCI、甲醛释放剂" } },
  { key: "lanolin", group: "cosmetic", example: { en: "Lanolin, wool wax", es: "Lanolina, cera de lana", zh: "羊毛脂、羊毛蜡" } },
  { key: "botanical_extracts", group: "cosmetic", example: { en: "Essential oils, propolis", es: "Aceites esenciales, propóleo", zh: "精油、蜂胶" } },
  { key: "colorants_dyes", group: "chemical", example: { en: "FD&C dyes, CI numbers", es: "Colorantes FD&C, números CI", zh: "FD&C染料、CI编号" } },
  { key: "drying_alcohols", group: "chemical", example: { en: "SD alcohol, ethanol", es: "SD alcohol, etanol", zh: "SD酒精、乙醇" } },
];

function ToleranceSelector({ 
  value, 
  onChange,
  categoryKey,
  disabled
}: { 
  value: RiskTolerance; 
  onChange: (value: RiskTolerance) => void;
  categoryKey: PreferenceCategory;
  disabled?: boolean;
}) {
  const { i18n } = useTranslation();
  const lang = i18n.language;

  const options: { value: RiskTolerance; label: string; color: string; selectedColor: string }[] = [
    { 
      value: "no_preference", 
      label: lang === 'zh' ? '默认' : lang === 'es' ? 'Def.' : 'Default',
      color: "border-border/40 bg-card/30",
      selectedColor: "border-primary/40 bg-primary/5 ring-1 ring-primary/20"
    },
    { 
      value: "caution", 
      label: lang === 'zh' ? '谨慎' : lang === 'es' ? 'Prec.' : 'Caution',
      color: "border-border/40 bg-card/30",
      selectedColor: "border-amber-400/50 bg-amber-50/50 dark:bg-amber-950/20 ring-1 ring-amber-400/30"
    },
    { 
      value: "avoid", 
      label: lang === 'zh' ? '避免' : lang === 'es' ? 'Evitar' : 'Avoid',
      color: "border-border/40 bg-card/30",
      selectedColor: "border-rose-400/50 bg-rose-50/50 dark:bg-rose-950/20 ring-1 ring-rose-400/30"
    },
  ];

  return (
    <div className="flex gap-1.5">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          disabled={disabled}
          data-testid={`setting-${categoryKey}-${option.value}`}
          onClick={() => onChange(option.value)}
          className={cn(
            "flex-1 py-2 px-3 rounded-lg text-xs font-medium transition-all",
            value === option.value 
              ? option.selectedColor
              : option.color + " hover:bg-card/60",
            disabled && "opacity-50 cursor-not-allowed"
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

export default function SettingsPage() {
  const [, navigate] = useLocation();
  const { t, i18n } = useTranslation();
  const { toast } = useToast();
  const lang = (i18n.language?.substring(0, 2) || 'en') as 'en' | 'es' | 'zh';
  
  const [localRiskPrefs, setLocalRiskPrefs] = useState<RiskPreferences | null>(null);
  const [localAllergenPrefs, setLocalAllergenPrefs] = useState<AllergenPreferences | null>(null);
  const [hasRiskChanges, setHasRiskChanges] = useState(false);
  const [hasAllergenChanges, setHasAllergenChanges] = useState(false);
  const [activeTab, setActiveTab] = useState<string>("risk");

  const { data: subscriptionStatus, isLoading: loadingSubscription } = useSubscriptionStatus();
  const logGatedContent = useLogGatedContentTap();
  const createCheckout = useCreateCheckout();
  const { data: productsData } = useStripeProducts();
  const isPremium = subscriptionStatus?.isPremium || subscriptionStatus?.isTrialActive || false;

  const handleUpgrade = () => {
    logGatedContent.mutate('settings');
    const subscriptionProduct = productsData?.products?.find((p: any) => p.metadata?.type === 'subscription');
    const price = subscriptionProduct?.prices[0];
    if (price) {
      createCheckout.mutate({ priceId: price.id, mode: 'subscription' });
    } else {
      navigate('/upgrade');
    }
  };

  const { data: riskPrefsData, isLoading: isLoadingRisk } = useQuery<{ preferences: RiskPreferences; onboardingCompleted: boolean }>({
    queryKey: ['/api/user/preferences'],
    staleTime: 0,
  });

  const { data: allergenPrefsData, isLoading: isLoadingAllergen } = useQuery<{ preferences: AllergenPreferences }>({
    queryKey: ['/api/user/allergen-preferences'],
    staleTime: 0,
  });

  const riskPreferences = localRiskPrefs || riskPrefsData?.preferences || defaultRiskPreferences;
  const allergenPreferences = localAllergenPrefs || allergenPrefsData?.preferences || defaultAllergenPreferences;

  const updateRiskPreferences = useMutation({
    mutationFn: async (prefs: Partial<RiskPreferences>) => {
      return apiRequest('PATCH', '/api/user/preferences', prefs);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/user/preferences'] });
      setHasRiskChanges(false);
      toast({
        title: lang === 'zh' ? '设置已保存' : lang === 'es' ? 'Configuración guardada' : 'Settings saved',
        description: lang === 'zh' ? '您的风险偏好设置已更新' : lang === 'es' ? 'Tus preferencias de riesgo han sido actualizadas' : 'Your risk preferences have been updated',
      });
    },
    onError: (error: any) => {
      toast({
        title: lang === 'zh' ? '保存失败' : lang === 'es' ? 'Error al guardar' : 'Failed to save',
        description: error.message,
        variant: "destructive",
      });
    }
  });

  const updateAllergenPreferences = useMutation({
    mutationFn: async (prefs: Partial<AllergenPreferences>) => {
      return apiRequest('PATCH', '/api/user/allergen-preferences', prefs);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/user/allergen-preferences'] });
      setHasAllergenChanges(false);
      toast({
        title: lang === 'zh' ? '设置已保存' : lang === 'es' ? 'Configuración guardada' : 'Settings saved',
        description: lang === 'zh' ? '您的过敏原偏好设置已更新' : lang === 'es' ? 'Tus preferencias de alérgenos han sido actualizadas' : 'Your allergen preferences have been updated',
      });
    },
    onError: (error: any) => {
      toast({
        title: lang === 'zh' ? '保存失败' : lang === 'es' ? 'Error al guardar' : 'Failed to save',
        description: error.message,
        variant: "destructive",
      });
    }
  });

  const resetOnboarding = useMutation({
    mutationFn: async () => {
      return apiRequest('POST', '/api/user/reset-onboarding');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/user/preferences'] });
      navigate('/onboarding');
    },
  });

  const updateRiskPreference = (category: PreferenceCategory, value: RiskTolerance) => {
    const newPrefs = { ...riskPreferences, [category]: value };
    setLocalRiskPrefs(newPrefs);
    setHasRiskChanges(true);
  };

  const updateAllergenPreference = (category: AllergenCategory, enabled: boolean) => {
    const newPrefs = { ...allergenPreferences, [category]: enabled };
    setLocalAllergenPrefs(newPrefs);
    setHasAllergenChanges(true);
  };

  const handleSaveRisk = () => {
    if (localRiskPrefs) {
      updateRiskPreferences.mutate(localRiskPrefs);
    }
  };

  const handleSaveAllergen = () => {
    if (localAllergenPrefs) {
      updateAllergenPreferences.mutate(localAllergenPrefs);
    }
  };

  const handleResetRisk = () => {
    setLocalRiskPrefs({ ...defaultRiskPreferences });
    setHasRiskChanges(true);
  };

  const handleResetAllergen = () => {
    setLocalAllergenPrefs({ ...defaultAllergenPreferences });
    setHasAllergenChanges(true);
  };

  const isLoading = isLoadingRisk || isLoadingAllergen || loadingSubscription;

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!isPremium) {
    return (
      <div className="min-h-screen bg-background">
        <header className="border-b border-border/40 bg-background/80 backdrop-blur-sm sticky top-0 z-50">
          <div className="max-w-2xl mx-auto px-6 h-16 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Link href="/upload">
                <Button variant="ghost" size="sm" className="gap-2 text-muted-foreground hover:text-foreground" data-testid="button-back">
                  <ArrowLeft className="w-4 h-4" />
                  <span className="font-light hidden sm:inline">{t('common.back')}</span>
                </Button>
              </Link>
            </div>
            <div className="flex items-center gap-3">
              <NavigationMenu showHomeLink />
            </div>
          </div>
        </header>

        <main className="max-w-2xl mx-auto px-6 py-8">
          <div className="relative">
            <div className="absolute inset-0 bg-gradient-to-t from-background via-background/95 to-transparent z-10 pointer-events-none" style={{ top: '220px' }} />
            
            <div className="relative z-20 text-center py-16">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-6">
                <Lock className="w-8 h-8 text-primary" />
              </div>
              <h2 className="font-display text-2xl md:text-3xl mb-3">
                {lang === 'zh' ? '个性化设置是高级功能' : lang === 'es' ? 'La personalización es Premium' : 'Personalization is a Premium Feature'}
              </h2>
              <p className="text-muted-foreground max-w-md mx-auto mb-8">
                {lang === 'zh' 
                  ? '升级到Auraly+以自定义您的风险敏感度和过敏原警报，获得专属于您的分析结果。' 
                  : lang === 'es' 
                  ? 'Actualiza a Auraly+ para personalizar tu sensibilidad al riesgo y alertas de alérgenos, obteniendo análisis adaptados a ti.'
                  : 'Upgrade to Auraly+ to customize your risk sensitivity and allergen alerts, getting analysis results tailored just for you.'}
              </p>
              <Button 
                size="lg" 
                onClick={handleUpgrade}
                disabled={createCheckout.isPending}
                data-testid="button-upgrade-settings"
                className="gap-2"
              >
                {createCheckout.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Crown className="w-4 h-4" />
                )}
                {t('subscription.upgradeCta', 'Upgrade to Auraly+')}
              </Button>
            </div>

            <div className="opacity-30 blur-sm pointer-events-none" aria-hidden="true">
              <div className="space-y-4">
                <Card className="p-4">
                  <div className="flex items-center gap-4 mb-4">
                    <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
                      <Sliders className="w-5 h-5 text-muted-foreground" />
                    </div>
                    <div className="flex-1">
                      <div className="h-4 w-40 bg-muted rounded mb-2" />
                      <div className="h-3 w-28 bg-muted/50 rounded" />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <div className="h-8 w-20 bg-muted rounded-lg" />
                    <div className="h-8 w-20 bg-amber-100 rounded-lg" />
                    <div className="h-8 w-20 bg-rose-100 rounded-lg" />
                  </div>
                </Card>
                <Card className="p-4">
                  <div className="flex items-center gap-4 mb-4">
                    <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
                      <AlertTriangle className="w-5 h-5 text-muted-foreground" />
                    </div>
                    <div className="flex-1">
                      <div className="h-4 w-36 bg-muted rounded mb-2" />
                      <div className="h-3 w-24 bg-muted/50 rounded" />
                    </div>
                  </div>
                  <div className="flex gap-4">
                    <div className="h-6 w-16 bg-emerald-100 rounded-full" />
                    <div className="h-6 w-16 bg-muted rounded-full" />
                  </div>
                </Card>
              </div>
            </div>
          </div>
        </main>
      </div>
    );
  }

  const activeRiskCount = Object.values(riskPreferences).filter(v => v !== 'no_preference').length;
  const activeAllergenCount = Object.values(allergenPreferences).filter(v => v === true).length;

  const foodAllergens = allergenCategoryInfo.filter(c => c.group === 'food');
  const cosmeticAllergens = allergenCategoryInfo.filter(c => c.group === 'cosmetic');
  const chemicalAllergens = allergenCategoryInfo.filter(c => c.group === 'chemical');

  const hasChanges = (activeTab === 'risk' && hasRiskChanges) || (activeTab === 'allergen' && hasAllergenChanges);
  const isPending = updateRiskPreferences.isPending || updateAllergenPreferences.isPending;

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <header className="border-b border-border/40 bg-background/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-2xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/upload">
              <Button variant="ghost" size="sm" className="gap-2 text-muted-foreground hover:text-foreground" data-testid="button-back">
                <ArrowLeft className="w-4 h-4" />
                <span className="font-light hidden sm:inline">{t('common.back')}</span>
              </Button>
            </Link>
          </div>
          <div className="hidden sm:flex items-center gap-2">
            <Leaf className="w-4 h-4 text-primary/60" />
            <span className="font-display text-lg">{t('app.title')}</span>
          </div>
          <NavigationMenu showHomeLink />
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-2xl mx-auto px-6 py-10">
        {/* Page Title */}
        <div className="mb-8">
          <h1 className="font-display text-2xl md:text-3xl mb-2">
            {lang === 'zh' ? '偏好设置' : lang === 'es' ? 'Preferencias' : 'Preferences'}
          </h1>
          <p className="text-sm text-muted-foreground font-light">
            {lang === 'zh' 
              ? `${activeRiskCount} 个风险设置, ${activeAllergenCount} 个过敏原警报` 
              : lang === 'es' 
              ? `${activeRiskCount} sensibilidades, ${activeAllergenCount} alertas`
              : `${activeRiskCount} risk settings, ${activeAllergenCount} allergen alerts`}
          </p>
        </div>

        <div className="max-w-md mx-auto">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-6 rounded-xl p-1 bg-muted/30">
            <TabsTrigger value="risk" className="flex items-center gap-2 rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm" data-testid="tab-risk">
              <Shield className="w-4 h-4" />
              <span className="font-medium">{lang === 'zh' ? '风险敏感度' : lang === 'es' ? 'Sensibilidad' : 'Risk Sensitivity'}</span>
            </TabsTrigger>
            <TabsTrigger value="allergen" className="flex items-center gap-2 rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm" data-testid="tab-allergen">
              <AlertTriangle className="w-4 h-4" />
              <span className="font-medium">{lang === 'zh' ? '过敏原警报' : lang === 'es' ? 'Alertas' : 'Allergen Alerts'}</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="risk" className="space-y-4">
            <Card className="rounded-xl border-border/30 bg-card/50">
              <CardHeader className="pb-3 pt-5 px-5">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-full bg-primary/10">
                    <Shield className="w-4 h-4 text-primary" />
                  </div>
                  <div>
                    <CardTitle className="text-sm font-display">
                      {lang === 'zh' ? '关于风险敏感度' : lang === 'es' ? 'Acerca de Sensibilidad de Riesgo' : 'About Risk Sensitivity'}
                    </CardTitle>
                    <CardDescription className="text-xs font-light text-muted-foreground/70 mt-0.5">
                      {lang === 'zh' 
                        ? '设置您希望避免或谨慎使用的成分类别。这些偏好将调整扫描结果中相关成分的风险等级。' 
                        : lang === 'es' 
                        ? 'Configure las categorías de ingredientes que prefiere evitar. Estas ajustarán los niveles de riesgo en los resultados.'
                        : 'Configure ingredient categories you prefer to avoid. These will adjust risk levels in your scan results.'}
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
            </Card>

            {preferenceCategories.map((category) => (
              <Card key={category} className="rounded-xl border-border/30 bg-card/50">
                <CardContent className="py-4 px-5">
                  <div className="flex items-center gap-3 mb-3">
                    <span className="text-xl">{categoryInfo[category].icon}</span>
                    <span className="text-sm font-medium flex-1">{t(`preferences.categories.${category}`)}</span>
                  </div>
                  <ToleranceSelector
                    value={riskPreferences[category]}
                    onChange={(value) => updateRiskPreference(category, value)}
                    categoryKey={category}
                    disabled={isPending}
                  />
                </CardContent>
              </Card>
            ))}

            <Card className="mt-6 rounded-xl border-border/30 bg-card/50">
              <CardContent className="py-5 px-5">
                <Button
                  variant="outline"
                  className="w-full rounded-full"
                  onClick={() => resetOnboarding.mutate()}
                  disabled={resetOnboarding.isPending}
                  data-testid="button-redo-onboarding"
                >
                  <RefreshCw className={cn("h-4 w-4 mr-2", resetOnboarding.isPending && "animate-spin")} />
                  {lang === 'zh' ? '重新进行引导设置' : lang === 'es' ? 'Rehacer Configuración Guiada' : 'Redo Guided Setup'}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="allergen" className="space-y-4">
            <Card className="rounded-xl border-border/30 bg-card/50">
              <CardHeader className="pb-3 pt-5 px-5">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-full bg-amber-500/10">
                    <AlertTriangle className="w-4 h-4 text-amber-500" />
                  </div>
                  <div>
                    <CardTitle className="text-sm font-display">
                      {lang === 'zh' ? '关于过敏原警报' : lang === 'es' ? 'Acerca de Alertas de Alérgenos' : 'About Allergen Alerts'}
                    </CardTitle>
                    <CardDescription className="text-xs font-light text-muted-foreground/70 mt-0.5">
                      {lang === 'zh' 
                        ? '启用您希望标记的过敏原类别。这些不会影响风险评分，但会作为单独的警告显示。' 
                        : lang === 'es' 
                        ? 'Activa las categorías de alérgenos que deseas marcar. Estas no afectarán la puntuación de riesgo, pero aparecerán como advertencias.'
                        : 'Enable allergen categories you want flagged. These won\'t affect risk scores, but will appear as separate warnings.'}
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
            </Card>

            <Card className="rounded-xl border-border/30 bg-card/50">
              <CardHeader className="pb-3 pt-5 px-5">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-full bg-amber-500/10">
                    <UtensilsCrossed className="w-4 h-4 text-amber-500" />
                  </div>
                  <CardTitle className="text-sm font-display">
                    {lang === 'zh' ? '食物过敏原' : lang === 'es' ? 'Alérgenos Alimentarios' : 'Food Allergens'}
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-3 px-5 pb-5">
                {foodAllergens.map((cat) => (
                  <div key={cat.key} className={cn(
                    "flex items-center justify-between p-4 rounded-xl border transition-all",
                    allergenPreferences[cat.key] 
                      ? "border-primary/40 bg-primary/5 ring-1 ring-primary/10" 
                      : "border-border/40 bg-card/30 hover:bg-card/50"
                  )}>
                    <div className="flex-1 min-w-0 mr-3">
                      <div className="font-medium text-sm">{t(`allergens.categories.${cat.key}`)}</div>
                      <div className="text-xs text-muted-foreground/50 font-light italic mt-1">
                        {cat.example[lang] || cat.example.en}
                      </div>
                    </div>
                    <Switch
                      checked={allergenPreferences[cat.key]}
                      onCheckedChange={(enabled) => updateAllergenPreference(cat.key, enabled)}
                      data-testid={`allergen-setting-${cat.key}`}
                      disabled={isPending}
                    />
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card className="rounded-xl border-border/30 bg-card/50">
              <CardHeader className="pb-3 pt-5 px-5">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-full bg-rose-500/10">
                    <Flower2 className="w-4 h-4 text-rose-400" />
                  </div>
                  <CardTitle className="text-sm font-display">
                    {lang === 'zh' ? '化妆品过敏原' : lang === 'es' ? 'Alérgenos Cosméticos' : 'Cosmetic Allergens'}
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-3 px-5 pb-5">
                {cosmeticAllergens.map((cat) => (
                  <div key={cat.key} className={cn(
                    "flex items-center justify-between p-4 rounded-xl border transition-all",
                    allergenPreferences[cat.key] 
                      ? "border-primary/40 bg-primary/5 ring-1 ring-primary/10" 
                      : "border-border/40 bg-card/30 hover:bg-card/50"
                  )}>
                    <div className="flex-1 min-w-0 mr-3">
                      <div className="font-medium text-sm">{t(`allergens.categories.${cat.key}`)}</div>
                      <div className="text-xs text-muted-foreground/50 font-light italic mt-1">
                        {cat.example[lang] || cat.example.en}
                      </div>
                    </div>
                    <Switch
                      checked={allergenPreferences[cat.key]}
                      onCheckedChange={(enabled) => updateAllergenPreference(cat.key, enabled)}
                      data-testid={`allergen-setting-${cat.key}`}
                      disabled={isPending}
                    />
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card className="rounded-xl border-border/30 bg-card/50">
              <CardHeader className="pb-3 pt-5 px-5">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-full bg-violet-500/10">
                    <FlaskConical className="w-4 h-4 text-violet-400" />
                  </div>
                  <CardTitle className="text-sm font-display">
                    {lang === 'zh' ? '化学添加剂' : lang === 'es' ? 'Aditivos Químicos' : 'Chemical Additives'}
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-3 px-5 pb-5">
                {chemicalAllergens.map((cat) => (
                  <div key={cat.key} className={cn(
                    "flex items-center justify-between p-4 rounded-xl border transition-all",
                    allergenPreferences[cat.key] 
                      ? "border-primary/40 bg-primary/5 ring-1 ring-primary/10" 
                      : "border-border/40 bg-card/30 hover:bg-card/50"
                  )}>
                    <div className="flex-1 min-w-0 mr-3">
                      <div className="font-medium text-sm">{t(`allergens.categories.${cat.key}`)}</div>
                      <div className="text-xs text-muted-foreground/50 font-light italic mt-1">
                        {cat.example[lang] || cat.example.en}
                      </div>
                    </div>
                    <Switch
                      checked={allergenPreferences[cat.key]}
                      onCheckedChange={(enabled) => updateAllergenPreference(cat.key, enabled)}
                      data-testid={`allergen-setting-${cat.key}`}
                      disabled={isPending}
                    />
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
        </div>
      </main>

      {hasChanges && (
        <div className="fixed bottom-0 left-0 right-0 bg-background/95 backdrop-blur-md border-t border-border/30 p-4 safe-area-pb">
          <div className="max-w-md mx-auto flex gap-3">
            <Button 
              variant="outline" 
              onClick={activeTab === 'risk' ? handleResetRisk : handleResetAllergen}
              className="flex-1 rounded-full"
              disabled={isPending}
              data-testid="button-reset"
            >
              {lang === 'zh' ? '重置' : lang === 'es' ? 'Restablecer' : 'Reset'}
            </Button>
            <Button 
              onClick={activeTab === 'risk' ? handleSaveRisk : handleSaveAllergen}
              className="flex-1 rounded-full"
              disabled={isPending}
              data-testid="button-save-preferences"
            >
              {isPending 
                ? (lang === 'zh' ? '保存中...' : lang === 'es' ? 'Guardando...' : 'Saving...')
                : (lang === 'zh' ? '保存更改' : lang === 'es' ? 'Guardar' : 'Save Changes')}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

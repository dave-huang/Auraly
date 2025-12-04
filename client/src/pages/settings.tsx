import { useState, useEffect } from "react";
import { useLocation, Link } from "wouter";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Check, Settings, RefreshCw, Shield, AlertTriangle, UtensilsCrossed, Flower2, FlaskConical } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
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

  const options: { value: RiskTolerance; label: string; color: string }[] = [
    { 
      value: "no_preference", 
      label: lang === 'zh' ? '默认' : lang === 'es' ? 'Def.' : 'Default',
      color: "border-muted-foreground/30 bg-muted/20"
    },
    { 
      value: "caution", 
      label: lang === 'zh' ? '谨慎' : lang === 'es' ? 'Prec.' : 'Caution',
      color: "border-yellow-500 bg-yellow-500/10"
    },
    { 
      value: "avoid", 
      label: lang === 'zh' ? '避免' : lang === 'es' ? 'Evitar' : 'Avoid',
      color: "border-red-500 bg-red-500/10"
    },
  ];

  return (
    <div className="flex gap-1">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          disabled={disabled}
          data-testid={`setting-${categoryKey}-${option.value}`}
          onClick={() => onChange(option.value)}
          className={cn(
            "flex-1 py-1.5 px-2 rounded text-xs font-medium transition-all",
            value === option.value 
              ? option.color + " ring-1 ring-primary" 
              : "border border-border hover-elevate",
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

  const isLoading = isLoadingRisk || isLoadingAllergen;

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
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
      <div className="sticky top-0 z-10 bg-background border-b">
        <div className="max-w-md mx-auto px-4 py-3 flex items-center gap-3">
          <Link href="/upload" asChild>
            <Button variant="ghost" size="icon" data-testid="button-back">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div className="flex-1">
            <h1 className="font-semibold">
              {lang === 'zh' ? '偏好设置' : lang === 'es' ? 'Preferencias' : 'Preferences'}
            </h1>
            <p className="text-xs text-muted-foreground">
              {lang === 'zh' 
                ? `${activeRiskCount} 个风险设置, ${activeAllergenCount} 个过敏原警报` 
                : lang === 'es' 
                ? `${activeRiskCount} sensibilidades, ${activeAllergenCount} alertas`
                : `${activeRiskCount} risk settings, ${activeAllergenCount} allergen alerts`}
            </p>
          </div>
          <Settings className="h-5 w-5 text-muted-foreground" />
        </div>
      </div>

      <div className="max-w-md mx-auto px-4 pt-4">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-4">
            <TabsTrigger value="risk" className="flex items-center gap-2" data-testid="tab-risk">
              <Shield className="w-4 h-4" />
              {lang === 'zh' ? '风险敏感度' : lang === 'es' ? 'Sensibilidad' : 'Risk Sensitivity'}
            </TabsTrigger>
            <TabsTrigger value="allergen" className="flex items-center gap-2" data-testid="tab-allergen">
              <AlertTriangle className="w-4 h-4" />
              {lang === 'zh' ? '过敏原警报' : lang === 'es' ? 'Alertas' : 'Allergen Alerts'}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="risk" className="space-y-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Shield className="w-4 h-4" />
                  {lang === 'zh' ? '关于风险敏感度' : lang === 'es' ? 'Acerca de Sensibilidad de Riesgo' : 'About Risk Sensitivity'}
                </CardTitle>
                <CardDescription className="text-xs">
                  {lang === 'zh' 
                    ? '设置您希望避免或谨慎使用的成分类别。这些偏好将调整扫描结果中相关成分的风险等级。' 
                    : lang === 'es' 
                    ? 'Configure las categorías de ingredientes que prefiere evitar. Estas ajustarán los niveles de riesgo en los resultados.'
                    : 'Configure ingredient categories you prefer to avoid. These will adjust risk levels in your scan results.'}
                </CardDescription>
              </CardHeader>
            </Card>

            {preferenceCategories.map((category) => (
              <Card key={category}>
                <CardContent className="py-3 px-4">
                  <div className="flex items-center gap-3 mb-2">
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

            <Card className="mt-6">
              <CardContent className="py-4">
                <Button
                  variant="outline"
                  className="w-full"
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
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-orange-500" />
                  {lang === 'zh' ? '关于过敏原警报' : lang === 'es' ? 'Acerca de Alertas de Alérgenos' : 'About Allergen Alerts'}
                </CardTitle>
                <CardDescription className="text-xs">
                  {lang === 'zh' 
                    ? '启用您希望标记的过敏原类别。这些不会影响风险评分，但会作为单独的警告显示。' 
                    : lang === 'es' 
                    ? 'Activa las categorías de alérgenos que deseas marcar. Estas no afectarán la puntuación de riesgo, pero aparecerán como advertencias.'
                    : 'Enable allergen categories you want flagged. These won\'t affect risk scores, but will appear as separate warnings.'}
                </CardDescription>
              </CardHeader>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <UtensilsCrossed className="w-4 h-4 text-orange-500" />
                  {lang === 'zh' ? '食物过敏原' : lang === 'es' ? 'Alérgenos Alimentarios' : 'Food Allergens'}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {foodAllergens.map((cat) => (
                  <div key={cat.key} className={cn(
                    "flex items-center justify-between p-3 rounded-lg border transition-all",
                    allergenPreferences[cat.key] ? "border-primary bg-primary/5" : "border-border"
                  )}>
                    <div className="flex-1 min-w-0 mr-3">
                      <div className="font-medium text-sm">{t(`allergens.categories.${cat.key}`)}</div>
                      <div className="text-xs text-muted-foreground/70 italic">
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

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Flower2 className="w-4 h-4 text-pink-500" />
                  {lang === 'zh' ? '化妆品过敏原' : lang === 'es' ? 'Alérgenos Cosméticos' : 'Cosmetic Allergens'}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {cosmeticAllergens.map((cat) => (
                  <div key={cat.key} className={cn(
                    "flex items-center justify-between p-3 rounded-lg border transition-all",
                    allergenPreferences[cat.key] ? "border-primary bg-primary/5" : "border-border"
                  )}>
                    <div className="flex-1 min-w-0 mr-3">
                      <div className="font-medium text-sm">{t(`allergens.categories.${cat.key}`)}</div>
                      <div className="text-xs text-muted-foreground/70 italic">
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

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <FlaskConical className="w-4 h-4 text-purple-500" />
                  {lang === 'zh' ? '化学添加剂' : lang === 'es' ? 'Aditivos Químicos' : 'Chemical Additives'}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {chemicalAllergens.map((cat) => (
                  <div key={cat.key} className={cn(
                    "flex items-center justify-between p-3 rounded-lg border transition-all",
                    allergenPreferences[cat.key] ? "border-primary bg-primary/5" : "border-border"
                  )}>
                    <div className="flex-1 min-w-0 mr-3">
                      <div className="font-medium text-sm">{t(`allergens.categories.${cat.key}`)}</div>
                      <div className="text-xs text-muted-foreground/70 italic">
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

      {hasChanges && (
        <div className="fixed bottom-0 left-0 right-0 bg-background border-t p-4 safe-area-pb">
          <div className="max-w-md mx-auto flex gap-3">
            <Button 
              variant="outline" 
              onClick={activeTab === 'risk' ? handleResetRisk : handleResetAllergen}
              className="flex-1"
              disabled={isPending}
              data-testid="button-reset"
            >
              {lang === 'zh' ? '重置' : lang === 'es' ? 'Restablecer' : 'Reset'}
            </Button>
            <Button 
              onClick={activeTab === 'risk' ? handleSaveRisk : handleSaveAllergen}
              className="flex-1"
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

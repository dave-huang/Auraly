import { useState } from "react";
import { useLocation, Link } from "wouter";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Check, Settings, RefreshCw } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { RiskPreferences, PreferenceCategory, RiskTolerance } from "@shared/schema";
import { defaultRiskPreferences, preferenceCategories } from "@shared/schema";
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
  allergens: { icon: "🚨", group: "allergens" },
  alcohols: { icon: "🍷", group: "allergens" },
};

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

  const options: { value: RiskTolerance; label: string; shortLabel: string; color: string }[] = [
    { 
      value: "no_preference", 
      label: lang === 'zh' ? '无偏好' : lang === 'es' ? 'Sin Pref.' : 'No Pref.',
      shortLabel: lang === 'zh' ? '默认' : lang === 'es' ? 'Def.' : 'Default',
      color: "border-muted-foreground/30 bg-muted/20"
    },
    { 
      value: "caution", 
      label: lang === 'zh' ? '谨慎' : lang === 'es' ? 'Precaución' : 'Caution',
      shortLabel: lang === 'zh' ? '慎' : lang === 'es' ? 'Prec.' : 'Caut.',
      color: "border-yellow-500 bg-yellow-500/10"
    },
    { 
      value: "avoid", 
      label: lang === 'zh' ? '避免' : lang === 'es' ? 'Evitar' : 'Avoid',
      shortLabel: lang === 'zh' ? '避' : lang === 'es' ? 'Evit.' : 'Avoid',
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
  const lang = i18n.language as 'en' | 'es' | 'zh';
  
  const [localPrefs, setLocalPrefs] = useState<RiskPreferences | null>(null);
  const [hasChanges, setHasChanges] = useState(false);

  const { data: prefsData, isLoading } = useQuery<{ preferences: RiskPreferences; onboardingCompleted: boolean }>({
    queryKey: ['/api/user/preferences'],
    staleTime: 0,
  });

  const preferences = localPrefs || prefsData?.preferences || defaultRiskPreferences;

  const updatePreferences = useMutation({
    mutationFn: async (prefs: Partial<RiskPreferences>) => {
      return apiRequest('PATCH', '/api/user/preferences', prefs);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/user/preferences'] });
      setHasChanges(false);
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

  const resetOnboarding = useMutation({
    mutationFn: async () => {
      return apiRequest('POST', '/api/user/reset-onboarding');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/user/preferences'] });
      navigate('/onboarding');
    },
  });

  const updatePreference = (category: PreferenceCategory, value: RiskTolerance) => {
    const newPrefs = { ...preferences, [category]: value };
    setLocalPrefs(newPrefs);
    setHasChanges(true);
  };

  const handleSave = () => {
    if (localPrefs) {
      updatePreferences.mutate(localPrefs);
    }
  };

  const handleReset = () => {
    setLocalPrefs({ ...defaultRiskPreferences });
    setHasChanges(true);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  const activeCount = Object.values(preferences).filter(v => v !== 'no_preference').length;

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
              {lang === 'zh' ? '风险偏好设置' : lang === 'es' ? 'Preferencias de Riesgo' : 'Risk Preferences'}
            </h1>
            <p className="text-xs text-muted-foreground">
              {activeCount > 0 
                ? (lang === 'zh' ? `${activeCount} 个活跃偏好` : lang === 'es' ? `${activeCount} preferencias activas` : `${activeCount} active preferences`)
                : (lang === 'zh' ? '使用默认风险评估' : lang === 'es' ? 'Usando evaluación predeterminada' : 'Using default assessment')}
            </p>
          </div>
          <Settings className="h-5 w-5 text-muted-foreground" />
        </div>
      </div>

      <div className="max-w-md mx-auto px-4 pt-4 space-y-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              {lang === 'zh' ? '关于风险偏好' : lang === 'es' ? 'Acerca de las Preferencias' : 'About Risk Preferences'}
            </CardTitle>
            <CardDescription className="text-xs">
              {lang === 'zh' 
                ? '设置您希望避免或谨慎使用的成分类别。这些偏好将调整扫描结果中相关成分的风险等级。' 
                : lang === 'es' 
                ? 'Configure las categorías de ingredientes que prefiere evitar o usar con precaución. Estas preferencias ajustarán los niveles de riesgo en los resultados del escaneo.'
                : 'Configure ingredient categories you prefer to avoid or use with caution. These preferences will adjust risk levels in your scan results.'}
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
                value={preferences[category]}
                onChange={(value) => updatePreference(category, value)}
                categoryKey={category}
                disabled={updatePreferences.isPending}
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
      </div>

      {hasChanges && (
        <div className="fixed bottom-0 left-0 right-0 bg-background border-t p-4 safe-area-pb">
          <div className="max-w-md mx-auto flex gap-3">
            <Button 
              variant="outline" 
              onClick={handleReset}
              className="flex-1"
              disabled={updatePreferences.isPending}
              data-testid="button-reset"
            >
              {lang === 'zh' ? '重置全部' : lang === 'es' ? 'Restablecer' : 'Reset All'}
            </Button>
            <Button 
              onClick={handleSave}
              className="flex-1"
              disabled={updatePreferences.isPending}
              data-testid="button-save"
            >
              {updatePreferences.isPending 
                ? (lang === 'zh' ? '保存中...' : lang === 'es' ? 'Guardando...' : 'Saving...')
                : (lang === 'zh' ? '保存更改' : lang === 'es' ? 'Guardar Cambios' : 'Save Changes')}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

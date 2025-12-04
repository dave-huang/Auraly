import { useState } from "react";
import { useLocation } from "wouter";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ChevronLeft, ChevronRight, Check, AlertTriangle, Shield, Sparkles } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { RiskPreferences, PreferenceCategory, RiskTolerance } from "@shared/schema";
import { defaultRiskPreferences, preferenceCategories } from "@shared/schema";
import { cn } from "@/lib/utils";

interface CategoryInfo {
  key: PreferenceCategory;
  icon: string;
  description: {
    en: string;
    es: string;
    zh: string;
  };
}

const categoryGroups = [
  {
    title: { en: "Fragrances & Colors", es: "Fragancias y Colores", zh: "香料与色素" },
    subtitle: { 
      en: "Synthetic additives used for scent and appearance", 
      es: "Aditivos sintéticos para aroma y apariencia",
      zh: "用于气味和外观的合成添加剂"
    },
    categories: [
      { 
        key: "artificial_fragrances" as PreferenceCategory, 
        icon: "🌸",
        description: { 
          en: "Synthetic scents that may cause sensitivities", 
          es: "Aromas sintéticos que pueden causar sensibilidades",
          zh: "可能引起敏感反应的合成香料"
        }
      },
      { 
        key: "artificial_colors" as PreferenceCategory, 
        icon: "🎨",
        description: { 
          en: "Synthetic dyes used for product coloring", 
          es: "Colorantes sintéticos para colorear productos",
          zh: "用于产品着色的合成染料"
        }
      },
      { 
        key: "fragrance_allergens" as PreferenceCategory, 
        icon: "⚠️",
        description: { 
          en: "EU-regulated allergens in fragrances", 
          es: "Alérgenos regulados por la UE en fragancias",
          zh: "欧盟规定的香料过敏原"
        }
      },
    ]
  },
  {
    title: { en: "Preservatives & Chemicals", es: "Conservantes y Químicos", zh: "防腐剂与化学品" },
    subtitle: { 
      en: "Chemicals used for product preservation", 
      es: "Químicos usados para la conservación de productos",
      zh: "用于产品保存的化学物质"
    },
    categories: [
      { 
        key: "preservatives" as PreferenceCategory, 
        icon: "🧪",
        description: { 
          en: "General preservatives and antimicrobials", 
          es: "Conservantes generales y antimicrobianos",
          zh: "一般防腐剂和抗菌剂"
        }
      },
      { 
        key: "parabens" as PreferenceCategory, 
        icon: "🔬",
        description: { 
          en: "Common preservatives with hormone concerns", 
          es: "Conservantes comunes con preocupaciones hormonales",
          zh: "与激素问题相关的常见防腐剂"
        }
      },
      { 
        key: "endocrine_disruptors" as PreferenceCategory, 
        icon: "⚗️",
        description: { 
          en: "Chemicals that may affect hormones", 
          es: "Químicos que pueden afectar las hormonas",
          zh: "可能影响激素的化学物质"
        }
      },
    ]
  },
  {
    title: { en: "Surfactants & Texturizers", es: "Surfactantes y Texturizantes", zh: "表面活性剂与质地改良剂" },
    subtitle: { 
      en: "Ingredients that affect product texture and cleansing", 
      es: "Ingredientes que afectan la textura y limpieza",
      zh: "影响产品质地和清洁效果的成分"
    },
    categories: [
      { 
        key: "sulfates" as PreferenceCategory, 
        icon: "🫧",
        description: { 
          en: "Strong cleansers that may irritate skin", 
          es: "Limpiadores fuertes que pueden irritar la piel",
          zh: "可能刺激皮肤的强效清洁剂"
        }
      },
      { 
        key: "silicones" as PreferenceCategory, 
        icon: "✨",
        description: { 
          en: "Synthetic polymers for smoothness", 
          es: "Polímeros sintéticos para suavidad",
          zh: "用于光滑效果的合成聚合物"
        }
      },
      { 
        key: "pegs_ethoxylated" as PreferenceCategory, 
        icon: "💧",
        description: { 
          en: "Ethoxylated compounds with purity concerns", 
          es: "Compuestos etoxilados con preocupaciones de pureza",
          zh: "存在纯度问题的乙氧基化合物"
        }
      },
    ]
  },
  {
    title: { en: "Allergens & Alcohols", es: "Alérgenos y Alcoholes", zh: "过敏原与酒精" },
    subtitle: { 
      en: "Common sensitizers and drying agents", 
      es: "Sensibilizantes comunes y agentes secantes",
      zh: "常见致敏剂和干燥剂"
    },
    categories: [
      { 
        key: "allergens" as PreferenceCategory, 
        icon: "🚨",
        description: { 
          en: "Common contact allergens", 
          es: "Alérgenos de contacto comunes",
          zh: "常见接触性过敏原"
        }
      },
      { 
        key: "alcohols" as PreferenceCategory, 
        icon: "🍷",
        description: { 
          en: "Drying alcohols that may irritate", 
          es: "Alcoholes secantes que pueden irritar",
          zh: "可能刺激的干燥性酒精"
        }
      },
    ]
  }
];

function ToleranceSelector({ 
  value, 
  onChange,
  categoryKey
}: { 
  value: RiskTolerance; 
  onChange: (value: RiskTolerance) => void;
  categoryKey: PreferenceCategory;
}) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;

  const options: { value: RiskTolerance; label: string; description: string; color: string }[] = [
    { 
      value: "no_preference", 
      label: lang === 'zh' ? '无偏好' : lang === 'es' ? 'Sin Preferencia' : 'No Preference',
      description: lang === 'zh' ? '使用基于科学的风险评估' : lang === 'es' ? 'Usar evaluación de riesgo científica' : 'Use scientific risk assessment',
      color: "border-muted-foreground/30 bg-muted/20"
    },
    { 
      value: "caution", 
      label: lang === 'zh' ? '谨慎使用' : lang === 'es' ? 'Usar con Precaución' : 'Use with Caution',
      description: lang === 'zh' ? '提升风险等级一级' : lang === 'es' ? 'Elevar nivel de riesgo uno' : 'Elevate risk level by one',
      color: "border-yellow-500 bg-yellow-500/10"
    },
    { 
      value: "avoid", 
      label: lang === 'zh' ? '完全避免' : lang === 'es' ? 'Evitar Completamente' : 'Avoid Completely',
      description: lang === 'zh' ? '标记为高风险' : lang === 'es' ? 'Marcar como alto riesgo' : 'Mark as high risk',
      color: "border-red-500 bg-red-500/10"
    },
  ];

  return (
    <div className="flex flex-col gap-2">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          data-testid={`tolerance-${categoryKey}-${option.value}`}
          onClick={() => onChange(option.value)}
          className={cn(
            "flex items-center justify-between p-3 rounded-lg border-2 transition-all text-left",
            value === option.value 
              ? option.color + " ring-2 ring-offset-2 ring-primary" 
              : "border-border hover-elevate"
          )}
        >
          <div>
            <div className="font-medium text-sm">{option.label}</div>
            <div className="text-xs text-muted-foreground">{option.description}</div>
          </div>
          {value === option.value && (
            <Check className="h-5 w-5 text-primary shrink-0" />
          )}
        </button>
      ))}
    </div>
  );
}

export default function OnboardingPage() {
  const [, navigate] = useLocation();
  const { t, i18n } = useTranslation();
  const lang = i18n.language as 'en' | 'es' | 'zh';
  
  const [currentStep, setCurrentStep] = useState(0);
  const [preferences, setPreferences] = useState<RiskPreferences>({ ...defaultRiskPreferences });
  
  const totalSteps = categoryGroups.length + 2;
  const progress = ((currentStep + 1) / totalSteps) * 100;

  const { data: existingPrefs } = useQuery({
    queryKey: ['/api/user/preferences'],
    staleTime: 0,
  });

  const completeOnboarding = useMutation({
    mutationFn: async (prefs: RiskPreferences) => {
      return apiRequest('POST', '/api/user/onboarding', prefs);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/user/preferences'] });
      queryClient.invalidateQueries({ queryKey: ['/api/auth/user'] });
      navigate('/upload');
    },
  });

  const handleNext = () => {
    if (currentStep < totalSteps - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleComplete = () => {
    completeOnboarding.mutate(preferences);
  };

  const handleSkip = () => {
    completeOnboarding.mutate(defaultRiskPreferences);
  };

  const updatePreference = (category: PreferenceCategory, value: RiskTolerance) => {
    setPreferences(prev => ({ ...prev, [category]: value }));
  };

  const renderWelcomeStep = () => (
    <div className="flex flex-col items-center text-center py-6 space-y-6">
      <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center">
        <Sparkles className="w-10 h-10 text-primary" />
      </div>
      <div>
        <h2 className="text-2xl font-bold mb-2">
          {lang === 'zh' ? '个性化您的风险设置' : lang === 'es' ? 'Personaliza tu Configuración de Riesgos' : 'Personalize Your Risk Settings'}
        </h2>
        <p className="text-muted-foreground max-w-sm">
          {lang === 'zh' 
            ? '告诉我们您希望避免或谨慎对待哪些成分类别。这有助于我们为您提供个性化的风险评估。' 
            : lang === 'es' 
            ? 'Cuéntanos qué categorías de ingredientes prefieres evitar o usar con precaución. Esto nos ayuda a personalizar las evaluaciones de riesgo para ti.'
            : 'Tell us which ingredient categories you prefer to avoid or use with caution. This helps us personalize risk assessments for you.'}
        </p>
      </div>
      <div className="flex flex-col gap-4 w-full max-w-xs">
        <div className="flex items-center gap-3 text-left p-3 rounded-lg bg-muted/50">
          <Shield className="w-5 h-5 text-primary shrink-0" />
          <div className="text-sm">
            {lang === 'zh' ? '根据您的偏好调整风险评估' : lang === 'es' ? 'Evaluaciones de riesgo ajustadas a tus preferencias' : 'Risk assessments adjusted to your preferences'}
          </div>
        </div>
        <div className="flex items-center gap-3 text-left p-3 rounded-lg bg-muted/50">
          <AlertTriangle className="w-5 h-5 text-yellow-500 shrink-0" />
          <div className="text-sm">
            {lang === 'zh' ? '突出显示您关心的成分' : lang === 'es' ? 'Destacar ingredientes que te importan' : 'Highlight ingredients you care about'}
          </div>
        </div>
      </div>
    </div>
  );

  const renderCategoryStep = (groupIndex: number) => {
    const group = categoryGroups[groupIndex];
    return (
      <div className="py-4 space-y-4">
        <div className="text-center mb-6">
          <h2 className="text-xl font-bold">{group.title[lang] || group.title.en}</h2>
          <p className="text-sm text-muted-foreground mt-1">{group.subtitle[lang] || group.subtitle.en}</p>
        </div>
        
        {group.categories.map((category) => (
          <Card key={category.key} className="overflow-hidden">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <span className="text-xl">{category.icon}</span>
                {t(`preferences.categories.${category.key}`)}
              </CardTitle>
              <CardDescription className="text-xs">
                {category.description[lang] || category.description.en}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ToleranceSelector
                value={preferences[category.key]}
                onChange={(value) => updatePreference(category.key, value)}
                categoryKey={category.key}
              />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  };

  const renderSummaryStep = () => {
    const activePrefs = Object.entries(preferences).filter(
      ([_, value]) => value !== 'no_preference'
    );
    
    return (
      <div className="py-6 space-y-6">
        <div className="text-center">
          <div className="w-16 h-16 rounded-full bg-green-500/10 flex items-center justify-center mx-auto mb-4">
            <Check className="w-8 h-8 text-green-500" />
          </div>
          <h2 className="text-xl font-bold">
            {lang === 'zh' ? '设置完成！' : lang === 'es' ? '¡Configuración Completa!' : 'Setup Complete!'}
          </h2>
          <p className="text-sm text-muted-foreground mt-2">
            {lang === 'zh' 
              ? '您可以随时在设置中更改这些偏好' 
              : lang === 'es' 
              ? 'Puedes cambiar estas preferencias en cualquier momento desde Configuración'
              : 'You can change these preferences anytime from Settings'}
          </p>
        </div>

        {activePrefs.length > 0 ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                {lang === 'zh' ? '您的偏好设置' : lang === 'es' ? 'Tus Preferencias' : 'Your Preferences'}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {activePrefs.map(([key, value]) => (
                <div key={key} className="flex items-center justify-between py-2 border-b last:border-0">
                  <span className="text-sm">{t(`preferences.categories.${key}`)}</span>
                  <span className={cn(
                    "text-xs font-medium px-2 py-1 rounded",
                    value === 'avoid' ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" : "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400"
                  )}>
                    {value === 'avoid' 
                      ? (lang === 'zh' ? '避免' : lang === 'es' ? 'Evitar' : 'Avoid')
                      : (lang === 'zh' ? '谨慎' : lang === 'es' ? 'Precaución' : 'Caution')}
                  </span>
                </div>
              ))}
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="py-6 text-center text-muted-foreground">
              {lang === 'zh' 
                ? '未设置任何偏好 - 将使用标准科学风险评估' 
                : lang === 'es' 
                ? 'Sin preferencias establecidas - se usará la evaluación de riesgo científica estándar'
                : 'No preferences set - standard scientific risk assessment will be used'}
            </CardContent>
          </Card>
        )}
      </div>
    );
  };

  const renderCurrentStep = () => {
    if (currentStep === 0) {
      return renderWelcomeStep();
    } else if (currentStep > 0 && currentStep <= categoryGroups.length) {
      return renderCategoryStep(currentStep - 1);
    } else {
      return renderSummaryStep();
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <div className="flex-1 overflow-auto pb-24">
        <div className="max-w-md mx-auto px-4 pt-6">
          <Progress value={progress} className="h-2 mb-6" data-testid="onboarding-progress" />
          
          <div className="text-xs text-center text-muted-foreground mb-4">
            {lang === 'zh' 
              ? `第 ${currentStep + 1} 步，共 ${totalSteps} 步` 
              : lang === 'es' 
              ? `Paso ${currentStep + 1} de ${totalSteps}`
              : `Step ${currentStep + 1} of ${totalSteps}`}
          </div>

          {renderCurrentStep()}
        </div>
      </div>

      <div className="fixed bottom-0 left-0 right-0 bg-background border-t p-4 safe-area-pb">
        <div className="max-w-md mx-auto flex gap-3">
          {currentStep > 0 && (
            <Button 
              variant="outline" 
              onClick={handlePrev}
              className="flex-1"
              data-testid="button-prev"
            >
              <ChevronLeft className="w-4 h-4 mr-1" />
              {lang === 'zh' ? '上一步' : lang === 'es' ? 'Anterior' : 'Back'}
            </Button>
          )}
          
          {currentStep === 0 && (
            <Button 
              variant="ghost" 
              onClick={handleSkip}
              className="flex-1"
              data-testid="button-skip"
            >
              {lang === 'zh' ? '跳过' : lang === 'es' ? 'Omitir' : 'Skip'}
            </Button>
          )}
          
          {currentStep < totalSteps - 1 ? (
            <Button 
              onClick={handleNext}
              className="flex-1"
              data-testid="button-next"
            >
              {lang === 'zh' ? '下一步' : lang === 'es' ? 'Siguiente' : 'Next'}
              <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          ) : (
            <Button 
              onClick={handleComplete}
              className="flex-1"
              disabled={completeOnboarding.isPending}
              data-testid="button-complete"
            >
              {completeOnboarding.isPending 
                ? (lang === 'zh' ? '保存中...' : lang === 'es' ? 'Guardando...' : 'Saving...')
                : (lang === 'zh' ? '开始扫描' : lang === 'es' ? 'Empezar a Escanear' : 'Start Scanning')}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

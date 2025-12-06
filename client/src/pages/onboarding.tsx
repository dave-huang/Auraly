import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { ChevronLeft, ChevronRight, Check, AlertTriangle, Shield, Sparkles, UtensilsCrossed, Flower2, FlaskConical } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { RiskPreferences, AllergenPreferences, PreferenceCategory, AllergenCategory, RiskTolerance } from "@shared/schema";
import { defaultRiskPreferences, defaultAllergenPreferences, preferenceCategories, allergenCategories } from "@shared/schema";
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

interface AllergenCategoryInfo {
  key: AllergenCategory;
  example: {
    en: string;
    es: string;
    zh: string;
  };
  description: {
    en: string;
    es: string;
    zh: string;
  };
}

const riskCategoryGroups = [
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
    title: { en: "Sensitizers & Alcohols", es: "Sensibilizantes y Alcoholes", zh: "致敏剂与酒精" },
    subtitle: { 
      en: "Common contact sensitizers and drying agents", 
      es: "Sensibilizantes de contacto comunes y agentes secantes",
      zh: "常见接触性致敏剂和干燥剂"
    },
    categories: [
      { 
        key: "contact_sensitizers" as PreferenceCategory, 
        icon: "🚨",
        description: { 
          en: "Common contact sensitizers like nickel, lanolin", 
          es: "Sensibilizantes de contacto comunes como níquel, lanolina",
          zh: "常见接触性致敏剂如镍、羊毛脂"
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

const allergenCategoryGroups = [
  {
    id: "food",
    title: { en: "Food-Derived Allergens", es: "Alérgenos Alimentarios", zh: "食物过敏原" },
    subtitle: { 
      en: "Common food allergens found in products", 
      es: "Alérgenos alimentarios comunes en productos",
      zh: "产品中常见的食物过敏原"
    },
    icon: UtensilsCrossed,
    categories: [
      { 
        key: "nuts" as AllergenCategory,
        example: { en: "Almonds, peanuts, shea butter", es: "Almendras, cacahuetes, manteca de karité", zh: "杏仁、花生、乳木果油" },
        description: { en: "Tree nuts and nut-derived ingredients", es: "Frutos secos e ingredientes derivados", zh: "坚果及坚果衍生成分" }
      },
      { 
        key: "soy" as AllergenCategory,
        example: { en: "Soy lecithin, soy protein", es: "Lecitina de soja, proteína de soja", zh: "大豆卵磷脂、大豆蛋白" },
        description: { en: "Soybean-derived ingredients", es: "Ingredientes derivados de soja", zh: "大豆衍生成分" }
      },
      { 
        key: "dairy" as AllergenCategory,
        example: { en: "Milk, lactose, casein, whey", es: "Leche, lactosa, caseína, suero", zh: "牛奶、乳糖、酪蛋白、乳清" },
        description: { en: "Milk and dairy-derived ingredients", es: "Leche e ingredientes lácteos", zh: "牛奶及乳制品成分" }
      },
      { 
        key: "gluten_wheat" as AllergenCategory,
        example: { en: "Wheat, barley, oat extracts", es: "Trigo, cebada, extractos de avena", zh: "小麦、大麦、燕麦提取物" },
        description: { en: "Gluten-containing grains", es: "Granos que contienen gluten", zh: "含麸质谷物" }
      },
      { 
        key: "eggs" as AllergenCategory,
        example: { en: "Albumin, lysozyme", es: "Albúmina, lisozima", zh: "白蛋白、溶菌酶" },
        description: { en: "Egg-derived ingredients", es: "Ingredientes derivados del huevo", zh: "鸡蛋衍生成分" }
      },
      { 
        key: "seafood_shellfish" as AllergenCategory,
        example: { en: "Fish oil, chitosan, marine collagen", es: "Aceite de pescado, quitosano, colágeno marino", zh: "鱼油、壳聚糖、海洋胶原蛋白" },
        description: { en: "Fish and shellfish-derived ingredients", es: "Ingredientes de pescado y mariscos", zh: "鱼类和贝类衍生成分" }
      },
    ]
  },
  {
    id: "cosmetic",
    title: { en: "Cosmetic Allergens", es: "Alérgenos Cosméticos", zh: "化妆品过敏原" },
    subtitle: { 
      en: "Common allergens in personal care products", 
      es: "Alérgenos comunes en productos de cuidado personal",
      zh: "个人护理产品中的常见过敏原"
    },
    icon: Flower2,
    categories: [
      { 
        key: "fragrance_allergens_cosmetic" as AllergenCategory,
        example: { en: "Limonene, linalool, coumarin", es: "Limoneno, linalool, cumarina", zh: "柠檬烯、芳樟醇、香豆素" },
        description: { en: "EU-regulated fragrance allergens", es: "Alérgenos de fragancia regulados por la UE", zh: "欧盟规定的香料过敏原" }
      },
      { 
        key: "preservative_allergens" as AllergenCategory,
        example: { en: "MI, MCI, formaldehyde releasers", es: "MI, MCI, liberadores de formaldehído", zh: "MI、MCI、甲醛释放剂" },
        description: { en: "Common sensitizing preservatives", es: "Conservantes sensibilizantes comunes", zh: "常见致敏防腐剂" }
      },
      { 
        key: "lanolin" as AllergenCategory,
        example: { en: "Lanolin, wool wax, laneth", es: "Lanolina, cera de lana, laneth", zh: "羊毛脂、羊毛蜡" },
        description: { en: "Wool-derived moisturizing agents", es: "Agentes hidratantes derivados de lana", zh: "羊毛衍生保湿剂" }
      },
      { 
        key: "botanical_extracts" as AllergenCategory,
        example: { en: "Essential oils, propolis, arnica", es: "Aceites esenciales, propóleo, árnica", zh: "精油、蜂胶、山金车" },
        description: { en: "Plant-derived sensitizers", es: "Sensibilizantes de origen vegetal", zh: "植物衍生致敏成分" }
      },
    ]
  },
  {
    id: "chemical",
    title: { en: "Chemical Additive Allergens", es: "Alérgenos de Aditivos Químicos", zh: "化学添加剂过敏原" },
    subtitle: { 
      en: "Synthetic additives that may cause reactions", 
      es: "Aditivos sintéticos que pueden causar reacciones",
      zh: "可能引起反应的合成添加剂"
    },
    icon: FlaskConical,
    categories: [
      { 
        key: "colorants_dyes" as AllergenCategory,
        example: { en: "FD&C dyes, CI numbers, PPD", es: "Colorantes FD&C, números CI, PPD", zh: "FD&C染料、CI编号、PPD" },
        description: { en: "Synthetic colorants and dyes", es: "Colorantes y tintes sintéticos", zh: "合成着色剂和染料" }
      },
      { 
        key: "drying_alcohols" as AllergenCategory,
        example: { en: "SD alcohol, isopropanol, ethanol", es: "SD alcohol, isopropanol, etanol", zh: "SD酒精、异丙醇、乙醇" },
        description: { en: "Alcohols that may dry and irritate", es: "Alcoholes que pueden secar e irritar", zh: "可能导致干燥和刺激的酒精" }
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

  const options: { value: RiskTolerance; label: string; description: string; color: string; selectedColor: string }[] = [
    { 
      value: "no_preference", 
      label: lang === 'zh' ? '无偏好' : lang === 'es' ? 'Sin Preferencia' : 'No Preference',
      description: lang === 'zh' ? '使用基于科学的风险评估' : lang === 'es' ? 'Usar evaluación de riesgo científica' : 'Use scientific risk assessment',
      color: "border-border/50 bg-card/30",
      selectedColor: "border-primary/40 bg-primary/5 ring-2 ring-primary/20"
    },
    { 
      value: "caution", 
      label: lang === 'zh' ? '谨慎使用' : lang === 'es' ? 'Usar con Precaución' : 'Use with Caution',
      description: lang === 'zh' ? '提升风险等级一级' : lang === 'es' ? 'Elevar nivel de riesgo uno' : 'Elevate risk level by one',
      color: "border-border/50 bg-card/30",
      selectedColor: "border-amber-400/50 bg-amber-50/50 dark:bg-amber-950/20 ring-2 ring-amber-400/20"
    },
    { 
      value: "avoid", 
      label: lang === 'zh' ? '完全避免' : lang === 'es' ? 'Evitar Completamente' : 'Avoid Completely',
      description: lang === 'zh' ? '标记为高风险' : lang === 'es' ? 'Marcar como alto riesgo' : 'Mark as high risk',
      color: "border-border/50 bg-card/30",
      selectedColor: "border-rose-400/50 bg-rose-50/50 dark:bg-rose-950/20 ring-2 ring-rose-400/20"
    },
  ];

  return (
    <div className="flex flex-col gap-2.5">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          data-testid={`tolerance-${categoryKey}-${option.value}`}
          onClick={() => onChange(option.value)}
          className={cn(
            "flex items-center justify-between p-4 rounded-xl border transition-all text-left",
            value === option.value 
              ? option.selectedColor
              : option.color + " hover:bg-card/60"
          )}
        >
          <div>
            <div className="font-medium text-sm">{option.label}</div>
            <div className="text-xs text-muted-foreground/70 font-light mt-0.5">{option.description}</div>
          </div>
          {value === option.value && (
            <Check className="h-4 w-4 text-primary shrink-0" />
          )}
        </button>
      ))}
    </div>
  );
}

function AllergenToggle({
  category,
  enabled,
  onToggle,
  lang
}: {
  category: AllergenCategoryInfo;
  enabled: boolean;
  onToggle: (enabled: boolean) => void;
  lang: 'en' | 'es' | 'zh';
}) {
  const { t } = useTranslation();
  
  return (
    <div 
      className={cn(
        "flex items-center justify-between p-4 rounded-xl border transition-all",
        enabled 
          ? "border-primary/40 bg-primary/5 ring-1 ring-primary/10" 
          : "border-border/40 bg-card/30 hover:bg-card/50"
      )}
    >
      <div className="flex-1 min-w-0 mr-4">
        <div className="font-medium text-sm">
          {t(`allergens.categories.${category.key}`)}
        </div>
        <div className="text-xs text-muted-foreground/70 font-light mt-1">
          {category.description[lang] || category.description.en}
        </div>
        <div className="text-xs text-muted-foreground/50 mt-1.5 font-light italic">
          {lang === 'zh' ? '例如：' : lang === 'es' ? 'Ej: ' : 'e.g. '}
          {category.example[lang] || category.example.en}
        </div>
      </div>
      <Switch
        checked={enabled}
        onCheckedChange={onToggle}
        data-testid={`allergen-toggle-${category.key}`}
      />
    </div>
  );
}

export default function OnboardingPage() {
  const [, navigate] = useLocation();
  const { t, i18n } = useTranslation();
  const lang = (i18n.language?.substring(0, 2) || 'en') as 'en' | 'es' | 'zh';
  
  const [currentStep, setCurrentStep] = useState(0);
  const [preferences, setPreferences] = useState<RiskPreferences>({ ...defaultRiskPreferences });
  const [allergenPreferences, setAllergenPreferences] = useState<AllergenPreferences>({ ...defaultAllergenPreferences });
  const [hasLoadedPrefs, setHasLoadedPrefs] = useState(false);
  
  const riskSteps = riskCategoryGroups.length;
  const allergenSteps = allergenCategoryGroups.length;
  const totalSteps = 1 + riskSteps + 1 + allergenSteps + 1;
  const progress = ((currentStep + 1) / totalSteps) * 100;

  const { data: existingRiskPrefs } = useQuery<{ preferences: RiskPreferences }>({
    queryKey: ['/api/user/preferences'],
    staleTime: 0,
  });

  const { data: existingAllergenPrefs } = useQuery<{ preferences: AllergenPreferences }>({
    queryKey: ['/api/user/allergen-preferences'],
    staleTime: 0,
  });

  useEffect(() => {
    if (!hasLoadedPrefs && existingRiskPrefs?.preferences) {
      setPreferences(existingRiskPrefs.preferences);
    }
    if (!hasLoadedPrefs && existingAllergenPrefs?.preferences) {
      setAllergenPreferences(existingAllergenPrefs.preferences);
    }
    if (existingRiskPrefs?.preferences || existingAllergenPrefs?.preferences) {
      setHasLoadedPrefs(true);
    }
  }, [existingRiskPrefs, existingAllergenPrefs, hasLoadedPrefs]);

  const completeOnboarding = useMutation({
    mutationFn: async (prefs: RiskPreferences) => {
      return apiRequest('POST', '/api/user/onboarding', prefs);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/user/preferences'] });
      queryClient.invalidateQueries({ queryKey: ['/api/auth/user'] });
    },
  });

  const completeAllergenOnboarding = useMutation({
    mutationFn: async (prefs: AllergenPreferences) => {
      return apiRequest('POST', '/api/user/allergen-onboarding', prefs);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/user/allergen-preferences'] });
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

  const handleComplete = async () => {
    await completeOnboarding.mutateAsync(preferences);
    await completeAllergenOnboarding.mutateAsync(allergenPreferences);
  };

  const handleSkip = async () => {
    await completeOnboarding.mutateAsync(defaultRiskPreferences);
    await completeAllergenOnboarding.mutateAsync(defaultAllergenPreferences);
  };

  const updatePreference = (category: PreferenceCategory, value: RiskTolerance) => {
    setPreferences(prev => ({ ...prev, [category]: value }));
  };

  const updateAllergenPreference = (category: AllergenCategory, enabled: boolean) => {
    setAllergenPreferences(prev => ({ ...prev, [category]: enabled }));
  };

  const renderWelcomeStep = () => (
    <div className="flex flex-col items-center text-center py-8 space-y-8">
      <div className="w-24 h-24 rounded-full bg-primary/10 flex items-center justify-center">
        <Sparkles className="w-12 h-12 text-primary" />
      </div>
      <div>
        <h2 className="font-display text-3xl mb-3">
          {lang === 'zh' ? '个性化您的设置' : lang === 'es' ? 'Personaliza tu Configuración' : 'Personalize Your Settings'}
        </h2>
        <p className="text-muted-foreground/80 font-light max-w-sm leading-relaxed">
          {lang === 'zh' 
            ? '告诉我们您希望避免哪些成分和过敏原。这有助于我们为您提供个性化的风险评估。' 
            : lang === 'es' 
            ? 'Cuéntanos qué ingredientes y alérgenos prefieres evitar. Esto nos ayuda a personalizar las evaluaciones para ti.'
            : 'Tell us which ingredients and allergens you prefer to avoid. This helps us personalize assessments for you.'}
        </p>
      </div>
      <div className="flex flex-col gap-3 w-full max-w-xs">
        <div className="flex items-center gap-4 text-left p-4 rounded-xl bg-card/50 border border-border/30">
          <div className="p-2 rounded-full bg-primary/10">
            <Shield className="w-4 h-4 text-primary shrink-0" />
          </div>
          <div className="text-sm font-light">
            {lang === 'zh' ? '根据您的偏好调整风险评估' : lang === 'es' ? 'Evaluaciones de riesgo ajustadas a tus preferencias' : 'Risk assessments adjusted to your preferences'}
          </div>
        </div>
        <div className="flex items-center gap-4 text-left p-4 rounded-xl bg-card/50 border border-border/30">
          <div className="p-2 rounded-full bg-amber-500/10">
            <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
          </div>
          <div className="text-sm font-light">
            {lang === 'zh' ? '标记您的过敏原' : lang === 'es' ? 'Marcar tus alérgenos' : 'Flag your allergens'}
          </div>
        </div>
      </div>
    </div>
  );

  const renderRiskCategoryStep = (groupIndex: number) => {
    const group = riskCategoryGroups[groupIndex];
    return (
      <div className="py-6 space-y-5">
        <div className="text-center mb-8">
          <h2 className="font-display text-2xl mb-2">{group.title[lang] || group.title.en}</h2>
          <p className="text-sm text-muted-foreground/70 font-light">{group.subtitle[lang] || group.subtitle.en}</p>
        </div>
        
        {group.categories.map((category) => (
          <Card key={category.key} className="overflow-hidden rounded-xl border-border/30 bg-card/50">
            <CardHeader className="pb-3 pt-5 px-5">
              <CardTitle className="flex items-center gap-3 text-base font-display">
                <span className="text-xl">{category.icon}</span>
                {t(`preferences.categories.${category.key}`)}
              </CardTitle>
              <CardDescription className="text-xs font-light text-muted-foreground/70 mt-1">
                {category.description[lang] || category.description.en}
              </CardDescription>
            </CardHeader>
            <CardContent className="px-5 pb-5">
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

  const renderAllergenIntroStep = () => (
    <div className="flex flex-col items-center text-center py-8 space-y-8">
      <div className="w-24 h-24 rounded-full bg-amber-500/10 flex items-center justify-center">
        <AlertTriangle className="w-12 h-12 text-amber-500" />
      </div>
      <div>
        <h2 className="font-display text-3xl mb-3">
          {lang === 'zh' ? '您的成分敏感性' : lang === 'es' ? 'Tus Sensibilidades a Ingredientes' : 'Your Ingredient Sensitivities'}
        </h2>
        <p className="text-muted-foreground/80 font-light max-w-sm leading-relaxed">
          {lang === 'zh' 
            ? '选择您希望在产品中标记的过敏原类别。这些不会影响风险评分，但会作为警告显示。' 
            : lang === 'es' 
            ? 'Selecciona las categorías de alérgenos que deseas marcar en los productos. Estos no afectarán la puntuación de riesgo, pero se mostrarán como advertencias.'
            : 'Select allergen categories you want flagged in products. These won\'t affect risk scores, but will appear as warnings.'}
        </p>
      </div>
      <div className="flex flex-col gap-3 w-full max-w-xs text-left">
        <div className="flex items-center gap-4 p-4 rounded-xl bg-card/50 border border-border/30">
          <div className="p-2 rounded-full bg-amber-500/10">
            <UtensilsCrossed className="w-4 h-4 text-amber-500 shrink-0" />
          </div>
          <div className="text-sm font-light">
            {lang === 'zh' ? '食物过敏原（坚果、乳制品等）' : lang === 'es' ? 'Alérgenos alimentarios (frutos secos, lácteos, etc.)' : 'Food allergens (nuts, dairy, etc.)'}
          </div>
        </div>
        <div className="flex items-center gap-4 p-4 rounded-xl bg-card/50 border border-border/30">
          <div className="p-2 rounded-full bg-rose-500/10">
            <Flower2 className="w-4 h-4 text-rose-400 shrink-0" />
          </div>
          <div className="text-sm font-light">
            {lang === 'zh' ? '化妆品过敏原（香料、防腐剂等）' : lang === 'es' ? 'Alérgenos cosméticos (fragancias, conservantes, etc.)' : 'Cosmetic allergens (fragrances, preservatives, etc.)'}
          </div>
        </div>
        <div className="flex items-center gap-4 p-4 rounded-xl bg-card/50 border border-border/30">
          <div className="p-2 rounded-full bg-violet-500/10">
            <FlaskConical className="w-4 h-4 text-violet-400 shrink-0" />
          </div>
          <div className="text-sm font-light">
            {lang === 'zh' ? '化学添加剂（染料、酒精等）' : lang === 'es' ? 'Aditivos químicos (tintes, alcoholes, etc.)' : 'Chemical additives (dyes, alcohols, etc.)'}
          </div>
        </div>
      </div>
    </div>
  );

  const renderAllergenCategoryStep = (groupIndex: number) => {
    const group = allergenCategoryGroups[groupIndex];
    const IconComponent = group.icon;
    const groupColor = group.id === 'food' ? 'amber' : group.id === 'cosmetic' ? 'rose' : 'violet';
    
    return (
      <div className="py-6 space-y-5">
        <div className="text-center mb-8">
          <div className={cn(
            "w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4",
            groupColor === 'amber' ? "bg-amber-500/10" :
            groupColor === 'rose' ? "bg-rose-500/10" : "bg-violet-500/10"
          )}>
            <IconComponent className={cn(
              "w-7 h-7",
              groupColor === 'amber' ? "text-amber-500" :
              groupColor === 'rose' ? "text-rose-400" : "text-violet-400"
            )} />
          </div>
          <h2 className="font-display text-2xl mb-2">{group.title[lang] || group.title.en}</h2>
          <p className="text-sm text-muted-foreground/70 font-light">{group.subtitle[lang] || group.subtitle.en}</p>
        </div>
        
        <div className="space-y-3">
          {group.categories.map((category) => (
            <AllergenToggle
              key={category.key}
              category={category}
              enabled={allergenPreferences[category.key]}
              onToggle={(enabled) => updateAllergenPreference(category.key, enabled)}
              lang={lang}
            />
          ))}
        </div>
      </div>
    );
  };

  const renderSummaryStep = () => {
    const activeRiskPrefs = Object.entries(preferences).filter(
      ([_, value]) => value !== 'no_preference'
    );
    const activeAllergenPrefs = Object.entries(allergenPreferences).filter(
      ([_, value]) => value === true
    );
    
    return (
      <div className="py-8 space-y-6">
        <div className="text-center">
          <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-5">
            <Check className="w-10 h-10 text-primary" />
          </div>
          <h2 className="font-display text-3xl mb-3">
            {lang === 'zh' ? '设置完成！' : lang === 'es' ? '¡Configuración Completa!' : 'Setup Complete!'}
          </h2>
          <p className="text-sm text-muted-foreground/70 font-light">
            {lang === 'zh' 
              ? '您可以随时在设置中更改这些偏好' 
              : lang === 'es' 
              ? 'Puedes cambiar estas preferencias en cualquier momento desde Configuración'
              : 'You can change these preferences anytime from Settings'}
          </p>
        </div>

        {activeRiskPrefs.length > 0 && (
          <Card className="rounded-xl border-border/30 bg-card/50">
            <CardHeader className="pb-3 pt-5 px-5">
              <CardTitle className="text-base font-display flex items-center gap-3">
                <div className="p-2 rounded-full bg-primary/10">
                  <Shield className="w-4 h-4 text-primary" />
                </div>
                {lang === 'zh' ? '风险偏好' : lang === 'es' ? 'Preferencias de Riesgo' : 'Risk Preferences'}
              </CardTitle>
            </CardHeader>
            <CardContent className="px-5 pb-5 space-y-2">
              {activeRiskPrefs.map(([key, value]) => (
                <div key={key} className="flex items-center justify-between py-2.5 border-b border-border/20 last:border-0">
                  <span className="text-sm font-light">{t(`preferences.categories.${key}`)}</span>
                  <span className={cn(
                    "text-xs font-medium px-2.5 py-1 rounded-full",
                    value === 'avoid' 
                      ? "bg-rose-100/60 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400" 
                      : "bg-amber-100/60 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                  )}>
                    {value === 'avoid' 
                      ? (lang === 'zh' ? '避免' : lang === 'es' ? 'Evitar' : 'Avoid')
                      : (lang === 'zh' ? '谨慎' : lang === 'es' ? 'Precaución' : 'Caution')}
                  </span>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {activeAllergenPrefs.length > 0 && (
          <Card className="rounded-xl border-border/30 bg-card/50">
            <CardHeader className="pb-3 pt-5 px-5">
              <CardTitle className="text-base font-display flex items-center gap-3">
                <div className="p-2 rounded-full bg-amber-500/10">
                  <AlertTriangle className="w-4 h-4 text-amber-500" />
                </div>
                {lang === 'zh' ? '过敏原警报' : lang === 'es' ? 'Alertas de Alérgenos' : 'Allergen Alerts'}
              </CardTitle>
            </CardHeader>
            <CardContent className="px-5 pb-5">
              <div className="flex flex-wrap gap-2">
                {activeAllergenPrefs.map(([key]) => (
                  <span key={key} className="text-xs font-medium px-3 py-1.5 rounded-full bg-amber-100/60 text-amber-700 border border-amber-200/50 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-700/30">
                    {t(`allergens.categories.${key}`)}
                  </span>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {activeRiskPrefs.length === 0 && activeAllergenPrefs.length === 0 && (
          <Card className="rounded-xl border-border/30 bg-card/50">
            <CardContent className="py-8 text-center text-muted-foreground/70 font-light">
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
    } else if (currentStep <= riskSteps) {
      return renderRiskCategoryStep(currentStep - 1);
    } else if (currentStep === riskSteps + 1) {
      return renderAllergenIntroStep();
    } else if (currentStep <= riskSteps + 1 + allergenSteps) {
      return renderAllergenCategoryStep(currentStep - riskSteps - 2);
    } else {
      return renderSummaryStep();
    }
  };

  const isPending = completeOnboarding.isPending || completeAllergenOnboarding.isPending;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <div className="flex-1 overflow-auto pb-28">
        <div className="max-w-md mx-auto px-5 pt-8">
          <Progress value={progress} className="h-1.5 mb-4" data-testid="onboarding-progress" />
          
          <div className="text-xs text-center text-muted-foreground/60 font-light tracking-wide mb-2">
            {lang === 'zh' 
              ? `第 ${currentStep + 1} 步，共 ${totalSteps} 步` 
              : lang === 'es' 
              ? `Paso ${currentStep + 1} de ${totalSteps}`
              : `Step ${currentStep + 1} of ${totalSteps}`}
          </div>

          {renderCurrentStep()}
        </div>
      </div>

      <div className="fixed bottom-0 left-0 right-0 bg-background/95 backdrop-blur-md border-t border-border/30 p-4 safe-area-pb">
        <div className="max-w-md mx-auto flex gap-3">
          {currentStep > 0 && (
            <Button 
              variant="outline" 
              onClick={handlePrev}
              className="flex-1 rounded-full"
              data-testid="button-prev"
              disabled={isPending}
            >
              <ChevronLeft className="w-4 h-4 mr-1" />
              {lang === 'zh' ? '上一步' : lang === 'es' ? 'Anterior' : 'Back'}
            </Button>
          )}
          
          {currentStep === 0 && (
            <Button 
              variant="ghost" 
              onClick={handleSkip}
              className="flex-1 rounded-full"
              data-testid="button-skip"
              disabled={isPending}
            >
              {lang === 'zh' ? '跳过' : lang === 'es' ? 'Omitir' : 'Skip'}
            </Button>
          )}
          
          {currentStep < totalSteps - 1 ? (
            <Button 
              onClick={handleNext}
              className="flex-1 rounded-full"
              data-testid="button-next"
            >
              {lang === 'zh' ? '下一步' : lang === 'es' ? 'Siguiente' : 'Next'}
              <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          ) : (
            <Button 
              onClick={handleComplete}
              className="flex-1 rounded-full"
              disabled={isPending}
              data-testid="button-complete"
            >
              {isPending 
                ? (lang === 'zh' ? '保存中...' : lang === 'es' ? 'Guardando...' : 'Saving...')
                : (lang === 'zh' ? '开始扫描' : lang === 'es' ? 'Empezar a Escanear' : 'Start Scanning')}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

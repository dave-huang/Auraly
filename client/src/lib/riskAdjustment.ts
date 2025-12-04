import { 
  type AnalysisResult, 
  type Ingredient, 
  type RiskLevel, 
  type RiskPreferences, 
  type PreferenceCategory,
  getIngredientCategories,
  preferenceCategories
} from '@shared/schema';

function adjustRiskLevel(
  baseRisk: RiskLevel, 
  tolerance: 'avoid' | 'caution' | 'no_preference'
): RiskLevel {
  if (tolerance === 'no_preference') {
    return baseRisk;
  }
  
  if (tolerance === 'avoid') {
    return 'high';
  }
  
  if (tolerance === 'caution') {
    if (baseRisk === 'low') return 'moderate';
    if (baseRisk === 'moderate') return 'high';
    return 'high';
  }
  
  return baseRisk;
}

function getCategoryDisplayName(category: PreferenceCategory, language: string = 'en'): string {
  const names: Record<PreferenceCategory, Record<string, string>> = {
    artificial_fragrances: {
      en: 'Artificial Fragrances',
      es: 'Fragancias Artificiales',
      zh: '人工香料'
    },
    artificial_colors: {
      en: 'Artificial Colors',
      es: 'Colorantes Artificiales', 
      zh: '人工色素'
    },
    preservatives: {
      en: 'Preservatives',
      es: 'Conservantes',
      zh: '防腐剂'
    },
    endocrine_disruptors: {
      en: 'Endocrine Disruptors',
      es: 'Disruptores Endocrinos',
      zh: '内分泌干扰物'
    },
    allergens: {
      en: 'Allergens',
      es: 'Alérgenos',
      zh: '过敏原'
    },
    alcohols: {
      en: 'Drying Alcohols',
      es: 'Alcoholes Secantes',
      zh: '干燥性酒精'
    },
    fragrance_allergens: {
      en: 'Fragrance Allergens',
      es: 'Alérgenos de Fragancia',
      zh: '香料过敏原'
    },
    parabens: {
      en: 'Parabens',
      es: 'Parabenos',
      zh: '对羟基苯甲酸酯'
    },
    sulfates: {
      en: 'Sulfates',
      es: 'Sulfatos',
      zh: '硫酸盐'
    },
    pegs_ethoxylated: {
      en: 'PEGs / Ethoxylated Ingredients',
      es: 'PEGs / Ingredientes Etoxilados',
      zh: 'PEG/乙氧基化成分'
    },
    silicones: {
      en: 'Silicones',
      es: 'Siliconas',
      zh: '硅酮'
    }
  };
  
  return names[category]?.[language] || names[category]?.en || category;
}

export function applyRiskPreferences(
  analysisResult: AnalysisResult,
  preferences: RiskPreferences,
  language: string = 'en'
): AnalysisResult {
  if (!analysisResult || !analysisResult.ingredients) {
    return analysisResult;
  }

  const allPrefsDefault = Object.values(preferences).every(
    v => v === 'no_preference'
  );
  if (allPrefsDefault) {
    return analysisResult;
  }

  const adjustedIngredients: Ingredient[] = analysisResult.ingredients.map(ingredient => {
    const categories = getIngredientCategories(ingredient.name);
    
    if (categories.length === 0) {
      return {
        ...ingredient,
        baseRiskLevel: ingredient.baseRiskLevel || ingredient.riskLevel,
        preferenceCategories: []
      };
    }

    const baseRisk = ingredient.baseRiskLevel || ingredient.riskLevel;
    let highestAdjustedRisk: RiskLevel = baseRisk;
    const appliedCategories: PreferenceCategory[] = [];
    
    for (const category of categories) {
      const tolerance = preferences[category];
      if (tolerance && tolerance !== 'no_preference') {
        const adjustedForCategory = adjustRiskLevel(baseRisk, tolerance);
        appliedCategories.push(category);
        
        const riskOrder: RiskLevel[] = ['low', 'moderate', 'high'];
        if (riskOrder.indexOf(adjustedForCategory) > riskOrder.indexOf(highestAdjustedRisk)) {
          highestAdjustedRisk = adjustedForCategory;
        }
      }
    }

    if (appliedCategories.length === 0) {
      return {
        ...ingredient,
        baseRiskLevel: baseRisk,
        preferenceCategories: categories
      };
    }

    const categoryNames = appliedCategories
      .map(cat => getCategoryDisplayName(cat, language))
      .join(', ');
    
    const toleranceLabel = preferences[appliedCategories[0]] === 'avoid' 
      ? (language === 'zh' ? '完全避免' : language === 'es' ? 'evitar completamente' : 'avoid completely')
      : (language === 'zh' ? '谨慎使用' : language === 'es' ? 'usar con precaución' : 'use with caution');

    const adjustmentReason = language === 'zh'
      ? `根据您的偏好设置（${categoryNames}: ${toleranceLabel}）调整了风险等级`
      : language === 'es'
      ? `Riesgo ajustado según sus preferencias (${categoryNames}: ${toleranceLabel})`
      : `Risk adjusted based on your preferences (${categoryNames}: ${toleranceLabel})`;

    return {
      ...ingredient,
      baseRiskLevel: baseRisk,
      riskLevel: highestAdjustedRisk,
      preferenceCategories: categories,
      riskAdjustmentReason: baseRisk !== highestAdjustedRisk ? adjustmentReason : undefined
    };
  });

  const hasHigh = adjustedIngredients.some(i => i.riskLevel === 'high');
  const hasModerate = adjustedIngredients.some(i => i.riskLevel === 'moderate');
  const overallRisk: RiskLevel = hasHigh ? 'high' : (hasModerate ? 'moderate' : 'low');

  return {
    ...analysisResult,
    ingredients: adjustedIngredients,
    overallRisk
  };
}

export function hasActivePreferences(preferences: RiskPreferences): boolean {
  return Object.values(preferences).some(v => v !== 'no_preference');
}

export function applyRiskPreferencesToIngredients(
  ingredients: Ingredient[],
  preferences: RiskPreferences,
  language: string = 'en'
): Ingredient[] {
  if (!ingredients || ingredients.length === 0) {
    return ingredients;
  }

  const allPrefsDefault = Object.values(preferences).every(
    v => v === 'no_preference'
  );
  if (allPrefsDefault) {
    return ingredients;
  }

  return ingredients.map(ingredient => {
    const categories = getIngredientCategories(ingredient.name);
    
    if (categories.length === 0) {
      return {
        ...ingredient,
        baseRiskLevel: ingredient.baseRiskLevel || ingredient.riskLevel,
        preferenceCategories: []
      };
    }

    const baseRisk = ingredient.baseRiskLevel || ingredient.riskLevel;
    let highestAdjustedRisk: RiskLevel = baseRisk;
    const appliedCategories: PreferenceCategory[] = [];
    
    for (const category of categories) {
      const tolerance = preferences[category];
      if (tolerance && tolerance !== 'no_preference') {
        const adjustedForCategory = adjustRiskLevel(baseRisk, tolerance);
        appliedCategories.push(category);
        
        const riskOrder: RiskLevel[] = ['low', 'moderate', 'high'];
        if (riskOrder.indexOf(adjustedForCategory) > riskOrder.indexOf(highestAdjustedRisk)) {
          highestAdjustedRisk = adjustedForCategory;
        }
      }
    }

    if (appliedCategories.length === 0) {
      return {
        ...ingredient,
        baseRiskLevel: baseRisk,
        preferenceCategories: categories
      };
    }

    const categoryNames = appliedCategories
      .map(cat => getCategoryDisplayName(cat, language))
      .join(', ');
    
    const toleranceLabel = preferences[appliedCategories[0]] === 'avoid' 
      ? (language === 'zh' ? '完全避免' : language === 'es' ? 'evitar completamente' : 'avoid completely')
      : (language === 'zh' ? '谨慎使用' : language === 'es' ? 'usar con precaución' : 'use with caution');

    const adjustmentReason = language === 'zh'
      ? `根据您的偏好设置（${categoryNames}: ${toleranceLabel}）调整了风险等级`
      : language === 'es'
      ? `Riesgo ajustado según sus preferencias (${categoryNames}: ${toleranceLabel})`
      : `Risk adjusted based on your preferences (${categoryNames}: ${toleranceLabel})`;

    return {
      ...ingredient,
      baseRiskLevel: baseRisk,
      riskLevel: highestAdjustedRisk,
      preferenceCategories: categories,
      riskAdjustmentReason: baseRisk !== highestAdjustedRisk ? adjustmentReason : undefined
    };
  });
}

export function getActivePreferenceSummary(
  preferences: RiskPreferences,
  language: string = 'en'
): string[] {
  const activeCategories: string[] = [];
  
  for (const category of preferenceCategories) {
    const tolerance = preferences[category];
    if (tolerance !== 'no_preference') {
      const categoryName = getCategoryDisplayName(category, language);
      const toleranceLabel = tolerance === 'avoid'
        ? (language === 'zh' ? '完全避免' : language === 'es' ? 'evitar' : 'avoid')
        : (language === 'zh' ? '谨慎' : language === 'es' ? 'precaución' : 'caution');
      activeCategories.push(`${categoryName}: ${toleranceLabel}`);
    }
  }
  
  return activeCategories;
}

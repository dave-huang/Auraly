import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle, UtensilsCrossed, Flower2, FlaskConical } from "lucide-react";
import type { AllergenPreferences, AllergenCategory, AllergenFlag, Ingredient } from "@shared/schema";
import { detectAllergens, defaultAllergenPreferences } from "@shared/schema";
import { cn } from "@/lib/utils";

interface AllergenFlagsProps {
  ingredients: Ingredient[];
}

const allergenGroupInfo: Record<string, { icon: any; categories: AllergenCategory[] }> = {
  food: {
    icon: UtensilsCrossed,
    categories: ['nuts', 'soy', 'dairy', 'gluten_wheat', 'eggs', 'seafood_shellfish']
  },
  cosmetic: {
    icon: Flower2,
    categories: ['fragrance_allergens_cosmetic', 'preservative_allergens', 'lanolin', 'botanical_extracts']
  },
  chemical: {
    icon: FlaskConical,
    categories: ['colorants_dyes', 'drying_alcohols']
  }
};

export function AllergenFlags({ ingredients }: AllergenFlagsProps) {
  const { t, i18n } = useTranslation();
  const lang = (i18n.language?.substring(0, 2) || 'en') as 'en' | 'es' | 'zh';

  const { data: allergenPrefsData } = useQuery<{ preferences: AllergenPreferences }>({
    queryKey: ['/api/user/allergen-preferences'],
    staleTime: 60000,
    retry: false
  });

  const allergenPreferences = allergenPrefsData?.preferences || defaultAllergenPreferences;

  const detectedAllergens = useMemo(() => {
    return detectAllergens(ingredients, allergenPreferences);
  }, [ingredients, allergenPreferences]);

  const hasEnabledAllergens = Object.values(allergenPreferences).some(v => v === true);

  const groupedAllergens = useMemo(() => {
    const groups: Record<string, AllergenFlag[]> = {
      food: [],
      cosmetic: [],
      chemical: []
    };

    for (const allergen of detectedAllergens) {
      for (const [groupKey, groupInfo] of Object.entries(allergenGroupInfo)) {
        if (groupInfo.categories.includes(allergen.category)) {
          const existing = groups[groupKey].find(a => a.category === allergen.category && a.ingredientName === allergen.ingredientName);
          if (!existing) {
            groups[groupKey].push(allergen);
          }
        }
      }
    }

    return groups;
  }, [detectedAllergens]);

  const hasDetectedAllergens = detectedAllergens.length > 0;
  
  if (!hasEnabledAllergens) {
    return null;
  }

  return (
    <Card className={cn(
      "mb-6 transition-all",
      hasDetectedAllergens ? "border-orange-500/50 bg-orange-50/50 dark:bg-orange-950/20" : ""
    )} data-testid="allergen-flags-card">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <AlertTriangle className={cn(
            "w-5 h-5",
            hasDetectedAllergens ? "text-orange-500" : "text-muted-foreground"
          )} />
          {t('allergens.title')}
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          {t('allergens.subtitle')}
        </p>
      </CardHeader>
      <CardContent>
        {!hasDetectedAllergens ? (
          <p className="text-sm text-muted-foreground">
            {t('allergens.noFlags')}
          </p>
        ) : (
          <div className="space-y-4">
            {Object.entries(groupedAllergens).map(([groupKey, allergens]) => {
              if (allergens.length === 0) return null;
              const GroupIcon = allergenGroupInfo[groupKey].icon;
              return (
                <div key={groupKey}>
                  <div className="flex items-center gap-2 mb-2">
                    <GroupIcon className={cn(
                      "w-4 h-4",
                      groupKey === 'food' ? "text-orange-500" :
                      groupKey === 'cosmetic' ? "text-pink-500" : "text-purple-500"
                    )} />
                    <span className="text-xs font-medium text-muted-foreground">
                      {t(`allergens.groups.${groupKey}`)}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {allergens.map((allergen, index) => (
                      <div 
                        key={`${allergen.category}-${allergen.ingredientName}-${index}`}
                        className={cn(
                          "text-xs px-2.5 py-1.5 rounded-full border",
                          "bg-orange-100 text-orange-800 border-orange-200",
                          "dark:bg-orange-900/30 dark:text-orange-300 dark:border-orange-800"
                        )}
                        data-testid={`allergen-flag-${allergen.category}`}
                      >
                        <span className="font-medium">{t(`allergens.categories.${allergen.category}`)}</span>
                        <span className="text-orange-600/70 dark:text-orange-400/70 ml-1">
                          ({allergen.ingredientName})
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

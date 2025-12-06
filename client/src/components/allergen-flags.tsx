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
      "mb-8 transition-all rounded-xl",
      hasDetectedAllergens 
        ? "border-amber-400/30 bg-amber-50/40 dark:bg-amber-950/15" 
        : "bg-card/50 border-border/30"
    )} data-testid="allergen-flags-card">
      <CardHeader className="pb-3 pt-5 px-6">
        <div className="flex items-center gap-3">
          <div className={cn(
            "p-2 rounded-full",
            hasDetectedAllergens 
              ? "bg-amber-100/60 dark:bg-amber-900/30" 
              : "bg-muted/50"
          )}>
            <AlertTriangle className={cn(
              "w-4 h-4",
              hasDetectedAllergens ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground"
            )} />
          </div>
          <div>
            <CardTitle className="text-base font-display">
              {t('allergens.title')}
            </CardTitle>
            <p className="text-xs text-muted-foreground/70 font-light mt-0.5">
              {t('allergens.subtitle')}
            </p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="px-6 pb-5">
        {!hasDetectedAllergens ? (
          <p className="text-sm text-muted-foreground font-light">
            {t('allergens.noFlags')}
          </p>
        ) : (
          <div className="space-y-5">
            {Object.entries(groupedAllergens).map(([groupKey, allergens]) => {
              if (allergens.length === 0) return null;
              const GroupIcon = allergenGroupInfo[groupKey].icon;
              const groupColor = groupKey === 'food' ? "amber" : groupKey === 'cosmetic' ? "rose" : "violet";
              return (
                <div key={groupKey}>
                  <div className="flex items-center gap-2 mb-3">
                    <GroupIcon className={cn(
                      "w-3.5 h-3.5",
                      groupKey === 'food' ? "text-amber-500/70" :
                      groupKey === 'cosmetic' ? "text-rose-400/70" : "text-violet-400/70"
                    )} />
                    <span className="text-xs text-muted-foreground/80 font-medium uppercase tracking-wide">
                      {t(`allergens.groups.${groupKey}`)}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {allergens.map((allergen, index) => (
                      <div 
                        key={`${allergen.category}-${allergen.ingredientName}-${index}`}
                        className={cn(
                          "text-xs px-3 py-1.5 rounded-full border",
                          groupKey === 'food' 
                            ? "bg-amber-100/50 text-amber-700 border-amber-200/50 dark:bg-amber-900/20 dark:text-amber-300 dark:border-amber-700/30"
                            : groupKey === 'cosmetic'
                            ? "bg-rose-100/50 text-rose-700 border-rose-200/50 dark:bg-rose-900/20 dark:text-rose-300 dark:border-rose-700/30"
                            : "bg-violet-100/50 text-violet-700 border-violet-200/50 dark:bg-violet-900/20 dark:text-violet-300 dark:border-violet-700/30"
                        )}
                        data-testid={`allergen-flag-${allergen.category}`}
                      >
                        <span className="font-medium">{t(`allergens.categories.${allergen.category}`)}</span>
                        <span className={cn(
                          "ml-1.5 font-light",
                          groupKey === 'food' 
                            ? "text-amber-600/60 dark:text-amber-400/60"
                            : groupKey === 'cosmetic'
                            ? "text-rose-600/60 dark:text-rose-400/60"
                            : "text-violet-600/60 dark:text-violet-400/60"
                        )}>
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

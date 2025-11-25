import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ChevronDown, ChevronUp, Loader2 } from "lucide-react";
import type { Ingredient, ProductType } from "@shared/schema";
import { useTranslation } from "react-i18next";

interface IngredientCardProps {
  ingredient: Ingredient;
  productType?: ProductType;
  userLanguage?: string;
}

const riskConfig = {
  low: {
    color: "bg-emerald-500",
    bgColor: "bg-emerald-50 dark:bg-emerald-950/20",
    borderColor: "border-l-emerald-500",
    textColor: "text-emerald-700 dark:text-emerald-400"
  },
  moderate: {
    color: "bg-amber-500",
    bgColor: "bg-amber-50 dark:bg-amber-950/20",
    borderColor: "border-l-amber-500",
    textColor: "text-amber-700 dark:text-amber-400"
  },
  high: {
    color: "bg-red-500",
    bgColor: "bg-red-50 dark:bg-red-950/20",
    borderColor: "border-l-red-500",
    textColor: "text-red-700 dark:text-red-400"
  }
};

export function IngredientCard({ ingredient, productType = 'food', userLanguage = 'en' }: IngredientCardProps) {
  const { t } = useTranslation();
  const [isExpanded, setIsExpanded] = useState(false);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [details, setDetails] = useState<string | null>(ingredient.details || null);
  const [detailsError, setDetailsError] = useState<string | null>(null);
  const config = riskConfig[ingredient.riskLevel];

  const handleToggleExpand = async () => {
    if (!isExpanded && !details && !loadingDetails) {
      // Need to fetch details
      setLoadingDetails(true);
      setDetailsError(null);
      try {
        const response = await fetch('/api/ingredient-details', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ingredientName: ingredient.name,
            riskLevel: ingredient.riskLevel,
            productType,
            userLanguage
          })
        });
        
        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || 'Failed to fetch details');
        }
        
        const data = await response.json();
        setDetails(data.details);
      } catch (error: any) {
        console.error('Failed to fetch ingredient details:', error);
        setDetailsError(error.message || 'Failed to load details');
      } finally {
        setLoadingDetails(false);
      }
    }
    
    setIsExpanded(!isExpanded);
  };

  return (
    <Card className={`border-l-4 ${config.borderColor} overflow-hidden`}>
      <div className="p-6">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 mb-3">
          <div className="flex-1">
            <h3 className="font-semibold text-lg mb-2" data-testid={`text-ingredient-name-${ingredient.name}`}>
              {ingredient.name}
            </h3>
            <Badge 
              className={`${config.bgColor} ${config.textColor} border-0 text-xs font-semibold`}
              data-testid={`badge-risk-${ingredient.riskLevel}`}
            >
              {t(`results.riskLevels.${ingredient.riskLevel}`)}
            </Badge>
          </div>
          <div className={`w-3 h-3 rounded-full ${config.color} mt-1 flex-shrink-0`} />
        </div>

        {/* Summary */}
        <p className="text-sm text-foreground mb-3">
          {ingredient.summary}
        </p>

        {/* Learn More Toggle */}
        <button
          onClick={handleToggleExpand}
          disabled={loadingDetails}
          className="flex items-center gap-1 text-sm font-medium text-primary hover-elevate active-elevate-2 px-3 py-1.5 rounded-md -ml-3 transition-colors disabled:opacity-50"
          data-testid={`button-toggle-details-${ingredient.name}`}
        >
          {loadingDetails ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              {t('results.ingredientCard.loading')}
            </>
          ) : isExpanded ? (
            <>
              <ChevronUp className="w-4 h-4" />
              {t('results.ingredientCard.showLess')}
            </>
          ) : (
            <>
              <ChevronDown className="w-4 h-4" />
              {t('results.ingredientCard.learnMore')}
            </>
          )}
        </button>

        {isExpanded && (
          <div className={`mt-4 p-4 rounded-lg ${config.bgColor} border ${config.borderColor.replace('border-l-', 'border-')}`}>
            {detailsError ? (
              <p className="text-sm text-red-600 dark:text-red-400" data-testid={`text-ingredient-error-${ingredient.name}`}>
                {detailsError}
              </p>
            ) : details ? (
              <p className="text-sm text-foreground/90" data-testid={`text-ingredient-details-${ingredient.name}`}>
                {details}
              </p>
            ) : (
              <p className="text-sm text-foreground/70">{t('results.ingredientCard.loading')}</p>
            )}
          </div>
        )}
      </div>
    </Card>
  );
}

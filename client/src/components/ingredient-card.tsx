import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ChevronDown, ChevronUp, AlertTriangle } from "lucide-react";
import type { Ingredient } from "@shared/schema";
import { useTranslation } from "react-i18next";

interface IngredientCardProps {
  ingredient: Ingredient;
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

export function IngredientCard({ ingredient }: IngredientCardProps) {
  const { t } = useTranslation();
  const [isExpanded, setIsExpanded] = useState(false);
  const config = riskConfig[ingredient.riskLevel];
  const hasRiskAdjustment = ingredient.riskAdjustmentReason && 
    ingredient.baseRiskLevel && 
    ingredient.baseRiskLevel !== ingredient.riskLevel;
  const baseConfig = hasRiskAdjustment ? riskConfig[ingredient.baseRiskLevel!] : null;

  return (
    <Card className={`border-l-4 ${config.borderColor} overflow-hidden`}>
      <div className="p-6">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 mb-3">
          <div className="flex-1">
            <h3 className="font-semibold text-lg mb-2" data-testid={`text-ingredient-name-${ingredient.name}`}>
              {ingredient.name}
            </h3>
            <div className="flex flex-wrap items-center gap-2">
              <Badge 
                className={`${config.bgColor} ${config.textColor} border-0 text-xs font-semibold`}
                data-testid={`badge-risk-${ingredient.riskLevel}`}
              >
                {t(`results.riskLevels.${ingredient.riskLevel}`)}
              </Badge>
              {hasRiskAdjustment && baseConfig && (
                <Badge 
                  variant="outline"
                  className="text-xs font-normal gap-1"
                  data-testid={`badge-adjusted-${ingredient.name}`}
                >
                  <AlertTriangle className="w-3 h-3" />
                  {t('preferences.baseRisk')}: {t(`results.riskLevels.${ingredient.baseRiskLevel}`)}
                </Badge>
              )}
            </div>
          </div>
          <div className={`w-3 h-3 rounded-full ${config.color} mt-1 flex-shrink-0`} />
        </div>
        
        {/* Risk Adjustment Notice */}
        {hasRiskAdjustment && (
          <div className="mb-3 p-2 bg-muted/50 rounded-md flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-muted-foreground" data-testid={`text-adjustment-reason-${ingredient.name}`}>
              {ingredient.riskAdjustmentReason}
            </p>
          </div>
        )}

        {/* Summary */}
        <p className="text-sm text-foreground mb-3">
          {ingredient.summary}
        </p>

        {/* Learn More Toggle */}
        {ingredient.details && (
          <>
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="flex items-center gap-1 text-sm font-medium text-primary hover-elevate active-elevate-2 px-3 py-1.5 rounded-md -ml-3 transition-colors"
              data-testid={`button-toggle-details-${ingredient.name}`}
            >
              {isExpanded ? (
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
                <p className="text-sm text-foreground/90" data-testid={`text-ingredient-details-${ingredient.name}`}>
                  {ingredient.details}
                </p>
              </div>
            )}
          </>
        )}
      </div>
    </Card>
  );
}

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { ChevronDown, ChevronUp, AlertTriangle } from "lucide-react";
import type { Ingredient } from "@shared/schema";
import { useTranslation } from "react-i18next";

interface IngredientCardProps {
  ingredient: Ingredient;
}

const riskConfig = {
  low: {
    color: "bg-emerald-500/80",
    bgColor: "bg-emerald-50/50 dark:bg-emerald-950/15",
    borderColor: "border-l-emerald-400",
    textColor: "text-emerald-700 dark:text-emerald-400"
  },
  moderate: {
    color: "bg-amber-500/80",
    bgColor: "bg-amber-50/50 dark:bg-amber-950/15",
    borderColor: "border-l-amber-400",
    textColor: "text-amber-700 dark:text-amber-400"
  },
  high: {
    color: "bg-red-500/80",
    bgColor: "bg-red-50/50 dark:bg-red-950/15",
    borderColor: "border-l-red-400",
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
    <div className={`border-l-3 ${config.borderColor} rounded-xl bg-card/50 border border-border/30 overflow-hidden transition-all duration-200`}>
      <div className="p-6">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 mb-4">
          <div className="flex-1">
            <h3 className="font-display text-lg mb-3" data-testid={`text-ingredient-name-${ingredient.name}`}>
              {ingredient.name}
            </h3>
            <div className="flex flex-wrap items-center gap-2">
              <Badge 
                className={`${config.bgColor} ${config.textColor} border-0 text-xs font-medium`}
                data-testid={`badge-risk-${ingredient.riskLevel}`}
              >
                {t(`results.riskLevels.${ingredient.riskLevel}`)}
              </Badge>
              {hasRiskAdjustment && baseConfig && (
                <Badge 
                  variant="outline"
                  className="text-xs font-normal gap-1.5"
                  data-testid={`badge-adjusted-${ingredient.name}`}
                >
                  <AlertTriangle className="w-3 h-3" />
                  {t('preferences.baseRisk')}: {t(`results.riskLevels.${ingredient.baseRiskLevel}`)}
                </Badge>
              )}
            </div>
          </div>
          <div className={`w-2.5 h-2.5 rounded-full ${config.color} mt-1.5 flex-shrink-0`} />
        </div>
        
        {/* Risk Adjustment Notice */}
        {hasRiskAdjustment && (
          <div className="mb-4 p-3 bg-muted/30 rounded-md flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 text-amber-500/80 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-muted-foreground leading-relaxed" data-testid={`text-adjustment-reason-${ingredient.name}`}>
              {ingredient.riskAdjustmentReason}
            </p>
          </div>
        )}

        {/* Summary */}
        <p className="text-sm text-muted-foreground leading-relaxed mb-4">
          {ingredient.summary}
        </p>

        {/* Learn More Toggle */}
        {ingredient.details && (
          <>
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="flex items-center gap-1.5 text-sm text-primary/80 hover:text-primary hover-elevate active-elevate-2 px-3 py-2 rounded-lg -ml-3 transition-colors"
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
              <div className={`mt-4 p-5 rounded-lg ${config.bgColor}`}>
                <p className="text-sm text-foreground/80 leading-relaxed" data-testid={`text-ingredient-details-${ingredient.name}`}>
                  {ingredient.details}
                </p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

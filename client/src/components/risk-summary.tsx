import { Shield, AlertTriangle, AlertCircle } from "lucide-react";
import type { RiskLevel } from "@shared/schema";
import { useTranslation } from "react-i18next";

interface RiskSummaryProps {
  overallRisk: RiskLevel;
  riskCounts: {
    low: number;
    moderate: number;
    high: number;
  };
  totalIngredients: number;
}

const riskConfig = {
  low: {
    icon: Shield,
    color: "text-emerald-600/90 dark:text-emerald-400",
    bgColor: "bg-emerald-50/60 dark:bg-emerald-950/15",
    borderColor: "border-emerald-200/60 dark:border-emerald-800/50"
  },
  moderate: {
    icon: AlertTriangle,
    color: "text-amber-600/90 dark:text-amber-400",
    bgColor: "bg-amber-50/60 dark:bg-amber-950/15",
    borderColor: "border-amber-200/60 dark:border-amber-800/50"
  },
  high: {
    icon: AlertCircle,
    color: "text-red-600/90 dark:text-red-400",
    bgColor: "bg-red-50/60 dark:bg-red-950/15",
    borderColor: "border-red-200/60 dark:border-red-800/50"
  }
};

export function RiskSummary({ overallRisk, riskCounts, totalIngredients }: RiskSummaryProps) {
  const { t } = useTranslation();
  const config = riskConfig[overallRisk];
  const Icon = config.icon;

  return (
    <div className={`${config.bgColor} rounded-lg border ${config.borderColor} mb-8`}>
      <div className="p-6">
        <div className="flex items-start gap-4 mb-5">
          <div className={`p-3 rounded-full ${config.bgColor} border ${config.borderColor}`}>
            <Icon className={`w-5 h-5 ${config.color}`} />
          </div>
          <div className="flex-1">
            <h3 className={`font-medium text-lg mb-1.5 ${config.color}`} data-testid="text-overall-risk">
              {t(`results.riskSummary.${overallRisk}.label`)}
            </h3>
            <p className="text-sm text-foreground/75 leading-relaxed">
              {t(`results.riskSummary.${overallRisk}.message`)}
            </p>
          </div>
        </div>

        {/* Risk Breakdown */}
        <div className="grid grid-cols-3 gap-4 pt-5 border-t border-border/30">
          <div className="text-center">
            <div className="text-2xl font-medium text-emerald-600/90 dark:text-emerald-400">
              {riskCounts.low}
            </div>
            <div className="text-xs text-muted-foreground mt-1.5 font-light">{t('results.riskSummary.breakdown.lowRisk')}</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-medium text-amber-600/90 dark:text-amber-400">
              {riskCounts.moderate}
            </div>
            <div className="text-xs text-muted-foreground mt-1.5 font-light">{t('results.riskSummary.breakdown.moderate')}</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-medium text-red-600/90 dark:text-red-400">
              {riskCounts.high}
            </div>
            <div className="text-xs text-muted-foreground mt-1.5 font-light">{t('results.riskSummary.breakdown.highRisk')}</div>
          </div>
        </div>

        <p className="text-xs text-muted-foreground/80 text-center mt-5 font-light">
          {t('results.riskSummary.ingredientsAnalyzed', { count: totalIngredients })}
        </p>
      </div>
    </div>
  );
}

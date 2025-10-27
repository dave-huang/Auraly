import { Card } from "@/components/ui/card";
import { Shield, AlertTriangle, AlertCircle } from "lucide-react";
import type { RiskLevel } from "@shared/schema";

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
    color: "text-emerald-600 dark:text-emerald-400",
    bgColor: "bg-emerald-50 dark:bg-emerald-950/20",
    borderColor: "border-emerald-200 dark:border-emerald-800",
    label: "Low Risk",
    message: "This product contains mostly safe ingredients with minimal health concerns."
  },
  moderate: {
    icon: AlertTriangle,
    color: "text-amber-600 dark:text-amber-400",
    bgColor: "bg-amber-50 dark:bg-amber-950/20",
    borderColor: "border-amber-200 dark:border-amber-800",
    label: "Moderate Risk",
    message: "Some ingredients may have potential health concerns. Review the details below."
  },
  high: {
    icon: AlertCircle,
    color: "text-red-600 dark:text-red-400",
    bgColor: "bg-red-50 dark:bg-red-950/20",
    borderColor: "border-red-200 dark:border-red-800",
    label: "High Risk",
    message: "This product contains ingredients with known health concerns. Consider alternatives."
  }
};

export function RiskSummary({ overallRisk, riskCounts, totalIngredients }: RiskSummaryProps) {
  const config = riskConfig[overallRisk];
  const Icon = config.icon;

  return (
    <Card className={`${config.bgColor} border-2 ${config.borderColor} mb-8`}>
      <div className="p-6">
        <div className="flex items-start gap-4 mb-4">
          <div className={`p-3 rounded-full ${config.bgColor} border ${config.borderColor}`}>
            <Icon className={`w-6 h-6 ${config.color}`} />
          </div>
          <div className="flex-1">
            <h3 className={`font-bold text-xl mb-1 ${config.color}`} data-testid="text-overall-risk">
              {config.label}
            </h3>
            <p className="text-sm text-foreground/80">
              {config.message}
            </p>
          </div>
        </div>

        {/* Risk Breakdown */}
        <div className="grid grid-cols-3 gap-4 pt-4 border-t border-border/50">
          <div className="text-center">
            <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
              {riskCounts.low}
            </div>
            <div className="text-xs text-muted-foreground mt-1">Low Risk</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">
              {riskCounts.moderate}
            </div>
            <div className="text-xs text-muted-foreground mt-1">Moderate</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-red-600 dark:text-red-400">
              {riskCounts.high}
            </div>
            <div className="text-xs text-muted-foreground mt-1">High Risk</div>
          </div>
        </div>

        <p className="text-xs text-muted-foreground text-center mt-4">
          {totalIngredients} ingredients analyzed
        </p>
      </div>
    </Card>
  );
}

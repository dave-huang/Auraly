import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ArrowLeft, Camera, AlertCircle } from "lucide-react";
import { StreamingResults } from "@/components/streaming-results";
import { IngredientCard } from "@/components/ingredient-card";
import { RiskSummary } from "@/components/risk-summary";
import type { RiskLevel } from "@shared/schema";
import { useTranslation } from "react-i18next";

export default function StreamingResultsPage() {
  const { t, i18n } = useTranslation();
  const [, setLocation] = useLocation();
  const [imageData, setImageData] = useState<string | null>(null);
  const [productType, setProductType] = useState<string | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);

  // Get data from session storage
  useEffect(() => {
    const stored = sessionStorage.getItem("pendingAnalysis");
    if (stored) {
      const params = JSON.parse(stored);
      setImageData(params.imageData);
      setProductType(params.productType);
      setIsInitializing(false);
      sessionStorage.removeItem("pendingAnalysis");
    } else {
      setLocation("/upload");
    }
  }, [setLocation]);

  if (isInitializing || !imageData || !productType) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setLocation("/")}
            data-testid="button-home"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            {t("results.header.home")}
          </Button>
          <h1 className="font-serif text-xl font-bold">{t("app.title")}</h1>
          <div className="w-10" />
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 py-8">
        <div className="mb-8">
          <h2 className="text-2xl md:text-3xl font-bold mb-2">
            Analyzing Ingredients
          </h2>
          <p className="text-muted-foreground">
            Results appear as they complete...
          </p>
        </div>

        {/* Streaming Results Component */}
        <StreamingResults
          imageData={imageData}
          productType={productType}
          userLanguage={i18n.language.startsWith('zh') ? 'zh' : i18n.language.startsWith('es') ? 'es' : 'en'}
        />
      </main>

      {/* Sticky Bottom CTA */}
      <div className="fixed bottom-0 left-0 right-0 z-50 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 p-4">
        <div className="max-w-4xl mx-auto">
          <Button
            onClick={() => setLocation("/upload")}
            className="w-full rounded-full"
            size="lg"
            data-testid="button-scan-another"
          >
            <Camera className="mr-2 h-5 w-5" />
            {t("results.scanAnother")}
          </Button>
        </div>
      </div>
    </div>
  );
}

import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Camera, Loader2, Search, AlertCircle } from "lucide-react";
import { IngredientCard } from "@/components/ingredient-card";
import { RiskSummary } from "@/components/risk-summary";
import type { AnalysisResult, Ingredient, RiskLevel } from "@shared/schema";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useTranslation } from "react-i18next";

export default function ResultsPage() {
  const { t, i18n } = useTranslation();
  const [, setLocation] = useLocation();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedRisk, setSelectedRisk] = useState<RiskLevel | "all">("all");
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [progress, setProgress] = useState(0);

  // Mutation for analyzing the image
  const analyzeMutation = useMutation({
    mutationFn: async (data: { productType: string; imageData: string }) => {
      // First, extract text from image using OCR
      const ocrResponse = await apiRequest("POST", "/api/ocr", { imageData: data.imageData });
      const ocrResult: any = await ocrResponse.json();
      
      // Normalize language code to 'en', 'es', or 'zh' (remove region codes like -US, -CN)
      let userLanguage = 'en';
      if (i18n.language.startsWith('zh')) {
        userLanguage = 'zh';
      } else if (i18n.language.startsWith('es')) {
        userLanguage = 'es';
      }
      
      // Then analyze the extracted text with user's language preference
      const analysisResponse = await apiRequest("POST", "/api/analyze", {
        productType: data.productType,
        ingredientsText: ocrResult.text,
        originalLanguage: ocrResult.language,
        userLanguage
      });
      const analysisResult: any = await analysisResponse.json();
      
      return analysisResult as AnalysisResult;
    },
    onSuccess: (data) => {
      setAnalysisResult(data);
      
      // Save to scan history in localStorage
      const history = JSON.parse(localStorage.getItem('scanHistory') || '[]');
      const historyItem = {
        id: Date.now().toString(),
        productType: data.productType,
        productName: data.productName,
        overallRisk: data.overallRisk,
        analyzedAt: data.analyzedAt,
        ingredientCount: data.ingredients.length
      };
      history.unshift(historyItem);
      localStorage.setItem('scanHistory', JSON.stringify(history.slice(0, 10))); // Keep last 10 scans
      
      // Clear pending analysis
      sessionStorage.removeItem('pendingAnalysis');
    }
  });

  useEffect(() => {
    // Check if there's a pending analysis
    const pending = sessionStorage.getItem('pendingAnalysis');
    if (pending && !analysisResult && !analyzeMutation.isPending) {
      const data = JSON.parse(pending);
      analyzeMutation.mutate(data);
    } else if (!pending && !analysisResult) {
      // No analysis to show, redirect to upload
      setLocation('/upload');
    }
  }, []);

  // Animate progress bar over 20 seconds
  useEffect(() => {
    if (analyzeMutation.isPending) {
      setProgress(0);
      const duration = 20000; // 20 seconds
      const interval = 100; // Update every 100ms
      const increment = (95 / duration) * interval; // Fill to 95% over 20 seconds
      
      const timer = setInterval(() => {
        setProgress(prev => {
          const next = prev + increment;
          return next >= 95 ? 95 : next; // Cap at 95%
        });
      }, interval);
      
      return () => clearInterval(timer);
    } else {
      setProgress(0);
    }
  }, [analyzeMutation.isPending]);

  // Map risk levels to sort order (higher number = higher priority)
  const riskLevelOrder: Record<RiskLevel, number> = {
    high: 3,
    moderate: 2,
    low: 1
  };

  const filteredIngredients = (analysisResult?.ingredients.filter(ingredient => {
    const matchesSearch = ingredient.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesRisk = selectedRisk === "all" || ingredient.riskLevel === selectedRisk;
    return matchesSearch && matchesRisk;
  }) || []).sort((a, b) => {
    // Sort by risk level (highest first)
    return riskLevelOrder[b.riskLevel] - riskLevelOrder[a.riskLevel];
  });

  const riskCounts = {
    low: analysisResult?.ingredients.filter(i => i.riskLevel === "low").length || 0,
    moderate: analysisResult?.ingredients.filter(i => i.riskLevel === "moderate").length || 0,
    high: analysisResult?.ingredients.filter(i => i.riskLevel === "high").length || 0,
  };

  if (analyzeMutation.isPending) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="p-8 max-w-md w-full">
          <div className="flex flex-col items-center gap-4 text-center">
            <Loader2 className="w-16 h-16 text-primary animate-spin" />
            <div>
              <h3 className="font-semibold text-xl mb-2">{t('results.analyzing.title')}</h3>
              <p className="text-sm text-muted-foreground mb-4">
                {t('results.analyzing.description')}
              </p>
            </div>
            <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
              <div 
                className="h-full bg-primary rounded-full transition-all duration-300 ease-out"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        </Card>
      </div>
    );
  }

  if (analyzeMutation.isError) {
    const errorMessage = (analyzeMutation.error as any)?.message || 'We couldn\'t analyze the image.';
    
    // Determine if this is an OCR error or analysis error
    const isOCRError = errorMessage.includes('No text found') || errorMessage.includes('extract text');
    
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="p-8 max-w-md w-full">
          <div className="flex flex-col items-center gap-4 text-center">
            <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center">
              <AlertCircle className="w-8 h-8 text-destructive" />
            </div>
            <div>
              <h3 className="font-semibold text-xl mb-2">
                {isOCRError ? t('results.error.ocr.title') : t('results.error.analysis.title')}
              </h3>
              <p className="text-sm text-muted-foreground mb-4">
                {isOCRError 
                  ? t('results.error.ocr.description')
                  : errorMessage
                }
              </p>
              {isOCRError && (
                <ul className="text-xs text-muted-foreground text-left mb-4 space-y-1">
                  <li>• {t('results.error.ocr.tips.lighting')}</li>
                  <li>• {t('results.error.ocr.tips.closer')}</li>
                  <li>• {t('results.error.ocr.tips.steady')}</li>
                  <li>• {t('results.error.ocr.tips.clear')}</li>
                </ul>
              )}
            </div>
            <Button 
              onClick={() => {
                sessionStorage.removeItem('pendingAnalysis');
                setLocation('/upload');
              }} 
              data-testid="button-try-again"
            >
              <Camera className="mr-2 h-4 w-4" />
              {t('results.error.tryAgain')}
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  if (!analysisResult) {
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
            onClick={() => setLocation('/')}
            data-testid="button-home"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            {t('results.header.home')}
          </Button>
          <h1 className="font-serif text-xl font-bold">{t('app.title')}</h1>
          <div className="w-10" />
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 py-8">
        {/* Product Name */}
        {analysisResult.productName && (
          <div className="mb-6">
            <h2 className="text-2xl md:text-3xl font-bold" data-testid="text-product-name">
              {analysisResult.productName}
            </h2>
            <p className="text-sm text-muted-foreground capitalize">
              {analysisResult.productType.replace('-', ' ')} {t('results.productType')}
            </p>
          </div>
        )}

        {/* Risk Summary */}
        <RiskSummary 
          overallRisk={analysisResult.overallRisk}
          riskCounts={riskCounts}
          totalIngredients={analysisResult.ingredients.length}
        />

        {/* Search Bar */}
        <div className="relative mb-6">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder={t('results.search')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
            data-testid="input-search-ingredients"
          />
        </div>

        {/* Risk Filter Tabs */}
        <Tabs value={selectedRisk} onValueChange={(value) => setSelectedRisk(value as RiskLevel | "all")} className="mb-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="all" data-testid="tab-all">
              {t('results.filters.all')} ({analysisResult.ingredients.length})
            </TabsTrigger>
            <TabsTrigger value="low" data-testid="tab-low">
              {t('results.filters.low')} ({riskCounts.low})
            </TabsTrigger>
            <TabsTrigger value="moderate" data-testid="tab-moderate">
              {t('results.filters.moderate')} ({riskCounts.moderate})
            </TabsTrigger>
            <TabsTrigger value="high" data-testid="tab-high">
              {t('results.filters.high')} ({riskCounts.high})
            </TabsTrigger>
          </TabsList>
        </Tabs>

        {/* Ingredients List */}
        <div className="space-y-4">
          {filteredIngredients.length === 0 ? (
            <Card className="p-8 text-center">
              <p className="text-muted-foreground">
                {t('results.noResults')}
              </p>
            </Card>
          ) : (
            filteredIngredients.map((ingredient, index) => (
              <IngredientCard 
                key={`${ingredient.name}-${index}`}
                ingredient={ingredient}
              />
            ))
          )}
        </div>
      </main>

      {/* Sticky Bottom CTA */}
      <div className="fixed bottom-0 left-0 right-0 z-50 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 p-4">
        <div className="max-w-4xl mx-auto">
          <Button 
            onClick={() => setLocation('/upload')}
            className="w-full rounded-full"
            size="lg"
            data-testid="button-scan-another"
          >
            <Camera className="mr-2 h-5 w-5" />
            {t('results.scanAnother')}
          </Button>
        </div>
      </div>
    </div>
  );
}

import { useState, useMemo } from "react";
import { useLocation, Link, useParams } from "wouter";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { ArrowLeft, Trash2, Search, Loader2, AlertTriangle, Settings, Leaf } from "lucide-react";
import { ProductInfoCard } from "@/components/product-info-card";
import { IngredientCard } from "@/components/ingredient-card";
import { RiskSummary } from "@/components/risk-summary";
import { AllergenFlags } from "@/components/allergen-flags";
import { NavigationMenu } from "@/components/navigation-menu";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useTranslation } from "react-i18next";
import { useToast } from "@/hooks/use-toast";
import { applyRiskPreferencesToIngredients, hasActivePreferences } from "@/lib/riskAdjustment";
import type { ScanHistory, Ingredient, RiskLevel, RiskPreferences, User } from "@shared/schema";


export default function ScanDetailPage() {
  const { t } = useTranslation();
  const [, setLocation] = useLocation();
  const params = useParams();
  const scanId = params.scanId;
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedRisk, setSelectedRisk] = useState<RiskLevel | "all">("all");

  const { data: user } = useQuery<User>({
    queryKey: ['/api/auth/user'],
  });

  const { data: scan, isLoading, error } = useQuery<ScanHistory>({
    queryKey: ['/api/history', scanId],
    queryFn: async () => {
      const response = await fetch(`/api/history/${scanId}`);
      if (!response.ok) throw new Error('Failed to fetch scan');
      return response.json();
    },
    enabled: !!scanId,
  });

  const userPreferences = user?.riskPreferences as RiskPreferences | undefined;
  const showPersonalizedBanner = userPreferences && hasActivePreferences(userPreferences);

  const deleteMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("DELETE", `/api/history/${scanId}`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/history'] });
      toast({
        title: t('history.deleteSuccess'),
        description: t('history.deleteSuccessDesc'),
      });
      setLocation('/history');
    },
    onError: () => {
      toast({
        title: t('errors.generic'),
        variant: "destructive",
      });
    }
  });

  const renameMutation = useMutation({
    mutationFn: async (productName: string) => {
      const response = await apiRequest("PATCH", `/api/history/${scanId}`, { productName });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/history', scanId] });
      queryClient.invalidateQueries({ queryKey: ['/api/history'] });
      toast({
        title: t('results.productName.updated'),
        description: t('results.productName.updatedDesc'),
      });
    },
    onError: () => {
      toast({
        title: t('errors.generic'),
        variant: "destructive",
      });
    }
  });

  const formatDate = (dateString: string | Date) => {
    const date = new Date(dateString);
    return date.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const rawIngredients = useMemo(() => {
    if (!scan) return [];
    return (scan.analysisResults as Ingredient[]) || [];
  }, [scan]);
  
  const adjustedIngredients = useMemo(() => {
    if (!userPreferences || rawIngredients.length === 0) return rawIngredients;
    return applyRiskPreferencesToIngredients(rawIngredients, userPreferences);
  }, [rawIngredients, userPreferences]);

  const adjustedOverallRisk = useMemo((): RiskLevel => {
    if (!scan) return 'low';
    if (adjustedIngredients.length === 0) return scan.overallRisk as RiskLevel;
    const hasHigh = adjustedIngredients.some((i: Ingredient) => i.riskLevel === 'high');
    if (hasHigh) return 'high';
    const hasModerate = adjustedIngredients.some((i: Ingredient) => i.riskLevel === 'moderate');
    if (hasModerate) return 'moderate';
    return 'low';
  }, [adjustedIngredients, scan]);
  
  const riskOrder: Record<RiskLevel, number> = { high: 0, moderate: 1, low: 2 };
  
  const filteredIngredients = useMemo(() => {
    return adjustedIngredients
      .filter((ingredient: Ingredient) => {
        const matchesSearch = ingredient.name.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesRisk = selectedRisk === "all" || ingredient.riskLevel === selectedRisk;
        return matchesSearch && matchesRisk;
      })
      .sort((a: Ingredient, b: Ingredient) => riskOrder[a.riskLevel] - riskOrder[b.riskLevel]);
  }, [adjustedIngredients, searchQuery, selectedRisk]);

  const riskCounts = useMemo(() => ({
    low: adjustedIngredients.filter((i: Ingredient) => i.riskLevel === 'low').length,
    moderate: adjustedIngredients.filter((i: Ingredient) => i.riskLevel === 'moderate').length,
    high: adjustedIngredients.filter((i: Ingredient) => i.riskLevel === 'high').length,
  }), [adjustedIngredients]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary mb-4" />
          <p className="text-muted-foreground">{t('common.loading')}</p>
        </div>
      </div>
    );
  }

  if (error || !scan) {
    return (
      <div className="min-h-screen bg-background p-4">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center gap-4 mb-6">
            <Link href="/history">
              <Button variant="ghost" size="icon" data-testid="button-back">
                <ArrowLeft className="w-5 h-5" />
              </Button>
            </Link>
            <h1 className="text-2xl font-bold">{t('history.scanNotFound')}</h1>
          </div>
          <Card className="p-8 text-center">
            <AlertTriangle className="w-12 h-12 text-destructive mx-auto mb-4" />
            <p className="text-muted-foreground">{t('history.scanNotFoundDesc')}</p>
            <Link href="/history">
              <Button className="mt-4">{t('history.backToHistory')}</Button>
            </Link>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border/30 bg-background/90 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-3xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/history">
              <Button variant="ghost" size="sm" className="gap-2 text-muted-foreground/70 hover:text-foreground" data-testid="button-back">
                <ArrowLeft className="w-4 h-4" />
                <span className="font-light hidden sm:inline">{t('common.back')}</span>
              </Button>
            </Link>
          </div>
          <div className="hidden sm:flex items-center gap-2.5">
            <Leaf className="w-4 h-4 text-primary/50" />
            <span className="font-display text-lg">{t('app.title')}</span>
          </div>
          <div className="flex items-center gap-2">
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="ghost" size="sm" className="text-muted-foreground" data-testid="button-delete-scan">
                  <Trash2 className="w-4 h-4" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>{t('history.deleteConfirmTitle')}</AlertDialogTitle>
                  <AlertDialogDescription>
                    {t('history.deleteConfirmDesc')}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel data-testid="button-cancel-delete">{t('common.cancel')}</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => deleteMutation.mutate()}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    data-testid="button-confirm-delete"
                  >
                    {deleteMutation.isPending ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      t('history.delete')
                    )}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
            <NavigationMenu showHomeLink />
          </div>
        </div>
      </header>
      {/* Main Content */}
      <main className="max-w-3xl mx-auto px-6 py-8">
        {/* Product Info Card */}
        <ProductInfoCard
          productName={scan.productName}
          productType={scan.productCategory}
          imageUrl={scan.originalImageUrl}
          createdAt={scan.createdAt}
          onRename={(newName) => renameMutation.mutate(newName)}
          isRenaming={renameMutation.isPending}
        />

        {showPersonalizedBanner && (
          <div className="flex items-center gap-2 p-3 rounded-xl bg-primary/5 border border-primary/10 mb-4">
            <Settings className="h-4 w-4 text-primary/70 flex-shrink-0" />
            <p className="text-sm text-muted-foreground font-light">
              {t('preferences.personalizedFor')}
            </p>
            <Button
              variant="ghost"
              size="sm"
              className="ml-auto text-primary"
              onClick={() => setLocation('/settings')}
              data-testid="link-edit-preferences"
            >
              {t('preferences.settings')}
            </Button>
          </div>
        )}

        <RiskSummary 
          overallRisk={adjustedOverallRisk}
          riskCounts={riskCounts}
          totalIngredients={adjustedIngredients.length}
        />

        {/* Allergen Flags */}
        <AllergenFlags ingredients={adjustedIngredients} />

        <div className="mb-6 relative mt-6">
          <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-muted-foreground/60 w-4 h-4" />
          <Input
            placeholder={t('results.search')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-11 py-5 rounded-xl bg-card/50 border-border/30 focus:border-primary/30 transition-colors"
            data-testid="input-search"
          />
        </div>

        <Tabs defaultValue="all" className="mb-8">
          <TabsList className="grid w-full grid-cols-4 bg-muted/30 p-1.5 rounded-xl gap-1">
            <TabsTrigger 
              value="all" 
              onClick={() => setSelectedRisk("all")}
              className="flex flex-col items-center gap-0.5 py-2 px-1 text-xs rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm"
              data-testid="tab-filter-all"
            >
              <span className="font-medium">{t('results.filters.all')}</span>
              <span className="text-muted-foreground text-[10px]">{adjustedIngredients.length}</span>
            </TabsTrigger>
            <TabsTrigger 
              value="low" 
              onClick={() => setSelectedRisk("low")}
              className="flex flex-col items-center gap-0.5 py-2 px-1 text-xs rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm"
              data-testid="tab-filter-low"
            >
              <span className="font-medium">{t('results.filters.low')}</span>
              <span className="text-muted-foreground text-[10px]">{riskCounts.low}</span>
            </TabsTrigger>
            <TabsTrigger 
              value="moderate" 
              onClick={() => setSelectedRisk("moderate")}
              className="flex flex-col items-center gap-0.5 py-2 px-1 text-xs rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm"
              data-testid="tab-filter-moderate"
            >
              <span className="font-medium">{t('results.filters.moderate')}</span>
              <span className="text-muted-foreground text-[10px]">{riskCounts.moderate}</span>
            </TabsTrigger>
            <TabsTrigger 
              value="high" 
              onClick={() => setSelectedRisk("high")}
              className="flex flex-col items-center gap-0.5 py-2 px-1 text-xs rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm"
              data-testid="tab-filter-high"
            >
              <span className="font-medium">{t('results.filters.high')}</span>
              <span className="text-muted-foreground text-[10px]">{riskCounts.high}</span>
            </TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="space-y-4 pb-28">
          {filteredIngredients.length === 0 ? (
            <div className="p-10 rounded-xl bg-card/50 border border-border/30 text-center">
              <p className="text-muted-foreground font-light">{t('results.noResults')}</p>
            </div>
          ) : (
            filteredIngredients.map((ingredient, index) => (
              <IngredientCard key={`${ingredient.name}-${index}`} ingredient={ingredient} />
            ))
          )}
        </div>

        <div className="fixed bottom-0 left-0 right-0 p-4 bg-background/95 backdrop-blur-md border-t border-border/30">
          <div className="max-w-3xl mx-auto">
            <Link href="/upload">
              <Button className="w-full rounded-full shadow-sm" size="lg" data-testid="button-scan-another">
                {t('results.scanAnother')}
              </Button>
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}

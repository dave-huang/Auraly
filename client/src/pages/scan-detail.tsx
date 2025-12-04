import { useState, useMemo } from "react";
import { useLocation, Link, useParams } from "wouter";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
import { ArrowLeft, Trash2, Search, Loader2, AlertTriangle, Clock, Pencil, Check, X, Settings } from "lucide-react";
import { IngredientCard } from "@/components/ingredient-card";
import { RiskSummary } from "@/components/risk-summary";
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
  const [isEditingName, setIsEditingName] = useState(false);
  const [editedName, setEditedName] = useState("");

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
      setIsEditingName(false);
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
      <div className="max-w-2xl mx-auto p-4">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <Link href="/history">
              <Button variant="ghost" size="icon" data-testid="button-back">
                <ArrowLeft className="w-5 h-5" />
              </Button>
            </Link>
            <div className="flex-1 min-w-0">
              {isEditingName ? (
                <div className="flex items-center gap-2">
                  <Input
                    value={editedName}
                    onChange={(e) => setEditedName(e.target.value)}
                    placeholder={t('results.productName.placeholder')}
                    className="text-xl font-bold h-auto py-1"
                    data-testid="input-product-name"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && editedName.trim()) {
                        renameMutation.mutate(editedName.trim());
                      } else if (e.key === 'Escape') {
                        setIsEditingName(false);
                      }
                    }}
                  />
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => {
                      if (editedName.trim()) {
                        renameMutation.mutate(editedName.trim());
                      }
                    }}
                    disabled={renameMutation.isPending || !editedName.trim()}
                    data-testid="button-save-name"
                  >
                    {renameMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Check className="h-4 w-4" />
                    )}
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => setIsEditingName(false)}
                    disabled={renameMutation.isPending}
                    data-testid="button-cancel-name"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <button
                  onClick={() => {
                    setEditedName(scan.productName || '');
                    setIsEditingName(true);
                  }}
                  className="group flex items-center gap-2 text-left hover-elevate rounded-md px-2 py-1 -ml-2"
                  data-testid="button-edit-product-name"
                >
                  <h1 className="text-xl font-bold truncate" data-testid="text-product-name">
                    {scan.productName || t('results.productName.placeholder')}
                  </h1>
                  <Pencil className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
                </button>
              )}
              <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                <span>{t(`history.categories.${scan.productCategory === 'food' ? 'food' : 'personal_care'}`)}</span>
                <span>•</span>
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {formatDate(scan.createdAt)}
                </span>
              </div>
            </div>
          </div>
          
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" size="icon" data-testid="button-delete-scan">
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
        </div>

        {scan.originalImageUrl && (
          <Card className="mb-6 overflow-hidden">
            <img 
              src={scan.originalImageUrl} 
              alt={scan.productName}
              className="w-full max-h-64 object-contain bg-muted"
              data-testid="img-product"
            />
          </Card>
        )}

        {showPersonalizedBanner && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-primary/5 border border-primary/10 mb-4">
            <Settings className="h-4 w-4 text-primary flex-shrink-0" />
            <p className="text-sm text-muted-foreground">
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

        <div className="mb-4 relative mt-6">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
          <Input
            placeholder={t('results.search')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
            data-testid="input-search"
          />
        </div>

        <Tabs defaultValue="all" className="mb-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger 
              value="all" 
              onClick={() => setSelectedRisk("all")}
              data-testid="tab-filter-all"
            >
              {t('results.filters.all')} ({adjustedIngredients.length})
            </TabsTrigger>
            <TabsTrigger 
              value="low" 
              onClick={() => setSelectedRisk("low")}
              data-testid="tab-filter-low"
            >
              {t('results.filters.low')} ({riskCounts.low})
            </TabsTrigger>
            <TabsTrigger 
              value="moderate" 
              onClick={() => setSelectedRisk("moderate")}
              data-testid="tab-filter-moderate"
            >
              {t('results.filters.moderate')} ({riskCounts.moderate})
            </TabsTrigger>
            <TabsTrigger 
              value="high" 
              onClick={() => setSelectedRisk("high")}
              data-testid="tab-filter-high"
            >
              {t('results.filters.high')} ({riskCounts.high})
            </TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="space-y-4 pb-8">
          {filteredIngredients.length === 0 ? (
            <Card className="p-8 text-center">
              <p className="text-muted-foreground">{t('results.noResults')}</p>
            </Card>
          ) : (
            filteredIngredients.map((ingredient, index) => (
              <IngredientCard key={`${ingredient.name}-${index}`} ingredient={ingredient} />
            ))
          )}
        </div>

        <div className="fixed bottom-0 left-0 right-0 p-4 bg-background/95 backdrop-blur border-t">
          <div className="max-w-2xl mx-auto">
            <Link href="/upload">
              <Button className="w-full" size="lg" data-testid="button-scan-another">
                {t('results.scanAnother')}
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

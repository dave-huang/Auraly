import { useState, useEffect, useCallback, useMemo } from "react";
import { useLocation, Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import { ArrowLeft, Trash2, Clock, AlertTriangle, Loader2, Package, UtensilsCrossed, Sparkles, Settings, Leaf } from "lucide-react";
import { NavigationMenu } from "@/components/navigation-menu";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useTranslation } from "react-i18next";
import { useToast } from "@/hooks/use-toast";
import { applyRiskPreferencesToIngredients, hasActivePreferences } from "@/lib/riskAdjustment";
import type { ScanHistory, Ingredient, RiskLevel, RiskPreferences, User } from "@shared/schema";

const riskConfig = {
  low: {
    color: "bg-emerald-500/80",
    bgColor: "bg-emerald-50/50 dark:bg-emerald-950/15",
    textColor: "text-emerald-700 dark:text-emerald-400",
  },
  moderate: {
    color: "bg-amber-500/80", 
    bgColor: "bg-amber-50/50 dark:bg-amber-950/15",
    textColor: "text-amber-700 dark:text-amber-400",
  },
  high: {
    color: "bg-red-500/80",
    bgColor: "bg-red-50/50 dark:bg-red-950/15",
    textColor: "text-red-700 dark:text-red-400",
  }
};

const categoryConfig = {
  food: {
    icon: UtensilsCrossed,
    bgColor: "bg-orange-50/50 dark:bg-orange-950/15",
    textColor: "text-orange-700 dark:text-orange-400",
  },
  personal_care: {
    icon: Sparkles,
    bgColor: "bg-violet-50/50 dark:bg-violet-950/15", 
    textColor: "text-violet-700 dark:text-violet-400",
  }
};

type CategoryFilter = "all" | "food" | "personal_care";

interface HistoryResponse {
  scans: ScanHistory[];
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}

export default function HistoryPage() {
  const { t } = useTranslation();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [offset, setOffset] = useState(0);
  const [allScans, setAllScans] = useState<ScanHistory[]>([]);
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>("all");
  const limit = 20;

  const { data: user } = useQuery<User>({
    queryKey: ['/api/auth/user'],
  });

  const userPreferences = user?.riskPreferences as RiskPreferences | undefined;
  const showPersonalizedBanner = userPreferences && hasActivePreferences(userPreferences);

  const { data, isLoading, error, isFetching } = useQuery<HistoryResponse>({
    queryKey: ['/api/history', { limit, offset }],
    queryFn: async () => {
      const response = await fetch(`/api/history?limit=${limit}&offset=${offset}`);
      if (!response.ok) throw new Error('Failed to fetch history');
      return response.json();
    },
  });

  useEffect(() => {
    if (data?.scans) {
      if (offset === 0) {
        setAllScans(data.scans);
      } else {
        setAllScans(prev => [...prev, ...data.scans]);
      }
    }
  }, [data, offset]);

  const loadMore = useCallback(() => {
    if (data?.hasMore && !isFetching) {
      setOffset(prev => prev + limit);
    }
  }, [data?.hasMore, isFetching]);

  useEffect(() => {
    const handleScroll = () => {
      if (
        window.innerHeight + document.documentElement.scrollTop >=
        document.documentElement.offsetHeight - 100
      ) {
        loadMore();
      }
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [loadMore]);

  const deleteAllMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("DELETE", "/api/history");
      return response.json();
    },
    onSuccess: () => {
      setAllScans([]);
      setOffset(0);
      queryClient.invalidateQueries({ queryKey: ['/api/history'] });
      toast({
        title: t('history.deleteAllSuccess'),
        description: t('history.deleteAllSuccessDesc'),
      });
    },
    onError: () => {
      toast({
        title: t('errors.generic'),
        variant: "destructive",
      });
    }
  });

  const getAdjustedResults = useCallback((scan: ScanHistory) => {
    const rawIngredients = scan.analysisResults as Ingredient[];
    if (!userPreferences) return rawIngredients;
    return applyRiskPreferencesToIngredients(rawIngredients, userPreferences);
  }, [userPreferences]);

  const getRiskSummary = (scan: ScanHistory) => {
    const adjustedResults = getAdjustedResults(scan);
    const high = adjustedResults.filter((r: Ingredient) => r.riskLevel === 'high').length;
    const moderate = adjustedResults.filter((r: Ingredient) => r.riskLevel === 'moderate').length;
    const low = adjustedResults.filter((r: Ingredient) => r.riskLevel === 'low').length;
    return { high, moderate, low };
  };

  const getAdjustedOverallRisk = (scan: ScanHistory): RiskLevel => {
    const adjustedResults = getAdjustedResults(scan);
    if (adjustedResults.length === 0) return scan.overallRisk as RiskLevel;
    const hasHigh = adjustedResults.some((i: Ingredient) => i.riskLevel === 'high');
    if (hasHigh) return 'high';
    const hasModerate = adjustedResults.some((i: Ingredient) => i.riskLevel === 'moderate');
    if (hasModerate) return 'moderate';
    return 'low';
  };

  const formatDate = (dateString: string | Date) => {
    const date = new Date(dateString);
    return date.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const normalizeCategory = (category: string): "food" | "personal_care" => {
    if (category === "food") return "food";
    return "personal_care";
  };

  const filteredScans = categoryFilter === "all" 
    ? allScans 
    : allScans.filter(scan => normalizeCategory(scan.productCategory) === categoryFilter);

  if (error) {
    return (
      <div className="min-h-screen bg-background p-4">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center gap-4 mb-6">
            <Link href="/">
              <Button variant="ghost" size="icon" data-testid="button-back">
                <ArrowLeft className="w-5 h-5" />
              </Button>
            </Link>
            <h1 className="text-2xl font-bold">{t('history.title')}</h1>
          </div>
          <Card className="p-8 text-center">
            <AlertTriangle className="w-12 h-12 text-destructive mx-auto mb-4" />
            <p className="text-muted-foreground">{t('errors.generic')}</p>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border/40 bg-background/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-3xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/">
              <Button variant="ghost" size="sm" className="gap-2 text-muted-foreground hover:text-foreground" data-testid="button-back">
                <ArrowLeft className="w-4 h-4" />
                <span className="font-light hidden sm:inline">{t('common.back')}</span>
              </Button>
            </Link>
          </div>
          <div className="hidden sm:flex items-center gap-2">
            <Leaf className="w-4 h-4 text-primary/60" />
            <span className="font-display text-lg">{t('app.title')}</span>
          </div>
          <div className="flex items-center gap-2">
            {allScans.length > 0 && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="ghost" size="sm" className="text-muted-foreground" data-testid="button-delete-all">
                    <Trash2 className="w-4 h-4" />
                    <span className="hidden sm:inline ml-2">{t('history.deleteAll')}</span>
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>{t('history.deleteAllConfirmTitle')}</AlertDialogTitle>
                    <AlertDialogDescription>
                      {t('history.deleteAllConfirmDesc')}
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel data-testid="button-cancel-delete-all">{t('common.cancel')}</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => deleteAllMutation.mutate()}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      data-testid="button-confirm-delete-all"
                    >
                      {deleteAllMutation.isPending ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        t('history.deleteAll')
                      )}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
            <NavigationMenu showHomeLink />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-3xl mx-auto px-6 py-10">
        {/* Page Title */}
        <div className="mb-8">
          <h1 className="font-display text-2xl md:text-3xl">{t('history.title')}</h1>
        </div>

        {showPersonalizedBanner && allScans.length > 0 && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-primary/5 border border-primary/10 mb-4">
            <Settings className="h-4 w-4 text-primary flex-shrink-0" />
            <p className="text-sm text-muted-foreground">
              {t('preferences.personalizedFor')}
            </p>
            <Link href="/settings">
              <Button
                variant="ghost"
                size="sm"
                className="ml-auto text-primary"
                data-testid="link-edit-preferences"
              >
                {t('preferences.settings')}
              </Button>
            </Link>
          </div>
        )}

        {allScans.length > 0 && (
          <Tabs value={categoryFilter} onValueChange={(v) => setCategoryFilter(v as CategoryFilter)} className="mb-6">
            <TabsList className="flex w-full gap-1 p-1 h-auto">
              <TabsTrigger value="all" className="flex-[0.8] py-2" data-testid="filter-all">
                {t('history.filters.all')}
              </TabsTrigger>
              <TabsTrigger value="food" className="flex-1 py-2" data-testid="filter-food">
                <UtensilsCrossed className="w-4 h-4 mr-1" />
                {t('history.filters.food')}
              </TabsTrigger>
              <TabsTrigger value="personal_care" className="flex-1 py-2" data-testid="filter-personal-care">
                <Sparkles className="w-4 h-4 mr-1" />
                {t('history.filters.personal_care')}
              </TabsTrigger>
            </TabsList>
          </Tabs>
        )}

        {isLoading && offset === 0 ? (
          <div className="flex flex-col items-center justify-center py-16">
            <Loader2 className="w-8 h-8 animate-spin text-primary mb-4" />
            <p className="text-muted-foreground">{t('common.loading')}</p>
          </div>
        ) : allScans.length === 0 ? (
          <Card className="p-8 text-center">
            <Package className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h2 className="text-lg font-semibold mb-2">{t('history.empty')}</h2>
            <p className="text-muted-foreground mb-6">{t('history.emptyDesc')}</p>
            <Link href="/upload">
              <Button data-testid="button-start-scanning">
                {t('history.startScanning')}
              </Button>
            </Link>
          </Card>
        ) : filteredScans.length === 0 ? (
          <Card className="p-8 text-center">
            <Package className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h2 className="text-lg font-semibold mb-2">{t('history.noResultsForFilter')}</h2>
            <p className="text-muted-foreground mb-4">
              {t(`history.categories.${categoryFilter}`)}
            </p>
            <Button variant="outline" onClick={() => setCategoryFilter("all")} data-testid="button-show-all">
              {t('history.filters.all')}
            </Button>
          </Card>
        ) : (
          <div className="space-y-4">
            {filteredScans.map((scan) => {
              const riskSummary = getRiskSummary(scan);
              const adjustedRisk = getAdjustedOverallRisk(scan);
              const riskConf = riskConfig[adjustedRisk] || riskConfig.low;
              const normalizedCat = normalizeCategory(scan.productCategory);
              const catConf = categoryConfig[normalizedCat];
              const CatIcon = catConf.icon;
              
              return (
                <Link
                  key={scan.id}
                  href={`/history/${scan.id}`}
                  data-testid={`link-scan-${scan.id}`}
                >
                  <Card className="p-5 hover-elevate cursor-pointer transition-all overflow-hidden">
                    <div className="flex gap-4">
                      {/* Product Image */}
                      {scan.originalImageUrl && (
                        <div className="w-14 h-14 rounded-lg overflow-hidden flex-shrink-0 bg-muted/50 border border-border/30">
                          <img 
                            src={scan.originalImageUrl} 
                            alt={scan.productName}
                            className="w-full h-full object-cover"
                          />
                        </div>
                      )}
                      
                      {/* Content */}
                      <div className="flex-1 min-w-0 overflow-hidden">
                        {/* Header: Product Name + Risk Badge */}
                        <div className="flex items-start justify-between gap-3 mb-2">
                          <h3 className="font-display text-base truncate" data-testid={`text-product-name-${scan.id}`}>
                            {scan.productName}
                          </h3>
                          <Badge className={`${riskConf.bgColor} ${riskConf.textColor} border-0 text-xs flex-shrink-0`}>
                            {t(`results.riskLevels.${adjustedRisk}`)}
                          </Badge>
                        </div>
                        
                        {/* Meta: Category + Date */}
                        <div className="flex flex-col gap-1 mb-3">
                          <Badge variant="outline" className={`${catConf.bgColor} ${catConf.textColor} border-0 text-xs w-fit`}>
                            <CatIcon className="w-3 h-3 mr-1" />
                            {t(`history.categories.${normalizedCat}`)}
                          </Badge>
                          <span className="text-xs text-muted-foreground/70 flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {formatDate(scan.createdAt)}
                          </span>
                        </div>
                        
                        {/* Risk Summary */}
                        <div className="flex items-center gap-4 text-xs pt-2 border-t border-border/30">
                          {riskSummary.high > 0 && (
                            <span className="text-red-600/90 dark:text-red-400 font-medium">
                              {riskSummary.high} {t('results.riskSummary.breakdown.highRisk')}
                            </span>
                          )}
                          {riskSummary.moderate > 0 && (
                            <span className="text-amber-600/90 dark:text-amber-400 font-medium">
                              {riskSummary.moderate} {t('results.riskSummary.breakdown.moderate')}
                            </span>
                          )}
                          {riskSummary.low > 0 && (
                            <span className="text-emerald-600/90 dark:text-emerald-400 font-medium">
                              {riskSummary.low} {t('results.riskSummary.breakdown.lowRisk')}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </Card>
                </Link>
              );
            })}
            
            {isFetching && offset > 0 && (
              <div className="flex justify-center py-4">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
              </div>
            )}
            
            {data && !data.hasMore && filteredScans.length > 0 && (
              <p className="text-center text-sm text-muted-foreground py-4">
                {t('history.endOfList')}
              </p>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

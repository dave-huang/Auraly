import { useState, useEffect, useCallback } from "react";
import { useLocation, Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
import { ArrowLeft, Trash2, Clock, AlertTriangle, Loader2, Package } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useTranslation } from "react-i18next";
import { useToast } from "@/hooks/use-toast";
import type { ScanHistory } from "@shared/schema";

const riskConfig = {
  low: {
    color: "bg-emerald-500",
    bgColor: "bg-emerald-50 dark:bg-emerald-950/20",
    textColor: "text-emerald-700 dark:text-emerald-400",
  },
  moderate: {
    color: "bg-amber-500", 
    bgColor: "bg-amber-50 dark:bg-amber-950/20",
    textColor: "text-amber-700 dark:text-amber-400",
  },
  high: {
    color: "bg-red-500",
    bgColor: "bg-red-50 dark:bg-red-950/20",
    textColor: "text-red-700 dark:text-red-400",
  }
};


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
  const limit = 20;

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

  const getRiskSummary = (scan: ScanHistory) => {
    const results = scan.analysisResults as any[];
    const high = results.filter(r => r.riskLevel === 'high').length;
    const moderate = results.filter(r => r.riskLevel === 'moderate').length;
    const low = results.filter(r => r.riskLevel === 'low').length;
    return { high, moderate, low };
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
      <div className="max-w-2xl mx-auto p-4">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <Link href="/">
              <Button variant="ghost" size="icon" data-testid="button-back">
                <ArrowLeft className="w-5 h-5" />
              </Button>
            </Link>
            <h1 className="text-2xl font-bold">{t('history.title')}</h1>
          </div>
          
          {allScans.length > 0 && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" size="sm" data-testid="button-delete-all">
                  <Trash2 className="w-4 h-4 mr-2" />
                  {t('history.deleteAll')}
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
        </div>

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
                {t('landing.hero.cta')}
              </Button>
            </Link>
          </Card>
        ) : (
          <div className="space-y-4">
            {allScans.map((scan) => {
              const riskSummary = getRiskSummary(scan);
              const config = riskConfig[scan.overallRisk as keyof typeof riskConfig] || riskConfig.low;
              
              return (
                <Link
                  key={scan.id}
                  href={`/history/${scan.id}`}
                  data-testid={`link-scan-${scan.id}`}
                >
                  <Card className="p-4 hover-elevate cursor-pointer transition-all">
                    <div className="flex gap-4">
                      {scan.originalImageUrl && (
                        <div className="w-16 h-16 rounded-lg overflow-hidden flex-shrink-0 bg-muted">
                          <img 
                            src={scan.originalImageUrl} 
                            alt={scan.productName}
                            className="w-full h-full object-cover"
                          />
                        </div>
                      )}
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2 mb-1">
                          <h3 className="font-semibold truncate" data-testid={`text-product-name-${scan.id}`}>
                            {scan.productName}
                          </h3>
                          <Badge className={`${config.bgColor} ${config.textColor} border-0 text-xs flex-shrink-0`}>
                            {t(`results.riskLevels.${scan.overallRisk}`)}
                          </Badge>
                        </div>
                        
                        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                          <span>{t(`upload.productTypes.${scan.productCategory === 'oral-care' ? 'oralCare' : scan.productCategory}.label`, { defaultValue: scan.productCategory })}</span>
                          <span>•</span>
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {formatDate(scan.createdAt)}
                          </span>
                        </div>
                        
                        <div className="flex items-center gap-3 text-xs">
                          {riskSummary.high > 0 && (
                            <span className="text-red-600 dark:text-red-400">
                              {riskSummary.high} {t('results.riskSummary.breakdown.highRisk')}
                            </span>
                          )}
                          {riskSummary.moderate > 0 && (
                            <span className="text-amber-600 dark:text-amber-400">
                              {riskSummary.moderate} {t('results.riskSummary.breakdown.moderate')}
                            </span>
                          )}
                          {riskSummary.low > 0 && (
                            <span className="text-emerald-600 dark:text-emerald-400">
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
            
            {data && !data.hasMore && allScans.length > 0 && (
              <p className="text-center text-sm text-muted-foreground py-4">
                {t('history.endOfList')}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

import { useEffect, useState, useRef, useMemo } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Camera, Loader2, Search, AlertCircle, Settings, Leaf } from "lucide-react";
import { ProductInfoCard } from "@/components/product-info-card";
import { NavigationMenu } from "@/components/navigation-menu";
import { IngredientCard } from "@/components/ingredient-card";
import { RiskSummary } from "@/components/risk-summary";
import { AllergenFlags } from "@/components/allergen-flags";
import type { AnalysisResult, Ingredient, RiskLevel, RiskPreferences } from "@shared/schema";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useTranslation } from "react-i18next";
import { applyRiskPreferences, hasActivePreferences } from "@/lib/riskAdjustment";
import { useSubscriptionStatus } from "@/hooks/use-subscription";
import { trackScan } from "@/lib/analytics";

// Helper function for direct polling fallback
const directPoll = async (requestId: string, resolve: any, reject: any, onOcrComplete?: () => void) => {
  const maxAttempts = 300; // 5 minutes with 1s polling
  let attempts = 0;
  let ocrNotified = false;
  
  while (attempts < maxAttempts) {
    try {
      const statusResponse = await fetch(`/api/analysis-status/${requestId}`);
      const statusData: any = await statusResponse.json();
      
      if (statusData.status === 'completed') {
        console.log(`[DIRECT-POLL] Analysis completed!`);
        resolve(statusData.analysis);
        return;
      }
      
      if (statusData.status === 'failed') {
        reject(new Error(statusData.error || 'Analysis failed'));
        return;
      }
      
      if (statusData.status === 'ocr_complete' && !ocrNotified) {
        console.log(`[DIRECT-POLL] OCR completed!`);
        ocrNotified = true;
        onOcrComplete?.();
      }
      
      // Still processing - wait 1 second before next poll
      console.log(`[DIRECT-POLL] Status: ${statusData.status} (attempt ${attempts + 1}/${maxAttempts})`);
      await new Promise(r => setTimeout(r, 1000));
      attempts++;
      
    } catch (error: any) {
      console.error(`[DIRECT-POLL] Error checking status:`, error.message);
      reject(error);
      return;
    }
  }
  
  reject(new Error('Analysis polling timeout - please try again'));
};

export default function ResultsPage() {
  const { t, i18n } = useTranslation();
  const [, setLocation] = useLocation();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedRisk, setSelectedRisk] = useState<RiskLevel | "all">("all");
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [progress, setProgress] = useState(0);
  const [cachedOcrText, setCachedOcrText] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [savedScanId, setSavedScanId] = useState<number | null>(null);
  const [ocrComplete, setOcrComplete] = useState(false);
  const wakeLockRef = useRef<any>(null);
  const hasSavedToHistoryRef = useRef<boolean>(false);
  const currentRequestIdRef = useRef<string | null>(null);
  const resolveRef = useRef<((value: AnalysisResult) => void) | null>(null);
  const rejectRef = useRef<((reason: any) => void) | null>(null);
  const onOcrCompleteRef = useRef<(() => void) | null>(null);

  const preferencesQuery = useQuery<{ preferences: RiskPreferences }>({
    queryKey: ['/api/user/preferences'],
    retry: false,
    staleTime: 60000
  });

  const { data: subscriptionStatus } = useSubscriptionStatus();
  const hasPremiumAccess = subscriptionStatus?.isPremium || subscriptionStatus?.isTrialActive || false;

  const userLanguage = useMemo(() => {
    if (i18n.language.startsWith('zh')) return 'zh';
    if (i18n.language.startsWith('es')) return 'es';
    return 'en';
  }, [i18n.language]);

  const displayResult = useMemo(() => {
    if (!analysisResult) return null;
    
    // Only apply personalization for Premium/Trial users
    if (!hasPremiumAccess) {
      return analysisResult;
    }
    
    const preferences = preferencesQuery.data?.preferences;
    if (!preferences || !hasActivePreferences(preferences)) {
      return analysisResult;
    }
    
    return applyRiskPreferences(analysisResult, preferences, userLanguage);
  }, [analysisResult, preferencesQuery.data, userLanguage, hasPremiumAccess]);

  // Auto-retry mutation with Service Worker polling for mobile background support
  const analyzeMutation = useMutation({
    mutationFn: async (data: { productType: string; imageData: string; ocrText?: string }): Promise<AnalysisResult> => {
      // Normalize language code to 'en', 'es', or 'zh'
      let userLanguage = 'en';
      if (i18n.language.startsWith('zh')) {
        userLanguage = 'zh';
      } else if (i18n.language.startsWith('es')) {
        userLanguage = 'es';
      }
      
      // Send scan request and get request ID
      const requestBody: any = {
        productType: data.productType,
        userLanguage,
        imageData: data.imageData,
        ocrText: data.ocrText
      };
      
      const response = await apiRequest("POST", "/api/scan-and-analyze", requestBody);
      const initialResult: any = await response.json();
      
      if (!initialResult.requestId) {
        throw new Error('Failed to get request ID from server');
      }
      
      const requestId = initialResult.requestId;
      currentRequestIdRef.current = requestId;
      console.log(`[POLLING] Started analysis with request ID: ${requestId}`);
      
      // Use Service Worker for background polling (continues even when tab is backgrounded)
      return new Promise((resolve, reject) => {
        // Store resolve/reject for visibility change resumption
        resolveRef.current = resolve;
        rejectRef.current = reject;
        // Register Service Worker
        if ('serviceWorker' in navigator) {
          navigator.serviceWorker.register('/service-worker.js', { scope: '/' }).then(registration => {
            console.log('[SERVICE-WORKER] Registered');
            
            // Send start polling message via MessageChannel for two-way communication
            const channel = new MessageChannel();
            
            // Listen for messages from Service Worker
            channel.port1.onmessage = (event: any) => {
              const msg = event.data;
              
              if (msg.type === 'ANALYSIS_COMPLETE') {
                console.log('[RESULT-PAGE] Received ANALYSIS_COMPLETE from Service Worker');
                if (msg.data.ocrText) {
                  setCachedOcrText(msg.data.ocrText);
                }
                resolve(msg.data.analysis);
              } else if (msg.type === 'ANALYSIS_FAILED') {
                console.log('[RESULT-PAGE] Received ANALYSIS_FAILED from Service Worker');
                reject(new Error(msg.error || 'Analysis failed'));
              } else if (msg.type === 'OCR_COMPLETE') {
                console.log('[RESULT-PAGE] Received OCR_COMPLETE from Service Worker');
                onOcrCompleteRef.current?.();
              }
            };
            
            // Send message to Service Worker via active controller
            if (navigator.serviceWorker.controller) {
              navigator.serviceWorker.controller.postMessage(
                { type: 'START_POLLING', requestId },
                [channel.port2]
              );
            } else {
              // Fallback: Service Worker not active yet, use direct polling
              console.log('[RESULT-PAGE] Service Worker not ready, using direct polling fallback');
              directPoll(requestId, resolve, reject, onOcrCompleteRef.current || undefined);
            }
          }).catch((error: any) => {
            console.error('[SERVICE-WORKER] Registration failed, falling back to direct polling:', error);
            directPoll(requestId, resolve, reject, onOcrCompleteRef.current || undefined);
          });
        } else {
          console.log('[RESULT-PAGE] Service Workers not supported, using direct polling');
          directPoll(requestId, resolve, reject, onOcrCompleteRef.current || undefined);
        }
      });
    },
    onSuccess: async (data: AnalysisResult) => {
      setAnalysisResult(data);
      setRetryCount(0);
      setCachedOcrText(null); // Clear cache after successful analysis
      currentRequestIdRef.current = null;
      resolveRef.current = null;
      rejectRef.current = null;
      
      // Track successful scan in Google Analytics
      trackScan(data.productType || 'unknown', true);
      
      // Clear pending analysis first
      sessionStorage.removeItem('pendingAnalysis');
      
      // Save to scan history API (async, non-blocking, prevent duplicates)
      if (!hasSavedToHistoryRef.current) {
        hasSavedToHistoryRef.current = true;
        try {
          const response = await apiRequest("POST", "/api/history", {
            productName: data.productName || "Unnamed Product",
            productCategory: data.productType || "other",
            detectedIngredients: data.ingredients.map(i => i.name),
            analysisResults: data.ingredients,
            overallRisk: data.overallRisk,
            language: i18n.language.startsWith('zh') ? 'zh' : i18n.language.startsWith('es') ? 'es' : 'en',
          });
          const result = await response.json();
          if (result.scanId) {
            setSavedScanId(result.scanId);
            console.log('[HISTORY] Scan saved to history with ID:', result.scanId);
            // Invalidate subscription status to refresh scan counter immediately
            queryClient.invalidateQueries({ queryKey: ['/api/subscription/status'] });
          }
        } catch (error) {
          console.error('[HISTORY] Failed to save scan to history:', error);
          hasSavedToHistoryRef.current = false; // Allow retry on next success
        }
      }
    },
    onError: () => {
      // Reset retry count on final error
      setRetryCount(0);
      currentRequestIdRef.current = null;
      resolveRef.current = null;
      rejectRef.current = null;
    }
  });

  // Mutation to update product name in history
  const renameMutation = useMutation({
    mutationFn: async (productName: string) => {
      if (!savedScanId) return null;
      const response = await apiRequest("PATCH", `/api/history/${savedScanId}`, { productName });
      return response.json();
    },
    onSuccess: () => {
      console.log('[HISTORY] Product name updated in history');
    },
    onError: (error) => {
      console.error('[HISTORY] Failed to update product name:', error);
    }
  });

  // Helper function to save the edited name
  const saveProductName = (newName: string) => {
    const finalName = newName.trim() || t('results.productName.unnamed');
    setAnalysisResult(prev => prev ? { ...prev, productName: finalName } : null);
    
    // If we have a saved scan ID, update the history
    if (savedScanId) {
      renameMutation.mutate(finalName);
    }
  };

  useEffect(() => {
    // Check if there's a pending analysis
    const pending = sessionStorage.getItem('pendingAnalysis');
    if (pending && !analysisResult && !analyzeMutation.isPending) {
      const data = JSON.parse(pending);
      // Reset save flag for new analysis
      hasSavedToHistoryRef.current = false;
      analyzeMutation.mutate(data);
    } else if (!pending && !analysisResult) {
      // No analysis to show, redirect to upload
      setLocation('/upload');
    }
  }, []);

  // Request Screen Wake Lock to keep device awake during analysis (mobile background support)
  useEffect(() => {
    if (analyzeMutation.isPending) {
      const requestWakeLock = async () => {
        try {
          if ('wakeLock' in navigator) {
            wakeLockRef.current = await (navigator as any).wakeLock.request('screen');
            console.log('[WAKE-LOCK] Screen wake lock acquired');
          }
        } catch (err) {
          console.log('[WAKE-LOCK] Wake lock not available:', (err as any).message);
        }
      };
      
      requestWakeLock();
    } else {
      // Release wake lock when analysis completes
      if (wakeLockRef.current) {
        wakeLockRef.current.release().catch(() => {});
        wakeLockRef.current = null;
        console.log('[WAKE-LOCK] Screen wake lock released');
      }
    }

    return () => {
      if (wakeLockRef.current) {
        wakeLockRef.current.release().catch(() => {});
        wakeLockRef.current = null;
      }
    };
  }, [analyzeMutation.isPending]);

  // Handle visibility change - re-acquire wake lock and resume polling when user returns from background
  useEffect(() => {
    const handleVisibilityChange = async () => {
      if (document.visibilityState === 'visible') {
        console.log('[VISIBILITY] Page became visible');
        
        // Re-acquire wake lock if analysis is still pending
        if (analyzeMutation.isPending && 'wakeLock' in navigator) {
          try {
            wakeLockRef.current = await (navigator as any).wakeLock.request('screen');
            console.log('[WAKE-LOCK] Re-acquired after visibility change');
          } catch (err) {
            console.log('[WAKE-LOCK] Failed to re-acquire:', (err as any).message);
          }
        }
        
        // Resume polling if there's an active request
        if (currentRequestIdRef.current && resolveRef.current && rejectRef.current) {
          console.log('[VISIBILITY] Resuming polling for request:', currentRequestIdRef.current);
          directPoll(currentRequestIdRef.current, resolveRef.current, rejectRef.current, onOcrCompleteRef.current || undefined);
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [analyzeMutation.isPending]);

  // Set up OCR complete callback and reset state when mutation starts
  useEffect(() => {
    if (analyzeMutation.isPending) {
      setOcrComplete(false);
      onOcrCompleteRef.current = () => {
        console.log('[PROGRESS] OCR phase complete, transitioning to analysis phase');
        setOcrComplete(true);
      };
    } else {
      setOcrComplete(false);
      onOcrCompleteRef.current = null;
    }
  }, [analyzeMutation.isPending]);

  // Animate progress bar with two phases based on actual OCR completion
  useEffect(() => {
    if (analyzeMutation.isPending) {
      if (!ocrComplete) {
        // Phase 1: OCR - animate from 0 to 40% over ~8 seconds (typical OCR time)
        setProgress(0);
        const ocrDuration = 8000;
        const interval = 100;
        const increment = (40 / ocrDuration) * interval;
        
        const timer = setInterval(() => {
          setProgress(prev => {
            const next = prev + increment;
            return next >= 40 ? 40 : next; // Cap at 40% during OCR phase
          });
        }, interval);
        
        return () => clearInterval(timer);
      } else {
        // Phase 2: Analysis - animate from 40% to 95% over ~12 seconds
        setProgress(40);
        const analysisDuration = 12000;
        const interval = 100;
        const increment = (55 / analysisDuration) * interval;
        
        const timer = setInterval(() => {
          setProgress(prev => {
            const next = prev + increment;
            return next >= 95 ? 95 : next; // Cap at 95%
          });
        }, interval);
        
        return () => clearInterval(timer);
      }
    } else {
      setProgress(0);
    }
  }, [analyzeMutation.isPending, ocrComplete]);

  // Map risk levels to sort order (higher number = higher priority)
  const riskLevelOrder: Record<RiskLevel, number> = {
    high: 3,
    moderate: 2,
    low: 1
  };

  const filteredIngredients = (displayResult?.ingredients.filter(ingredient => {
    const matchesSearch = ingredient.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesRisk = selectedRisk === "all" || ingredient.riskLevel === selectedRisk;
    return matchesSearch && matchesRisk;
  }) || []).sort((a, b) => {
    return riskLevelOrder[b.riskLevel] - riskLevelOrder[a.riskLevel];
  });

  const riskCounts = {
    low: displayResult?.ingredients.filter(i => i.riskLevel === "low").length || 0,
    moderate: displayResult?.ingredients.filter(i => i.riskLevel === "moderate").length || 0,
    high: displayResult?.ingredients.filter(i => i.riskLevel === "high").length || 0,
  };
  
  // Only show personalization features for Premium/Trial users
  const hasPreferences = hasPremiumAccess && 
    preferencesQuery.data?.preferences && 
    hasActivePreferences(preferencesQuery.data.preferences);

  if (analyzeMutation.isPending) {
    const phaseTitle = retryCount > 0 
      ? t('results.retrying.title', { attempt: retryCount + 1 })
      : ocrComplete 
        ? t('results.analyzing.phase2.title')
        : t('results.analyzing.phase1.title');
    const phaseDescription = retryCount > 0 
      ? t('results.retrying.description')
      : ocrComplete 
        ? t('results.analyzing.phase2.description')
        : t('results.analyzing.phase1.description');

    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="p-12 max-w-md w-full rounded-xl bg-card/50 border border-border/30 text-center shadow-sm">
          <div className="flex flex-col items-center gap-8">
            <div className="relative">
              <div className="absolute inset-0 bg-primary/10 rounded-full blur-2xl scale-150" />
              <div className="w-20 h-20 rounded-full bg-primary/5 border border-primary/20 flex items-center justify-center relative">
                <Loader2 className="w-10 h-10 text-primary animate-spin" />
              </div>
            </div>
            <div className="space-y-3">
              <h3 className="font-display text-2xl text-foreground">
                {phaseTitle}
              </h3>
              <p className="text-sm text-muted-foreground font-light leading-relaxed max-w-xs mx-auto">
                {phaseDescription}
              </p>
            </div>
            <div className="w-full space-y-3">
              <div className="w-full bg-muted/40 rounded-full h-2 overflow-hidden">
                <div 
                  className="h-full bg-primary rounded-full transition-all duration-500 ease-out"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <div className="flex justify-center gap-4">
                <div className={`flex items-center gap-2 text-xs ${!ocrComplete ? 'text-primary font-medium' : 'text-muted-foreground/60'}`}>
                  <div className={`w-2 h-2 rounded-full ${!ocrComplete ? 'bg-primary' : 'bg-muted-foreground/30'}`} />
                  <span>{t('results.analyzing.phase1.title')}</span>
                </div>
                <div className={`flex items-center gap-2 text-xs ${ocrComplete ? 'text-primary font-medium' : 'text-muted-foreground/60'}`}>
                  <div className={`w-2 h-2 rounded-full ${ocrComplete ? 'bg-primary' : 'bg-muted-foreground/30'}`} />
                  <span>{t('results.analyzing.phase2.title')}</span>
                </div>
              </div>
            </div>
            {retryCount > 0 && (
              <p className="text-xs text-muted-foreground/70 font-light">
                {cachedOcrText ? t('results.retrying.cached') : t('results.retrying.full')}
              </p>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (analyzeMutation.isError) {
    let errorMessage = (analyzeMutation.error as any)?.message || 'We couldn\'t analyze the image.';
    
    // Parse clean error message from JSON response format (e.g., "500: {\"error\":\"message\"}")
    try {
      const jsonMatch = errorMessage.match(/\{.*"error":\s*"([^"]+)".*\}/);
      if (jsonMatch && jsonMatch[1]) {
        errorMessage = jsonMatch[1];
      } else {
        // Try to extract just the status code message part
        const statusMatch = errorMessage.match(/^\d+:\s*(.+)$/);
        if (statusMatch && statusMatch[1]) {
          errorMessage = statusMatch[1];
        }
      }
    } catch (e) {
      // Keep original error message if parsing fails
    }
    
    // Determine if this is an OCR error or analysis error
    const isOCRError = errorMessage.includes('No ingredients found') || 
                       errorMessage.includes('No text found') || 
                       errorMessage.includes('extract text') ||
                       errorMessage.includes('OCR failed');
    
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="p-10 max-w-md w-full rounded-lg bg-card/60 border border-border/40 text-center">
          <div className="flex flex-col items-center gap-6">
            <div className="w-16 h-16 rounded-full bg-destructive/8 flex items-center justify-center border border-destructive/10">
              <AlertCircle className="w-7 h-7 text-destructive/70" />
            </div>
            <div>
              <h3 className="font-medium text-xl mb-3">
                {isOCRError ? t('results.error.ocr.title') : t('results.error.analysis.title')}
              </h3>
              <p className="text-sm text-muted-foreground leading-relaxed mb-4">
                {isOCRError 
                  ? t('results.error.ocr.description')
                  : errorMessage
                }
              </p>
              {isOCRError && (
                <ul className="text-xs text-muted-foreground text-left mb-6 space-y-1.5 font-light">
                  <li>{t('results.error.ocr.tips.lighting')}</li>
                  <li>{t('results.error.ocr.tips.closer')}</li>
                  <li>{t('results.error.ocr.tips.steady')}</li>
                  <li>{t('results.error.ocr.tips.clear')}</li>
                </ul>
              )}
            </div>
            <Button 
              onClick={() => {
                sessionStorage.removeItem('pendingAnalysis');
                setCachedOcrText(null);
                setLocation('/upload');
              }} 
              className="rounded-full px-8"
              data-testid="button-try-again"
            >
              <Camera className="mr-2 h-4 w-4" />
              {t('results.error.tryAgain')}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (!displayResult) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <header className="border-b border-border/30 bg-background/90 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-6 h-16 flex items-center justify-between">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setLocation('/')}
            className="gap-2 text-muted-foreground/70 hover:text-foreground"
            data-testid="button-home"
          >
            <ArrowLeft className="h-4 w-4" />
            <span className="font-light">{t('results.header.home')}</span>
          </Button>
          <div className="hidden sm:flex items-center gap-2.5">
            <Leaf className="w-4 h-4 text-primary/50" />
            <span className="font-display text-lg">{t('app.title')}</span>
          </div>
          <NavigationMenu showHomeLink />
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-3xl mx-auto px-6 py-8">
        {/* Product Info Card */}
        <ProductInfoCard
          productName={displayResult.productName || ''}
          productType={displayResult.productType}
          onRename={saveProductName}
          isRenaming={renameMutation.isPending}
        />

        {/* Personalization Notice */}
        {hasPreferences && (
          <div className="mb-4 p-3 bg-primary/5 border border-primary/10 rounded-xl flex items-center gap-2">
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

        {/* Risk Summary */}
        <RiskSummary 
          overallRisk={displayResult.overallRisk}
          riskCounts={riskCounts}
          totalIngredients={displayResult.ingredients.length}
        />

        {/* Allergen Flags - Premium/Trial only */}
        {hasPremiumAccess && <AllergenFlags ingredients={displayResult.ingredients} />}

        {/* Search Bar */}
        <div className="relative mb-6">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/60" />
          <Input
            type="search"
            placeholder={t('results.search')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-11 py-5 rounded-xl bg-card/50 border-border/30 focus:border-primary/30 transition-colors"
            data-testid="input-search-ingredients"
          />
        </div>

        {/* Risk Filter Tabs */}
        <Tabs value={selectedRisk} onValueChange={(value) => setSelectedRisk(value as RiskLevel | "all")} className="mb-8">
          <TabsList className="grid w-full grid-cols-4 h-auto bg-card/50 p-1.5 rounded-xl gap-1.5 border border-border/30">
            <TabsTrigger value="all" className="flex flex-col items-center gap-0.5 py-2.5 px-1 text-xs rounded-lg transition-all data-[state=active]:bg-card data-[state=active]:shadow-md data-[state=active]:border data-[state=active]:border-primary/40 data-[state=active]:text-primary" data-testid="tab-all">
              <span className="font-medium">{t('results.filters.all')}</span>
              <span className="text-[10px] data-[state=active]:text-primary/70">{displayResult.ingredients.length}</span>
            </TabsTrigger>
            <TabsTrigger value="low" className="flex flex-col items-center gap-0.5 py-2.5 px-1 text-xs rounded-lg transition-all data-[state=active]:bg-card data-[state=active]:shadow-md data-[state=active]:border data-[state=active]:border-primary/40 data-[state=active]:text-primary" data-testid="tab-low">
              <span className="font-medium">{t('results.filters.low')}</span>
              <span className="text-[10px] data-[state=active]:text-primary/70">{riskCounts.low}</span>
            </TabsTrigger>
            <TabsTrigger value="moderate" className="flex flex-col items-center gap-0.5 py-2.5 px-1 text-xs rounded-lg transition-all data-[state=active]:bg-card data-[state=active]:shadow-md data-[state=active]:border data-[state=active]:border-primary/40 data-[state=active]:text-primary" data-testid="tab-moderate">
              <span className="font-medium">{t('results.filters.moderate')}</span>
              <span className="text-[10px] data-[state=active]:text-primary/70">{riskCounts.moderate}</span>
            </TabsTrigger>
            <TabsTrigger value="high" className="flex flex-col items-center gap-0.5 py-2.5 px-1 text-xs rounded-lg transition-all data-[state=active]:bg-card data-[state=active]:shadow-md data-[state=active]:border data-[state=active]:border-primary/40 data-[state=active]:text-primary" data-testid="tab-high">
              <span className="font-medium">{t('results.filters.high')}</span>
              <span className="text-[10px] data-[state=active]:text-primary/70">{riskCounts.high}</span>
            </TabsTrigger>
          </TabsList>
        </Tabs>

        {/* Ingredients List */}
        <div className="space-y-4 pb-28">
          {filteredIngredients.length === 0 ? (
            <div className="p-10 rounded-xl bg-card/50 border border-border/30 text-center">
              <p className="text-muted-foreground font-light">
                {t('results.noResults')}
              </p>
            </div>
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
      <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-border/30 bg-background/95 backdrop-blur-md p-4 safe-area-pb">
        <div className="max-w-3xl mx-auto">
          <Button 
            onClick={() => setLocation('/upload')}
            className="w-full rounded-full shadow-sm"
            size="lg"
            data-testid="button-scan-another"
          >
            <Camera className="mr-2 h-4 w-4" />
            {t('results.scanAnother')}
          </Button>
        </div>
      </div>
    </div>
  );
}

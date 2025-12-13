import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Loader2, Leaf } from "lucide-react";
import { ProductTypeSelector } from "@/components/product-type-selector";
import { ImageUploader } from "@/components/image-uploader";
import { NavigationMenu } from "@/components/navigation-menu";
import { PaywallModal } from "@/components/paywall-modal";
import { ScanCounter } from "@/components/scan-counter";
import { useSubscriptionStatus, getRemainingScans } from "@/hooks/use-subscription";
import type { ProductType } from "@shared/schema";
import { useTranslation } from "react-i18next";

export default function UploadPage() {
  const { t } = useTranslation();
  const [, setLocation] = useLocation();
  const [selectedType, setSelectedType] = useState<ProductType | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showPaywall, setShowPaywall] = useState(false);
  const [uploaderKey, setUploaderKey] = useState(0); // Key to reset ImageUploader
  const { data: subscriptionStatus } = useSubscriptionStatus();

  const handleProductTypeSelect = (type: ProductType) => {
    setSelectedType(type);
  };

  const handleImageCapture = async (imageData: string) => {
    const remaining = getRemainingScans(subscriptionStatus);
    if (remaining <= 0 && !subscriptionStatus?.isPremium) {
      setShowPaywall(true);
      setUploaderKey(prev => prev + 1); // Reset ImageUploader to allow re-capture
      return;
    }
    try {
      setIsProcessing(true);
      
      const analysisData = {
        productType: selectedType,
        imageData: imageData
      };
      
      const dataString = JSON.stringify(analysisData);
      
      try {
        sessionStorage.setItem('pendingAnalysis', dataString);
      } catch (storageError: any) {
        if (storageError.name === 'QuotaExceededError') {
          sessionStorage.clear();
          sessionStorage.setItem('pendingAnalysis', dataString);
        } else {
          throw storageError;
        }
      }
      
      setTimeout(() => {
        setLocation('/results');
      }, 100);
    } catch (error) {
      console.error('[UploadPage] Error:', error);
      setIsProcessing(false);
      alert('Image is too large. Please try a clearer photo.');
    }
  };

  const handleBack = () => {
    if (selectedType) {
      setSelectedType(null);
    } else {
      setLocation('/');
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header - Refined and minimal */}
      <header className="border-b border-border/40 bg-background/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-6 h-16 flex items-center justify-between">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleBack}
            data-testid="button-back"
            className="gap-2 text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="font-light">{t('common.back')}</span>
          </Button>
          <div className="flex items-center gap-3">
            <ScanCounter variant="badge" />
            <div className="hidden sm:flex items-center gap-2">
              <Leaf className="w-4 h-4 text-primary/60" />
              <span className="font-display text-lg">{t('app.title')}</span>
            </div>
            <NavigationMenu showHomeLink />
          </div>
        </div>
      </header>

      <PaywallModal 
        open={showPaywall} 
        onClose={() => setShowPaywall(false)} 
        source="upload_page"
      />

      {/* Main Content - Generous spacing */}
      <main className="max-w-3xl mx-auto px-6 py-16 sm:py-20">
        {!selectedType ? (
          <div className="animate-fade-in">
            <div className="text-center mb-14">
              <p className="text-label mb-3">{t('upload.selectType.subtitle')}</p>
              <h2 className="font-display text-3xl md:text-4xl">{t('upload.selectType.title')}</h2>
            </div>
            <ProductTypeSelector onSelect={handleProductTypeSelect} />
          </div>
        ) : (
          <div className="animate-fade-in">
            <div className="text-center mb-14">
              <p className="text-label mb-3">{t('upload.uploadImage.subtitle')}</p>
              <h2 className="font-display text-3xl md:text-4xl">{t('upload.uploadImage.title')}</h2>
            </div>

            <ImageUploader 
              key={uploaderKey}
              onImageCapture={handleImageCapture}
              isProcessing={isProcessing}
            />

            {isProcessing && (
              <div className="mt-14">
                <div className="p-10 rounded-lg bg-card/60 border border-border/40 text-center">
                  <div className="flex flex-col items-center gap-6">
                    <div className="relative">
                      <div className="absolute inset-0 bg-primary/10 rounded-full blur-xl" />
                      <Loader2 className="w-14 h-14 text-primary/70 animate-spin relative" />
                    </div>
                    <div>
                      <h3 className="font-medium text-lg mb-2">{t('upload.analyzing.title')}</h3>
                      <p className="text-sm text-muted-foreground max-w-sm leading-relaxed">
                        {t('upload.analyzing.description')}
                      </p>
                    </div>
                    <div className="w-full max-w-xs rounded-full h-1.5 bg-muted overflow-hidden">
                      <div className="h-full bg-primary/60 rounded-full animate-pulse" style={{ width: '70%' }} />
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

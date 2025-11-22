import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ArrowLeft, Loader2 } from "lucide-react";
import { ProductTypeSelector } from "@/components/product-type-selector";
import { ImageUploader } from "@/components/image-uploader";
import { LanguageSwitcher } from "@/components/language-switcher";
import type { ProductType } from "@shared/schema";
import { useTranslation } from "react-i18next";

export default function UploadPage() {
  const { t } = useTranslation();
  const [, setLocation] = useLocation();
  const [selectedType, setSelectedType] = useState<ProductType | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const handleProductTypeSelect = (type: ProductType) => {
    setSelectedType(type);
  };

  const handleImageCapture = async (imageData: string) => {
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
      {/* Header - Minimal */}
      <header className="border-b bg-background/95 backdrop-blur sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleBack}
            data-testid="button-back"
            className="gap-1"
          >
            <ArrowLeft className="w-4 h-4" />
            {t('common.back')}
          </Button>
          <div className="flex items-center gap-6">
            <h1 className="font-serif text-lg font-bold hidden sm:block">{t('app.title')}</h1>
            <LanguageSwitcher />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 py-16">
        {!selectedType ? (
          <div>
            <div className="text-center mb-12">
              <h2 className="text-3xl md:text-4xl font-bold mb-3">{t('upload.selectType.title')}</h2>
              <p className="text-muted-foreground">{t('upload.selectType.subtitle')}</p>
            </div>
            <ProductTypeSelector onSelect={handleProductTypeSelect} />
          </div>
        ) : (
          <div>
            <div className="text-center mb-12">
              <h2 className="text-3xl md:text-4xl font-bold mb-3">{t('upload.uploadImage.title')}</h2>
              <p className="text-muted-foreground">{t('upload.uploadImage.subtitle')}</p>
            </div>

            <ImageUploader 
              onImageCapture={handleImageCapture}
              isProcessing={isProcessing}
            />

            {isProcessing && (
              <div className="mt-12">
                <Card className="p-10 bg-gradient-to-br from-primary/5 to-background text-center">
                  <div className="flex flex-col items-center gap-6">
                    <div className="relative">
                      <div className="absolute inset-0 bg-primary/20 rounded-full blur-lg" />
                      <Loader2 className="w-16 h-16 text-primary animate-spin relative" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-lg mb-1">{t('upload.analyzing.title')}</h3>
                      <p className="text-sm text-muted-foreground max-w-sm">
                        {t('upload.analyzing.description')}
                      </p>
                    </div>
                    <div className="w-full max-w-xs rounded-full h-2 bg-muted overflow-hidden">
                      <div className="h-full bg-gradient-to-r from-primary to-primary/60 rounded-full animate-pulse" />
                    </div>
                  </div>
                </Card>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

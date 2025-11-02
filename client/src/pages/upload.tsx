import { useState, useRef } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ArrowLeft, Upload, Camera, Loader2 } from "lucide-react";
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
    console.log('[UploadPage] handleImageCapture called', {
      selectedType,
      imageDataLength: imageData?.length,
      timestamp: new Date().toISOString()
    });
    
    try {
      console.log('[UploadPage] Setting isProcessing to true');
      setIsProcessing(true);
      
      const analysisData = {
        productType: selectedType,
        imageData: imageData
      };
      
      console.log('[UploadPage] Storing to sessionStorage', {
        productType: selectedType,
        imageDataLength: imageData?.length
      });
      
      // Store the data for the results page
      sessionStorage.setItem('pendingAnalysis', JSON.stringify(analysisData));
      
      console.log('[UploadPage] sessionStorage saved, scheduling navigation in 100ms');
      
      // Use setTimeout to ensure sessionStorage is written before navigation
      // This fixes mobile browser navigation issues, especially on iPhone
      setTimeout(() => {
        console.log('[UploadPage] Navigating to /results');
        setLocation('/results');
      }, 100);
    } catch (error) {
      console.error('[UploadPage] Error handling image capture:', error);
      setIsProcessing(false);
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
      {/* Header */}
      <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleBack}
            data-testid="button-back"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            {t('common.back')}
          </Button>
          <h1 className="font-serif text-xl font-bold">{t('upload.header.title')}</h1>
          <LanguageSwitcher />
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 py-12">
        {!selectedType ? (
          <div>
            <div className="text-center mb-12">
              <h2 className="text-3xl md:text-4xl font-bold mb-4">
                {t('upload.selectType.title')}
              </h2>
              <p className="text-muted-foreground text-lg">
                {t('upload.selectType.subtitle')}
              </p>
            </div>
            
            <ProductTypeSelector onSelect={handleProductTypeSelect} />
          </div>
        ) : (
          <div>
            <div className="text-center mb-8">
              <h2 className="text-3xl md:text-4xl font-bold mb-4">
                {t('upload.uploadImage.title')}
              </h2>
              <p className="text-muted-foreground text-lg">
                {t('upload.uploadImage.subtitle')}
              </p>
            </div>

            <ImageUploader 
              onImageCapture={handleImageCapture}
              isProcessing={isProcessing}
            />

            {isProcessing && (
              <div className="mt-8">
                <Card className="p-8">
                  <div className="flex flex-col items-center gap-4 text-center">
                    <Loader2 className="w-12 h-12 text-primary animate-spin" />
                    <div>
                      <h3 className="font-semibold text-lg mb-1">{t('upload.analyzing.title')}</h3>
                      <p className="text-sm text-muted-foreground">
                        {t('upload.analyzing.description')}
                      </p>
                    </div>
                    <div className="w-full max-w-xs bg-muted rounded-full h-2 overflow-hidden">
                      <div className="h-full bg-primary rounded-full animate-pulse" style={{ width: '60%' }} />
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

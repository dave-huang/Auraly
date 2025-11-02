import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { ProductTypeSelector } from "@/components/product-type-selector";
import { ImageUploader } from "@/components/image-uploader";
import { LanguageSwitcher } from "@/components/language-switcher";
import type { ProductType } from "@shared/schema";
import { useTranslation } from "react-i18next";

export default function UploadPage() {
  const { t } = useTranslation();
  const [, setLocation] = useLocation();
  const [selectedType, setSelectedType] = useState<ProductType | null>(null);

  const handleProductTypeSelect = (type: ProductType) => {
    setSelectedType(type);
  };

  const handleImageCapture = (imageData: string) => {
    // Store the data for the results page
    sessionStorage.setItem('pendingAnalysis', JSON.stringify({
      productType: selectedType,
      imageData: imageData
    }));
    
    // Navigate to results page which will handle the actual analysis
    setLocation('/results');
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
            />
          </div>
        )}
      </main>
    </div>
  );
}

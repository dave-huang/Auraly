import { useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Upload, Camera, ScanLine } from "lucide-react";
import { useTranslation } from "react-i18next";

interface ImageUploaderProps {
  onImageCapture: (imageData: string) => void;
}

export function ImageUploader({ onImageCapture }: ImageUploaderProps) {
  const { t } = useTranslation();
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (file: File) => {
    if (!file) {
      console.log('ImageUploader: No file selected');
      return;
    }

    console.log('ImageUploader: File selected:', file.name, file.type, file.size);

    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = reader.result as string;
      console.log('ImageUploader: File read complete, calling onImageCapture with', base64String.substring(0, 50) + '...');
      onImageCapture(base64String);
    };
    reader.onerror = (error) => {
      console.error('ImageUploader: FileReader error:', error);
    };
    reader.readAsDataURL(file);
  };

  const handleCameraInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    console.log('Camera input change triggered');
    const file = e.target.files?.[0];
    if (file) {
      handleFileSelect(file);
      e.target.value = '';
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    console.log('File input change triggered');
    const file = e.target.files?.[0];
    if (file) {
      handleFileSelect(file);
      e.target.value = '';
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) {
      handleFileSelect(file);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleKeyDown = (e: React.KeyboardEvent, inputRef: React.RefObject<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      inputRef.current?.click();
    }
  };

  return (
    <div className="space-y-6">
      {/* Camera input - visually hidden but accessible to iOS */}
      <input
        ref={cameraInputRef}
        id="camera-input"
        type="file"
        accept="image/*"
        capture="environment"
        className="absolute opacity-0 pointer-events-none"
        onChange={handleCameraInputChange}
        aria-hidden="true"
      />
      
      {/* File input - visually hidden but accessible to iOS */}
      <input
        ref={fileInputRef}
        id="file-input"
        type="file"
        accept="image/*"
        className="absolute opacity-0 pointer-events-none"
        onChange={handleFileInputChange}
        aria-hidden="true"
      />

      {/* Primary CTA: Scan with Camera */}
      <Card className="p-8 text-center hover-elevate">
        <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
          <ScanLine className="w-10 h-10 text-primary" />
        </div>
        <h3 className="text-2xl font-semibold mb-2">{t('imageUploader.scanWithCamera')}</h3>
        <p className="text-muted-foreground mb-6">{t('imageUploader.scanDescription')}</p>
        <label htmlFor="camera-input" className="w-full block">
          <Button
            variant="default"
            size="lg"
            asChild
            className="w-full"
            data-testid="button-scan-camera"
          >
            <span className="flex items-center justify-center cursor-pointer">
              <Camera className="mr-2 h-5 w-5" />
              {t('imageUploader.openCamera')}
            </span>
          </Button>
        </label>
      </Card>

      {/* Divider */}
      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-border"></div>
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-background px-2 text-muted-foreground">
            {t('imageUploader.or')}
          </span>
        </div>
      </div>

      {/* Secondary CTA: Upload from Files with Drag & Drop */}
      <label htmlFor="file-input" className="block">
        <Card
          className="border-2 border-dashed hover-elevate transition-all cursor-pointer"
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onKeyDown={(e) => handleKeyDown(e, fileInputRef)}
          tabIndex={0}
          role="button"
          aria-label={t('imageUploader.uploadFromFiles')}
          data-testid="card-dropzone"
        >
          <div className="p-8 text-center">
            <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mx-auto mb-3">
              <Upload className="w-6 h-6 text-muted-foreground" />
            </div>
            <h4 className="font-semibold mb-1">{t('imageUploader.uploadFromFiles')}</h4>
            <p className="text-sm text-muted-foreground mb-1">
              {t('imageUploader.dragDropOrClick')}
            </p>
            <p className="text-xs text-muted-foreground">
              {t('imageUploader.supportedFormats')}
            </p>
          </div>
        </Card>
      </label>
    </div>
  );
}

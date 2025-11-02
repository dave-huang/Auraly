import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Upload, Camera, X, Image as ImageIcon, ScanLine } from "lucide-react";
import { useTranslation } from "react-i18next";

interface ImageUploaderProps {
  onImageCapture: (imageData: string) => void;
  isProcessing?: boolean;
}

export function ImageUploader({ onImageCapture, isProcessing = false }: ImageUploaderProps) {
  const { t } = useTranslation();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const handleFileSelect = (file: File, fromCamera: boolean = false) => {
    console.log('[ImageUploader] handleFileSelect called', { 
      hasFile: !!file, 
      fromCamera, 
      isProcessing,
      fileName: file?.name,
      fileSize: file?.size,
      fileType: file?.type
    });
    
    if (!file || isProcessing) {
      console.log('[ImageUploader] Aborting - no file or already processing');
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = reader.result as string;
      console.log('[ImageUploader] FileReader completed', {
        fromCamera,
        base64Length: base64String?.length
      });
      
      // For camera captures, proceed directly to analysis without preview
      if (fromCamera) {
        console.log('[ImageUploader] Camera flow - calling onImageCapture');
        onImageCapture(base64String);
      } else {
        // For file uploads, show preview first
        console.log('[ImageUploader] File upload flow - setting preview and calling onImageCapture');
        setPreviewUrl(base64String);
        onImageCapture(base64String);
      }
    };
    
    reader.onerror = (error) => {
      console.error('[ImageUploader] FileReader error:', error);
    };
    
    console.log('[ImageUploader] Starting FileReader.readAsDataURL');
    reader.readAsDataURL(file);
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    console.log('[ImageUploader] handleFileInputChange triggered', {
      hasFiles: !!e.target.files,
      fileCount: e.target.files?.length,
      isCameraInput: e.target === cameraInputRef.current,
      targetElement: e.target
    });
    
    const file = e.target.files?.[0];
    if (file) {
      // Check if this came from the camera input
      const isFromCamera = e.target === cameraInputRef.current;
      console.log('[ImageUploader] File detected, calling handleFileSelect', { isFromCamera });
      handleFileSelect(file, isFromCamera);
    } else {
      console.log('[ImageUploader] No file found in input');
    }
  };

  const handleClearPreview = () => {
    setPreviewUrl(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (cameraInputRef.current) cameraInputRef.current.value = '';
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

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      fileInputRef.current?.click();
    }
  };

  if (previewUrl && !isProcessing) {
    return (
      <Card className="p-6">
        <div className="relative">
          <img 
            src={previewUrl} 
            alt="Preview" 
            className="w-full h-auto rounded-lg"
          />
          <Button
            variant="destructive"
            size="icon"
            className="absolute top-2 right-2 rounded-full"
            onClick={handleClearPreview}
            aria-label={t('imageUploader.clearImage')}
            data-testid="button-clear-image"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
        <p className="text-sm text-muted-foreground mt-4 text-center">
          {t('imageUploader.imageSelected')}
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileInputChange}
        disabled={isProcessing}
      />
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleFileInputChange}
        disabled={isProcessing}
      />

      {/* Primary CTA: Scan with Camera */}
      <Card className="p-8 text-center hover-elevate">
        <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
          <ScanLine className="w-10 h-10 text-primary" />
        </div>
        <h3 className="text-2xl font-semibold mb-2">{t('imageUploader.scanWithCamera')}</h3>
        <p className="text-muted-foreground mb-6">{t('imageUploader.scanDescription')}</p>
        <Button
          variant="default"
          size="lg"
          onClick={() => cameraInputRef.current?.click()}
          disabled={isProcessing}
          className="w-full"
          data-testid="button-scan-camera"
        >
          <Camera className="mr-2 h-5 w-5" />
          {t('imageUploader.openCamera')}
        </Button>
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
      <Card
        className="border-2 border-dashed hover-elevate transition-all cursor-pointer"
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onClick={() => fileInputRef.current?.click()}
        onKeyDown={handleKeyDown}
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
    </div>
  );
}

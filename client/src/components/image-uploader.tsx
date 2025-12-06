import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Upload, Camera, X, ScanLine } from "lucide-react";
import { useTranslation } from "react-i18next";
import { preprocessImageForOCR } from "@/lib/imagePreprocessor";

interface ImageUploaderProps {
  onImageCapture: (imageData: string) => void;
  isProcessing?: boolean;
}

export function ImageUploader({ onImageCapture, isProcessing = false }: ImageUploaderProps) {
  const { t } = useTranslation();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const handleFileSelect = async (file: File, fromCamera: boolean = false) => {
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
    reader.onloadend = async () => {
      try {
        const base64String = reader.result as string;
        console.log('[ImageUploader] FileReader completed', {
          fromCamera,
          base64Length: base64String?.length,
          originalSize: file.size
        });
        
        console.log('[ImageUploader] Starting image preprocessing for OCR optimization...');
        const startTime = Date.now();
        const processedImage = await preprocessImageForOCR(base64String);
        const processingTime = Date.now() - startTime;
        
        console.log('[ImageUploader] Image preprocessing completed', {
          processingTimeMs: processingTime,
          originalLength: base64String?.length,
          processedLength: processedImage?.length,
          sizeChange: `${((processedImage.length / base64String.length) * 100).toFixed(1)}%`
        });
        
        if (fromCamera) {
          console.log('[ImageUploader] Camera flow - calling onImageCapture with processed image');
          onImageCapture(processedImage);
        } else {
          console.log('[ImageUploader] File upload flow - setting preview and calling onImageCapture with processed image');
          setPreviewUrl(processedImage);
          onImageCapture(processedImage);
        }
      } catch (error) {
        console.error('[ImageUploader] Error during image preprocessing:', error);
        const base64String = reader.result as string;
        console.log('[ImageUploader] Falling back to unprocessed image');
        
        if (fromCamera) {
          onImageCapture(base64String);
        } else {
          setPreviewUrl(base64String);
          onImageCapture(base64String);
        }
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
      <div className="p-6 rounded-lg bg-card/60 border border-border/40">
        <div className="relative">
          <img 
            src={previewUrl} 
            alt="Preview" 
            className="w-full h-auto rounded-md"
          />
          <Button
            variant="secondary"
            size="icon"
            className="absolute top-3 right-3 rounded-full bg-background/80 backdrop-blur-sm hover:bg-background"
            onClick={handleClearPreview}
            aria-label={t('imageUploader.clearImage')}
            data-testid="button-clear-image"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
        <p className="text-sm text-muted-foreground mt-5 text-center font-light">
          {t('imageUploader.imageSelected')}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
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
      <div className="p-10 rounded-lg bg-card/60 border border-border/40 text-center hover-elevate transition-all duration-300">
        <div className="w-20 h-20 rounded-full bg-primary/8 flex items-center justify-center mx-auto mb-6 border border-primary/10">
          <ScanLine className="w-9 h-9 text-primary/70" />
        </div>
        <h3 className="text-xl font-medium mb-2">{t('imageUploader.scanWithCamera')}</h3>
        <p className="text-sm text-muted-foreground mb-8 leading-relaxed max-w-sm mx-auto">{t('imageUploader.scanDescription')}</p>
        <Button
          variant="default"
          size="lg"
          onClick={() => cameraInputRef.current?.click()}
          disabled={isProcessing}
          className="w-full max-w-xs rounded-full"
          data-testid="button-scan-camera"
        >
          <Camera className="mr-2 h-4 w-4" />
          {t('imageUploader.openCamera')}
        </Button>
      </div>

      {/* Divider */}
      <div className="relative py-2">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-border/40"></div>
        </div>
        <div className="relative flex justify-center">
          <span className="bg-background px-4 text-xs uppercase tracking-wider text-muted-foreground font-light">
            {t('imageUploader.or')}
          </span>
        </div>
      </div>

      {/* Secondary CTA: Upload from Files with Drag & Drop */}
      <div
        className="border-2 border-dashed border-border/50 rounded-lg hover-elevate transition-all duration-300 cursor-pointer"
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onClick={() => fileInputRef.current?.click()}
        onKeyDown={handleKeyDown}
        tabIndex={0}
        role="button"
        aria-label={t('imageUploader.uploadFromFiles')}
        data-testid="card-dropzone"
      >
        <div className="p-10 text-center">
          <div className="w-14 h-14 rounded-full bg-muted/60 flex items-center justify-center mx-auto mb-4">
            <Upload className="w-6 h-6 text-muted-foreground" />
          </div>
          <h4 className="font-medium mb-2">{t('imageUploader.uploadFromFiles')}</h4>
          <p className="text-sm text-muted-foreground mb-1 font-light">
            {t('imageUploader.dragDropOrClick')}
          </p>
          <p className="text-xs text-muted-foreground/70 font-light">
            {t('imageUploader.supportedFormats')}
          </p>
        </div>
      </div>
    </div>
  );
}

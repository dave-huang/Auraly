import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Upload, Camera, X, Image as ImageIcon } from "lucide-react";

interface ImageUploaderProps {
  onImageCapture: (imageData: string) => void;
  isProcessing?: boolean;
}

export function ImageUploader({ onImageCapture, isProcessing = false }: ImageUploaderProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const handleFileSelect = (file: File) => {
    if (!file || isProcessing) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = reader.result as string;
      setPreviewUrl(base64String);
      onImageCapture(base64String);
    };
    reader.readAsDataURL(file);
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileSelect(file);
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
            data-testid="button-clear-image"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
        <p className="text-sm text-muted-foreground mt-4 text-center">
          Image selected. Click "Clear" to choose a different image.
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Dropzone */}
      <Card
        className="border-2 border-dashed hover-elevate transition-all cursor-pointer"
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onClick={() => fileInputRef.current?.click()}
        data-testid="card-dropzone"
      >
        <div className="p-12 text-center">
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
            <ImageIcon className="w-8 h-8 text-primary" />
          </div>
          <h3 className="font-semibold text-lg mb-2">
            Drop image here or click to browse
          </h3>
          <p className="text-sm text-muted-foreground mb-4">
            Upload a clear photo of the ingredient list
          </p>
          <p className="text-xs text-muted-foreground">
            Supports JPG, PNG, HEIC
          </p>
        </div>
      </Card>

      {/* Action Buttons */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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

        <Button
          variant="outline"
          size="lg"
          onClick={() => fileInputRef.current?.click()}
          disabled={isProcessing}
          className="w-full"
          data-testid="button-upload-file"
        >
          <Upload className="mr-2 h-5 w-5" />
          Upload from Files
        </Button>

        <Button
          variant="outline"
          size="lg"
          onClick={() => cameraInputRef.current?.click()}
          disabled={isProcessing}
          className="w-full"
          data-testid="button-use-camera"
        >
          <Camera className="mr-2 h-5 w-5" />
          Use Camera
        </Button>
      </div>
    </div>
  );
}

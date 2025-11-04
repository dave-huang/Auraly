/**
 * Image preprocessing utilities for OCR optimization
 * Enhances image quality to improve text recognition accuracy
 */

interface PreprocessOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
  enhanceContrast?: boolean;
  sharpen?: boolean;
}

const DEFAULT_OPTIONS: PreprocessOptions = {
  maxWidth: 1800, // Increased for better OCR accuracy while keeping file size reasonable
  maxHeight: 1800,
  quality: 0.90, // Higher quality for better text recognition
  enhanceContrast: true,
  sharpen: true,
};

/**
 * Preprocess image to optimize for OCR
 * - Resizes to optimal dimensions
 * - Enhances contrast for better text visibility
 * - Sharpens edges to improve character recognition
 * - Maintains aspect ratio
 */
export async function preprocessImageForOCR(
  base64Image: string,
  options: PreprocessOptions = {}
): Promise<string> {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  return new Promise((resolve, reject) => {
    const img = new Image();
    
    img.onload = () => {
      try {
        // Calculate new dimensions while maintaining aspect ratio
        let width = img.width;
        let height = img.height;
        
        // Only resize if image is larger than max dimensions
        if (width > opts.maxWidth! || height > opts.maxHeight!) {
          const ratio = Math.min(opts.maxWidth! / width, opts.maxHeight! / height);
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }
        
        // Create canvas for processing
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        
        if (!ctx) {
          reject(new Error('Failed to get canvas context'));
          return;
        }
        
        // Draw image at calculated size
        ctx.drawImage(img, 0, 0, width, height);
        
        // Apply image enhancements
        if (opts.enhanceContrast || opts.sharpen) {
          const imageData = ctx.getImageData(0, 0, width, height);
          const data = imageData.data;
          
          // Enhance contrast to make text more readable
          if (opts.enhanceContrast) {
            const factor = 1.3; // Contrast enhancement factor
            for (let i = 0; i < data.length; i += 4) {
              // Apply contrast adjustment to RGB channels
              data[i] = clamp(((data[i] - 128) * factor) + 128);     // Red
              data[i + 1] = clamp(((data[i + 1] - 128) * factor) + 128); // Green
              data[i + 2] = clamp(((data[i + 2] - 128) * factor) + 128); // Blue
            }
          }
          
          // Sharpen to improve edge detection for character recognition
          if (opts.sharpen) {
            sharpenImage(imageData);
          }
          
          ctx.putImageData(imageData, 0, 0);
        }
        
        // Convert to base64 with high quality
        const processedBase64 = canvas.toDataURL('image/jpeg', opts.quality);
        resolve(processedBase64);
      } catch (error) {
        reject(error);
      }
    };
    
    img.onerror = () => {
      reject(new Error('Failed to load image for preprocessing'));
    };
    
    img.src = base64Image;
  });
}

/**
 * Apply sharpening filter to enhance edges
 * Uses a 3x3 convolution kernel
 */
function sharpenImage(imageData: ImageData): void {
  const width = imageData.width;
  const height = imageData.height;
  const data = imageData.data;
  const copy = new Uint8ClampedArray(data);
  
  // Sharpening kernel (3x3)
  // [-1, -1, -1]
  // [-1,  9, -1]
  // [-1, -1, -1]
  const kernel = [
    -1, -1, -1,
    -1,  9, -1,
    -1, -1, -1
  ];
  
  // Apply kernel to each pixel (excluding edges for simplicity)
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      for (let c = 0; c < 3; c++) { // RGB channels only
        let sum = 0;
        
        // Apply 3x3 kernel
        for (let ky = -1; ky <= 1; ky++) {
          for (let kx = -1; kx <= 1; kx++) {
            const pixelIndex = ((y + ky) * width + (x + kx)) * 4 + c;
            const kernelIndex = (ky + 1) * 3 + (kx + 1);
            sum += copy[pixelIndex] * kernel[kernelIndex];
          }
        }
        
        const currentIndex = (y * width + x) * 4 + c;
        data[currentIndex] = clamp(sum);
      }
    }
  }
}

/**
 * Clamp value between 0 and 255
 */
function clamp(value: number): number {
  return Math.max(0, Math.min(255, value));
}

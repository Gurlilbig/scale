import { useState, useRef, useEffect } from 'react';
import ReactCrop, { type Crop as ReactCropType } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';
import { Button } from "@/components/ui/button";
import { Loader2, Save } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter
} from "@/components/ui/dialog";

interface CropControlsProps {
  onApply: (dimensions: { width: number; height: number }) => void;
  imageUrl: string;
  imageTitle?: string;
}

// This function handles the actual image cropping
function getCroppedImg(image: HTMLImageElement, crop: ReactCropType): Promise<string> {
  const canvas = document.createElement('canvas');
  const scaleX = image.naturalWidth / image.width;
  const scaleY = image.naturalHeight / image.height;
  
  // Convert percentage values to pixels
  const pixelCrop = {
    x: Math.round((crop.x / 100) * image.naturalWidth),
    y: Math.round((crop.y / 100) * image.naturalHeight),
    width: Math.round((crop.width / 100) * image.naturalWidth),
    height: Math.round((crop.height / 100) * image.naturalHeight)
  };
  
  canvas.width = pixelCrop.width;
  canvas.height = pixelCrop.height;
  
  const ctx = canvas.getContext('2d');
  
  if (!ctx) {
    throw new Error('Could not get canvas context');
  }
  
  ctx.drawImage(
    image,
    pixelCrop.x,
    pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height,
    0,
    0,
    pixelCrop.width,
    pixelCrop.height
  );
  
  return new Promise((resolve, reject) => {
    try {
      const dataUrl = canvas.toDataURL('image/jpeg', 1.0);
      resolve(dataUrl);
    } catch (e) {
      reject(e);
    }
  });
}

export const CropControls = ({ 
  onApply, 
  imageUrl,
  imageTitle = 'Image'
}: CropControlsProps) => {
  // Generate proxied image URL
  const proxyImageUrl = `/api/proxy-image?url=${encodeURIComponent(imageUrl)}`;

  const [crop, setCrop] = useState<ReactCropType>({
    unit: '%',
    width: 50,
    height: 50,
    x: 25,
    y: 25
  });
  
  const imgRef = useRef<HTMLImageElement>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<boolean>(false);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [croppedImageUrl, setCroppedImageUrl] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [cropPixels, setCropPixels] = useState({
    x: 0,
    y: 0,
    width: 0,
    height: 0
  });
  
  const updateCropPixels = () => {
    if (imgRef.current && crop.width && crop.height) {
      const { naturalWidth, naturalHeight } = imgRef.current;
      setCropPixels({
        x: Math.round((crop.x * naturalWidth) / 100),
        y: Math.round((crop.y * naturalHeight) / 100),
        width: Math.round((crop.width * naturalWidth) / 100),
        height: Math.round((crop.height * naturalHeight) / 100)
      });
    }
  };
  
  useEffect(() => {
    updateCropPixels();
  }, [crop, imageLoaded]);
  
  const handleImageLoad = (e: React.SyntheticEvent<HTMLImageElement, Event>) => {
    const img = e.currentTarget;
    console.log('Proxied Image Loaded:', {
      src: img.src,
      naturalWidth: img.naturalWidth,
      naturalHeight: img.naturalHeight,
      width: img.width,
      height: img.height
    });
    
    setImageLoaded(true);
    setError(null);
    updateCropPixels();
  };
  
  const handleImageError = (e: React.SyntheticEvent<HTMLImageElement, Event>) => {
    console.error('Proxied Image Load Error', {
      src: e.currentTarget.src,
      event: e
    });
    setError('Failed to load image. Please check the image URL and try again.');
    setImageLoaded(false);
  };

  const handleCropPreview = async () => {
    if (!crop.width || !crop.height || !imgRef.current) {
      setError("Please define a crop area");
      return;
    }

    setIsLoading(true);
    setError(null);
    
    try {
      // Create the cropped image
      const croppedImageDataUrl = await getCroppedImg(imgRef.current, crop);
      setCroppedImageUrl(croppedImageDataUrl);
      setShowPreview(true);
    } catch (error) {
      console.error("Error cropping image:", error);
      setError("Failed to create crop preview");
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleCropAndUpload = async () => {
    if (!croppedImageUrl) {
      setError("No cropped image available");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Convert data URL to blob
      const response = await fetch(croppedImageUrl);
      const blob = await response.blob();
      
      // Create FormData
      const formData = new FormData();
      formData.append('file', blob, `cropped-image-${cropPixels.width}x${cropPixels.height}.png`);
      formData.append('originalUrl', imageUrl);
      
      // Upload to Webflow
      const uploadResponse = await fetch('/api/update-webflow-image', {
        method: 'POST',
        body: formData
      });
      
      if (!uploadResponse.ok) {
        const errorData = await uploadResponse.json();
        throw new Error(errorData.message || "Failed to upload image to Webflow");
      }
      
      // Handle successful upload
      onApply({
        width: cropPixels.width,
        height: cropPixels.height
      });
      
      setSuccess(true);
      setShowPreview(false);
    } catch (error) {
      console.error("Error uploading image:", error);
      setError(error instanceof Error ? error.message : "Unknown error occurred");
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleDownload = () => {
    if (!croppedImageUrl) return;
    
    const a = document.createElement('a');
    a.href = croppedImageUrl;
    a.download = `cropped-image-${cropPixels.width}x${cropPixels.height}.jpg`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };
  
  return (
    <div className="space-y-6 p-4">
      <h2 className="text-xl font-semibold mb-4">Crop Settings</h2>
      
      {error && (
        <div className="p-3 bg-red-100 text-red-800 rounded-md text-sm mb-4">
          {error}
        </div>
      )}
      
      <div className="mb-4">
        <ReactCrop
          crop={crop}
          onChange={(c) => setCrop(c)}
          keepSelection
          className="max-h-[70vh] mx-auto"
        >
          <img
            ref={imgRef}
            src={proxyImageUrl}  // Use the proxied URL here
            alt={imageTitle || "Image to crop"}
            className="max-h-[70vh] w-auto mx-auto"
            crossOrigin="anonymous"
            onLoad={handleImageLoad}
            onError={handleImageError}
          />
        </ReactCrop>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-4 p-4 bg-gray-100 rounded-lg">
        <div className="text-sm">X: {cropPixels.x}px</div>
        <div className="text-sm">Y: {cropPixels.y}px</div>
        <div className="text-sm">Width: {cropPixels.width}px</div>
        <div className="text-sm">Height: {cropPixels.height}px</div>
        <div className="col-span-2 text-sm text-gray-500">
          Note: 'X' is the distance from left edge and 'Y' is the distance from top edge.
        </div>
      </div>

      {success && (
        <div className="p-3 bg-green-100 text-green-800 rounded-md text-sm mb-4">
          Image successfully cropped and uploaded to Webflow assets!
        </div>
      )}

      <Button 
        onClick={handleCropPreview}
        className="w-full"
        disabled={!imageLoaded || !crop.width || !crop.height || isLoading}
      >
        {isLoading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Processing...
          </>
        ) : (
          <>
            <Save className="mr-2 h-4 w-4" />
            Preview Crop
          </>
        )}
      </Button>

      {/* Preview Dialog */}
      <Dialog open={showPreview} onOpenChange={setShowPreview}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Cropped Image Preview</DialogTitle>
            <DialogDescription>
              Review your cropped image before uploading it to Webflow
            </DialogDescription>
          </DialogHeader>
          
          <div className="my-4 flex justify-center">
            {croppedImageUrl ? (
              <img 
                src={croppedImageUrl} 
                alt="Cropped preview" 
                className="max-h-[60vh] max-w-full object-contain border rounded-md" 
              />
            ) : (
              <div className="flex justify-center items-center h-64">
                <Loader2 className="h-10 w-10 animate-spin text-blue-500" />
              </div>
            )}
          </div>
          
          <DialogFooter className="flex flex-col sm:flex-row gap-2 justify-between sm:justify-between">
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => setShowPreview(false)}
                disabled={isLoading}
              >
                Back to Crop
              </Button>
              
              <Button
                variant="outline"
                onClick={handleDownload}
                disabled={isLoading || !croppedImageUrl}
              >
                Download
              </Button>
            </div>
            
            <Button
              onClick={handleCropAndUpload}
              disabled={isLoading || !croppedImageUrl}
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Uploading...
                </>
              ) : (
                'Crop & Upload to Webflow'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
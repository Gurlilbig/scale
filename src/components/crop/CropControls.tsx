'use client';

import { useState, useRef, useEffect } from 'react';
import ReactCrop, { type Crop as ReactCropType } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Save, Replace, Copy, Download, Loader2 } from 'lucide-react';

interface CropControlsProps {
  imageUrl: string;
  imageTitle?: string;
  onApply: (dimensions: { width: number; height: number }) => void;
}

export const CropControls: React.FC<CropControlsProps> = ({ 
  imageUrl, 
  imageTitle = 'Image',
  onApply 
}) => {
  const { toast } = useToast();
  const imgRef = useRef<HTMLImageElement>(null);
  const previewCanvasRef = useRef<HTMLCanvasElement>(null);
  
  const [crop, setCrop] = useState<ReactCropType>({
    unit: '%',
    width: 50,
    height: 50,
    x: 25,
    y: 25
  });
  
  const [showSaveOptions, setShowSaveOptions] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [croppedImageUrl, setCroppedImageUrl] = useState<string | null>(null);
  const [imgLoaded, setImgLoaded] = useState(false);
  const [proxyImageUrl, setProxyImageUrl] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState(false);

  // Get proxied image URL to avoid CORS issues
  useEffect(() => {
    if (imageUrl) {
      // Use the proxy endpoint for external images
      const encodedUrl = encodeURIComponent(imageUrl);
      setProxyImageUrl(`/api/proxy-image?url=${encodedUrl}`);
    }
  }, [imageUrl]);

  // Function to get crop dimensions in pixels
  const getCropPixels = () => {
    if (!imgRef.current) return null;
    
    const { naturalWidth, naturalHeight } = imgRef.current;
    return {
      x: Math.round((crop.x * naturalWidth) / 100),
      y: Math.round((crop.y * naturalHeight) / 100),
      width: Math.round((crop.width * naturalWidth) / 100),
      height: Math.round((crop.height * naturalHeight) / 100)
    };
  };

  // Handle keyboard navigation for accessibility
  const handleKeyPress = (e: React.KeyboardEvent<HTMLImageElement>) => {
    const moveAmount = e.shiftKey ? 5 : 1;
    const newCrop = { ...crop };

    switch (e.key) {
      case 'ArrowLeft':
        newCrop.x = Math.max(0, crop.x - moveAmount);
        break;
      case 'ArrowRight':
        newCrop.x = Math.min(100 - crop.width, crop.x + moveAmount);
        break;
      case 'ArrowUp':
        newCrop.y = Math.max(0, crop.y - moveAmount);
        break;
      case 'ArrowDown':
        newCrop.y = Math.min(100 - crop.height, crop.y + moveAmount);
        break;
      default:
        return;
    }

    setCrop(newCrop);
    e.preventDefault();
  };

  // Function to create the cropped image using canvas
  const cropImage = async () => {
    if (!imgRef.current || !crop.width || !crop.height) {
      console.error("Invalid image reference or crop dimensions");
      return null;
    }
  
    const image = imgRef.current;
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
  
    if (!ctx) {
      console.error("Failed to get canvas context");
      return null;
    }
  
    try {
      // Ensure image is loaded before proceeding
      if (image.complete && image.naturalWidth !== 0) {
        console.log("Image is fully loaded");
      } else {
        console.error("Image not loaded properly");
        return null;
      }
      
      // Scale calculations
      const scaleX = image.naturalWidth / image.width;
      const scaleY = image.naturalHeight / image.height;
      const cropX = crop.x * scaleX;
      const cropY = crop.y * scaleY;
      const cropWidth = crop.width * scaleX;
      const cropHeight = crop.height * scaleY;
    
      // Ensure valid crop dimensions
      if (cropWidth <= 0 || cropHeight <= 0) {
        console.error("Invalid crop dimensions");
        return null;
      }
    
      // Set canvas size
      canvas.width = cropWidth;
      canvas.height = cropHeight;
    
      // Draw the cropped image on canvas
      ctx.drawImage(
        image,
        cropX,
        cropY,
        cropWidth,
        cropHeight,
        0,
        0,
        cropWidth,
        cropHeight
      );
      
      // Use dataURL instead of toBlob to avoid cross-origin issues
      const dataUrl = canvas.toDataURL('image/jpeg');
      
      // Create a temporary image element to trigger the download
      const img = new Image();
      img.src = dataUrl;
      
      // Return the data URL
      return dataUrl;
    } catch (error) {
      console.error("Error during cropping:", error);
      return null;
    }
  };

  // Handle finishing the crop operation
  const handleFinishCropping = async () => {
    try {
      const croppedDataUrl = await cropImage();
      if (croppedDataUrl) {
        setCroppedImageUrl(croppedDataUrl);
        setShowPreview(true);
        
        // Get the dimensions for the callback
        const pixels = getCropPixels();
        if (pixels) {
          // Convert data URL to Blob for uploading to Webflow
          const blob = await dataURLtoBlob(croppedDataUrl);
          if (blob) {
            // Use "copy" as the default save type
            await uploadToWebflow(blob, pixels, 'copy');
          }
          
          // Call the onApply callback with dimensions
          onApply({ width: pixels.width, height: pixels.height });
        }
      } else {
        toast({
          title: "Error",
          description: "Failed to crop the image. Please try again.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error in handleFinishCropping:", error);
      toast({
        title: "Error",
        description: "An error occurred while processing. Please try again.",
        variant: "destructive",
      });
    }
  };
  
  // Helper function to convert data URL to Blob
  const dataURLtoBlob = async (dataURL: string): Promise<Blob | null> => {
    try {
      const arr = dataURL.split(',');
      const mime = arr[0].match(/:(.*?);/)?.[1] || 'image/jpeg';
      const bstr = atob(arr[1]);
      let n = bstr.length;
      const u8arr = new Uint8Array(n);
      
      while (n--) {
        u8arr[n] = bstr.charCodeAt(n);
      }
      
      return new Blob([u8arr], { type: mime });
    } catch (error) {
      console.error("Error converting dataURL to Blob:", error);
      return null;
    }
  };
  
  // Function to upload the cropped image to Webflow
  const uploadToWebflow = async (blob: Blob, dimensions: { width: number; height: number }, saveType: 'replace' | 'copy') => {
    try {
      setIsUploading(true);
      setUploadSuccess(false);
      
      toast({
        title: "Uploading",
        description: "Uploading cropped image to Webflow...",
      });
      
      // Create FormData to send to server
      const formData = new FormData();
      const filename = `cropped-${imageTitle || 'image'}-${dimensions.width}x${dimensions.height}.jpg`;
      formData.append('file', blob, filename);
      formData.append('originalUrl', imageUrl);
      
      // Add save type (replace or copy)
      formData.append('saveType', saveType);
      
      // Send to your API endpoint
      const response = await fetch('/api/update-webflow-image', {
        method: 'POST',
        body: formData,
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to upload image to Webflow');
      }
      
      const result = await response.json();
      console.log('Webflow upload result:', result);
      
      setUploadSuccess(true);
      
      toast({
        title: "Success",
        description: `Image ${saveType === 'replace' ? 'replaced' : 'saved as copy'} and uploaded to Webflow assets successfully.`,
      });
      
      return result;
    } catch (error) {
      console.error('Error uploading to Webflow:', error);
      toast({
        title: "Upload Failed",
        description: error instanceof Error ? error.message : "Failed to upload to Webflow",
        variant: "destructive",
      });
      throw error;
    } finally {
      setIsUploading(false);
    }
  };

  // Handle download
  const handleDownload = async () => {
    if (!croppedImageUrl) {
      // If we don't have a cached cropped image, create one
      const dataUrl = await cropImage();
      if (!dataUrl) {
        toast({
          title: "Error",
          description: "Could not generate cropped image.",
          variant: "destructive",
        });
        return;
      }
      
      // Create a temporary link and trigger download
      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = `cropped-${imageTitle || 'image'}.jpg`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } else {
      // Use the cached cropped image
      const a = document.createElement("a");
      a.href = croppedImageUrl;
      a.download = `cropped-${imageTitle || 'image'}.jpg`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
  };

  // Handle image load completion
  const handleImageLoad = () => {
    setImgLoaded(true);
    console.log("Image is fully loaded");
  };

  // Handle image load error
  const handleImageError = (e: React.SyntheticEvent<HTMLImageElement, Event>) => {
    console.error("Error loading image:", e);
    toast({
      title: "Image Load Error",
      description: "Failed to load the image. Please try again with a different image.",
      variant: "destructive",
    });
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Crop Image</CardTitle>
          <CardDescription>
            Drag the corners or edges to adjust the crop area.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-4">
            <ReactCrop
              crop={crop}
              onChange={(c) => setCrop(c)}
              className="max-h-[70vh] mx-auto"
              keepSelection
            >
              <img
                ref={imgRef}
                src={proxyImageUrl || imageUrl}
                alt={`Image to crop: ${imageTitle}`}
                onKeyDown={handleKeyPress}
                onLoad={handleImageLoad}
                onError={handleImageError}
                tabIndex={0}
                className="max-h-[70vh] w-auto mx-auto focus:outline-none"
                crossOrigin="anonymous" // Important for CORS
              />
            </ReactCrop>
          </div>

          {imgLoaded && (
            <>
              <div className="grid grid-cols-2 gap-4 mb-4 p-4 bg-gray-100 rounded-lg">
                <div className="text-sm">X: {getCropPixels()?.x || 0}px</div>
                <div className="text-sm">Y: {getCropPixels()?.y || 0}px</div>
                <div className="text-sm">Width: {getCropPixels()?.width || 0}px</div>
                <div className="text-sm">Height: {getCropPixels()?.height || 0}px</div>
                <div className="col-span-2 text-sm text-gray-500">
                  Note: 'X' is the distance from left edge and 'Y' is the distance from top edge.
                </div>
              </div>

              <Button
                onClick={handleFinishCropping}
                className="w-full bg-blue-500 hover:bg-blue-600"
                disabled={isUploading}
              >
                {isUploading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <Save className="mr-2 h-4 w-4" />
                    Finish Cropping
                  </>
                )}
              </Button>
            </>
          )}
        </CardContent>
      </Card>

      {/* Preview Dialog */}
      <Dialog open={showPreview} onOpenChange={setShowPreview}>
        <DialogContent className="max-w-3xl font-iosevka">
          <DialogHeader>
            <DialogTitle>Cropped Image Preview</DialogTitle>
          </DialogHeader>
          
          {uploadSuccess && (
            <div className="p-3 bg-green-100 text-green-800 rounded-md text-sm mt-2">
              Image successfully cropped and uploaded to Webflow assets!
            </div>
          )}
          
          {/* <div className="mt-4 flex gap-2">
            <Button onClick={handleDownload} className="bg-green-500 hover:bg-green-600">
              <Download className="mr-2 h-4 w-4" />
              Download Cropped Image
            </Button>
          </div> */}
          
          <div className="mt-4">
            {croppedImageUrl ? (
              <img 
                src={croppedImageUrl} 
                alt="Cropped preview" 
                className="max-h-[60vh] w-auto mx-auto"
              />
            ) : (
              <p className="text-center text-gray-500">Cropped Image</p>
            )}
          </div>
          
          <div className="flex justify-end mt-4">
            <Button
              onClick={() => {
                setShowPreview(false);
              }}
              disabled={isUploading}
            >
              {isUploading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processing...
                </>
              ) : 'Done'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};
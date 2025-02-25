'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
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
import { Save, Replace, Copy, Home, Crop } from 'lucide-react';

export default function CropEditor() {
  const router = useRouter();
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
  
    // Convert to Blob and return
    return new Promise<Blob | null>((resolve) => {
      canvas.toBlob((blob) => {
        if (!blob) {
          console.error("Failed to create Blob from canvas");
        }
        resolve(blob);
      }, 'image/jpeg');
    });
  };  

  const handleSaveOption = async (saveType: 'replace' | 'copy') => {
    const croppedBlob = await cropImage();
    if (croppedBlob) {
      const croppedImageUrl = URL.createObjectURL(croppedBlob);
      setCroppedImageUrl(croppedImageUrl);
      setShowSaveOptions(false);
      setShowPreview(true);
      toast({
        title: "Success",
        description: `Image ${saveType === 'replace' ? 'replaced' : 'saved as copy'} successfully.`,
      });
    } else {
      toast({
        title: "Error",
        description: "Failed to crop the image. Please try again.",
        variant: "destructive",
      });
    }
  };  

  const handleDownload = async () => {
    const croppedBlob = await cropImage();
    if (!croppedBlob) {
      toast({
        title: "Error",
        description: "Could not generate cropped image.",
        variant: "destructive",
      });
      return;
    }
  
    const url = URL.createObjectURL(croppedBlob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "cropped-image.jpg";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };  

  return (
    <div className="min-h-screen font-iosevka">
      <header className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between relative">
            <div className="flex items-center">
              <Crop className="h-6 w-6 text-blue-500" />
              <span className="ml-2 text-xl font-semibold text-black">Cropping</span>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => router.push('/')}
              className="hover:bg-gray-100"
            >
              <Home className="h-10 w-10" />
            </Button>
          </div>
        </div>
      </header>
      <div className="max-w-6xl mx-auto px-14 mt-8">
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
                  src="/images/ktm-car.jpg"
                  alt="Image to crop"
                  onKeyDown={handleKeyPress}
                  tabIndex={0}
                  className="max-h-[70vh] w-auto mx-auto focus:outline-none"
                />
              </ReactCrop>
            </div>

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
              onClick={() => setShowSaveOptions(true)}
              className="w-full bg-blue-500 hover:bg-blue-600"
            >
              <Save className="mr-2 h-4 w-4" />
              Finish Cropping
            </Button>
          </CardContent>
        </Card>

        {/* Save Options Dialog */}
        <Dialog open={showSaveOptions} onOpenChange={setShowSaveOptions}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Save Options</DialogTitle>
              <DialogDescription className='font-iosevka'>
                Choose how you want to save the cropped image
              </DialogDescription>
            </DialogHeader>
            <div className="grid grid-cols-2 gap-4 mt-4 font-iosevka">
              <Button
                onClick={() => handleSaveOption('replace')}
                className="flex items-center justify-center bg-blue-500 hover:bg-blue-600"
              >
                <Replace className="mr-2 h-4 w-4" />
                Replace Original
              </Button>
              <Button
                onClick={() => handleSaveOption('copy')}
                variant="outline"
                className="flex items-center justify-center"
              >
                <Copy className="mr-2 h-4 w-4" />
                Save as Copy
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Preview Dialog */}
        <Dialog open={showPreview} onOpenChange={setShowPreview}>
          <DialogContent className="max-w-3xl font-iosevka">
            <DialogHeader>
              <DialogTitle>Cropped Image Preview</DialogTitle>
            </DialogHeader>
            <Button onClick={handleDownload} className="mt-4 bg-green-500 hover:bg-green-600">
              Download Cropped Image
            </Button>
            <div className="mt-4">
              {croppedImageUrl ? (
                <img 
                  src={croppedImageUrl} 
                  alt="Cropped preview" 
                  className="max-h-[60vh] w-auto mx-auto"
                />
              ) : (
                <p className="text-center text-gray-500"> Cropped Image </p>
              )}
            </div>
            <div className="flex justify-end mt-4">
              <Button
                onClick={() => {
                  setShowPreview(false);
                  router.back();
                }}
              >
                Done
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
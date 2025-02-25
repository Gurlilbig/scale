import { useState, useEffect } from 'react';
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

interface ResizeControlsProps {
  onApply: (dimensions: { width: number; height: number }) => void;
  imageUrl: string;
}

export const ResizeControls = ({ 
  onApply, 
  imageUrl 
}: ResizeControlsProps) => {
  const [maintainAspectRatio, setMaintainAspectRatio] = useState(true);
  const [width, setWidth] = useState('');
  const [height, setHeight] = useState('');
  const [originalDimensions, setOriginalDimensions] = useState<{ width: number; height: number } | null>(null);
  const [aspectRatio, setAspectRatio] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<boolean>(false);

  useEffect(() => {
    // Load original image dimensions
    const img = new Image();
    img.onload = () => {
      setOriginalDimensions({
        width: img.naturalWidth,
        height: img.naturalHeight
      });
      setAspectRatio(img.naturalWidth / img.naturalHeight);
      // Pre-fill the inputs with original dimensions
      setWidth(img.naturalWidth.toString());
      setHeight(img.naturalHeight.toString());
    };
    img.src = imageUrl;
  }, [imageUrl]);

  const handleWidthChange = (newWidth: string) => {
    if (newWidth === '') {
      setWidth('');
      if (maintainAspectRatio) {
        setHeight('');
      }
      return;
    }

    const parsedWidth = parseInt(newWidth);
    if (parsedWidth < 0) {
      setWidth('0');
      if (maintainAspectRatio) {
        setHeight('0');
      }
    } else {
      setWidth(newWidth);
      if (maintainAspectRatio && newWidth && aspectRatio) {
        setHeight(Math.round(parsedWidth / aspectRatio).toString());
      }
    }
  };

  const handleHeightChange = (newHeight: string) => {
    if (newHeight === '') {
      setHeight('');
      if (maintainAspectRatio) {
        setWidth('');
      }
      return;
    }

    const parsedHeight = parseInt(newHeight);
    if (parsedHeight < 0) {
      setHeight('0');
      if (maintainAspectRatio) {
        setWidth('0');
      }
    } else {
      setHeight(newHeight);
      if (maintainAspectRatio && newHeight && aspectRatio) {
        setWidth(Math.round(parsedHeight * aspectRatio).toString());
      }
    }
  };

  const resizeAndUploadToWebflow = async () => {
    if (!width || !height) {
      setError("Please specify dimensions");
      return;
    }

    setIsLoading(true);
    setError(null);
    setSuccess(false);

    try {
      // Create resized image
      const img = new Image();
      img.crossOrigin = "anonymous";
      
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
        img.src = imageUrl;
      });
      
      const canvas = document.createElement('canvas');
      canvas.width = parseInt(width);
      canvas.height = parseInt(height);
      
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        throw new Error("Could not get canvas context");
      }
      
      ctx.drawImage(img, 0, 0, parseInt(width), parseInt(height));
      
      // Convert to blob
      const blob = await new Promise<Blob | null>((resolve) => {
        canvas.toBlob((b) => resolve(b), 'image/png');
      });
      
      if (!blob) {
        throw new Error("Failed to create image blob");
      }
      
      // Create FormData to send to server
      const formData = new FormData();
      formData.append('file', blob, `resized-image-${width}x${height}.png`);
      
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
      
      // Notify parent component of successful resize
      onApply({
        width: parseInt(width),
        height: parseInt(height)
      });
      
      setSuccess(true);
    } catch (error) {
      console.error('Error uploading image to Webflow:', error);
      setError(error instanceof Error ? error.message : 'An unknown error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6 p-4">
      <h2 className="text-xl font-semibold mb-4">Resize Settings</h2>
      
      {originalDimensions && (
        <div className="text-sm text-gray-500 mb-4">
          Original dimensions: {originalDimensions.width}x{originalDimensions.height}
        </div>
      )}
      
      <div className="space-y-4">
        <div className="flex items-center space-x-2">
          <Switch
            id="aspect-ratio"
            checked={maintainAspectRatio}
            onCheckedChange={setMaintainAspectRatio}
          />
          <label htmlFor="aspect-ratio">Maintain aspect ratio</label>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <label htmlFor="width" className="text-sm font-medium">
              Width
            </label>
            <Input
              id="width"
              type="number"
              value={width}
              onChange={(e) => handleWidthChange(e.target.value)}
              placeholder="Enter width"
              min="0"
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="height" className="text-sm font-medium">
              Height
            </label>
            <Input
              id="height"
              type="number"
              value={height}
              onChange={(e) => handleHeightChange(e.target.value)}
              placeholder="Enter height"
              min="0"
            />
          </div>
        </div>

        <p className="text-sm text-muted-foreground mt-2">
          Tip: Use the up ↑ and down ↓ arrow keys to incrementally adjust the values, or type directly into the input fields.
        </p>

        {error && (
          <div className="p-3 bg-red-100 text-red-800 rounded-md text-sm">
            {error}
          </div>
        )}

        {success && (
          <div className="p-3 bg-green-100 text-green-800 rounded-md text-sm">
            Image successfully resized and uploaded to Webflow assets!
          </div>
        )}

        <Button 
          onClick={resizeAndUploadToWebflow}
          className="w-full"
          disabled={!width || !height || isLoading}
        >
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Uploading...
            </>
          ) : (
            'Resize & Upload to Webflow'
          )}
        </Button>
      </div>
    </div>
  );
};
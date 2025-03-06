'use client';

import React from 'react';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { AssetsBrowser } from '@/components/resize/AssetsBrowser';
import { CropControls } from '@/components/crop/CropControls';
import { useToast } from "@/components/hooks/use-toast";
import { Home, ArrowLeft, Crop } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { WebflowAsset } from '@/app/types/webflow';
import { setExtensionSize, isWebflowEnvironment } from '@/lib/webflow-extension';

// Helper function to extract filename from URL
const getFilenameFromUrl = (url: string | undefined): string => {
  if (!url) return 'Unknown Image';
  
  // Extract the filename from the URL
  const urlParts = url.split('/');
  let filename = urlParts[urlParts.length - 1];
  
  // Remove any query parameters
  filename = filename.split('?')[0];
  
  // URL decode the filename
  try {
    filename = decodeURIComponent(filename);
  } catch (e) {
    // If decoding fails, use the encoded version
  }
  
  return filename;
};

export default function CropSpecificImagesPage() {
  const router = useRouter();
  const [selectedAsset, setSelectedAsset] = useState<WebflowAsset | null>(null);
  const [isCropping, setIsCropping] = useState(false);
  const { toast } = useToast();
  const [assetDisplayName, setAssetDisplayName] = useState<string>('');
  const [cropCallbackId] = useState(`crop-callback-${Date.now()}`);

  // Set extension size based on current view
  useEffect(() => {
    const updateSize = async () => {
      if (!isWebflowEnvironment()) return;
      
      try {
        // Use large size for cropping, comfortable size for browsing
        if (isCropping) {
          await setExtensionSize('large');
          console.log('Set extension size to large for cropping');
        } else {
          await setExtensionSize('comfortable');
          console.log('Set extension size to comfortable for browsing');
        }
      } catch (error) {
        console.error('Failed to set extension size:', error);
      }
    };
    
    updateSize();
  }, [isCropping]);

  useEffect(() => {
    if (selectedAsset) {
      // Use name if available, otherwise extract from URL
      const displayName = selectedAsset.name || getFilenameFromUrl(selectedAsset.url);
      setAssetDisplayName(displayName);
    } else {
      setAssetDisplayName('');
    }
  }, [selectedAsset]);

  // Set up event listener for the crop result
  useEffect(() => {
    const handleCropApplied = (event: CustomEvent) => {
      if (event.detail?.callbackId === cropCallbackId) {
        // This is our event
        const { width, height } = event.detail.dimensions;
        
        // Show success toast
        toast({
          title: "Success",
          description: `Image cropped to ${width}x${height} and uploaded to Webflow assets.`,
        });
      }
    };
    
    // Add event listener
    window.addEventListener('cropApplied', handleCropApplied as EventListener);
    
    // Check localStorage as a fallback (in case we missed the event)
    const checkLocalStorage = () => {
      const storedDataStr = localStorage.getItem('cropDimensions');
      if (storedDataStr) {
        try {
          const storedData = JSON.parse(storedDataStr);
          // Only use if it's recent (last 10 seconds)
          const isRecent = Date.now() - storedData.timestamp < 10000;
          
          if (isRecent) {
            toast({
              title: "Success",
              description: `Image cropped to ${storedData.width}x${storedData.height} and uploaded to Webflow assets.`,
            });
            // Clear after using
            localStorage.removeItem('cropDimensions');
          }
        } catch (e) {
          console.error("Error parsing localStorage data:", e);
        }
      }
    };
    
    // Check localStorage on component mount (with a small delay)
    const timeoutId = setTimeout(checkLocalStorage, 1000);
    
    // Cleanup
    return () => {
      window.removeEventListener('cropApplied', handleCropApplied as EventListener);
      clearTimeout(timeoutId);
    };
  }, [cropCallbackId, toast]);

  // In your page.tsx
  const handleAssetSelect = (asset: WebflowAsset) => {
    console.log('Selected Asset:', {
      url: asset.url,
      name: asset.name,
      width: asset.width,
      height: asset.height
    });
    setSelectedAsset(asset);
  };

  const handleBackToAssets = () => {
    setIsCropping(false);
  };

  return (
    <div className="min-h-screen flex flex-col font-iosevka mx-auto">
      {/* Header */}
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

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 w-full">
        <div className="flex items-center mb-6">
          {isCropping && (
            <Button 
              variant="outline"
              size="sm"
              onClick={handleBackToAssets}
              className="mr-3"
            >
              <ArrowLeft className="h-4 w-4 mr-1" />
              Back to Assets
            </Button>
          )}
          <h1 className="text-2xl font-bold font-iosevka">
            {isCropping && selectedAsset
              ? `Crop: ${assetDisplayName || 'Image'}`
              : 'Browse Webflow Assets'
            }
          </h1>
        </div>
        
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          {isCropping && selectedAsset ? (
            <CropControls 
              onApplyId={cropCallbackId}
              imageUrl={selectedAsset.url} 
              imageTitle={assetDisplayName}
            />
          ) : (
            <div className="p-6">
              <AssetsBrowser 
                onAssetSelect={handleAssetSelect}
                selectedAsset={selectedAsset}
              />
              
              {selectedAsset && (
                <div className="mt-6 flex items-center justify-between border-t pt-4">
                  <div>
                    <h3 className="font-medium">{assetDisplayName}</h3>
                    <p className="text-sm text-gray-500">
                      {selectedAsset.width && selectedAsset.height 
                        ? `${selectedAsset.width} × ${selectedAsset.height} px` 
                        : "Loading dimensions..."}
                      {selectedAsset.fileSize && ` • ${Math.round(selectedAsset.fileSize / 1024)} KB`}
                    </p>
                  </div>
                  <Button 
                    onClick={() => setIsCropping(true)}
                    className="bg-black hover:bg-gray-800"
                  >
                    Start Cropping
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
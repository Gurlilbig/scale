'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { AssetsBrowser } from '@/components/resize/AssetsBrowser';
import { CropControls } from '@/components/crop/CropControls';
import { useToast } from "@/components/hooks/use-toast";
import { Home, Layout, ArrowLeft, Crop } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { WebflowAsset } from '@/app/types/webflow'; // Import shared type

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

  useEffect(() => {
    if (selectedAsset) {
      // Use name if available, otherwise extract from URL
      const displayName = selectedAsset.name || getFilenameFromUrl(selectedAsset.url);
      setAssetDisplayName(displayName);
    } else {
      setAssetDisplayName('');
    }
  }, [selectedAsset]);

  const handleCrop = (dimensions: { width: number; height: number }) => {
    toast({
      title: "Success",
      description: `Image cropped to ${dimensions.width}x${dimensions.height} and uploaded to Webflow assets.`,
    });
  };

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
              onApply={handleCrop} 
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
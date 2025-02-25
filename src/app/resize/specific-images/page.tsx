'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { AssetsBrowser } from '@/components/resize/AssetsBrowser';
import { ResizeControls } from '@/components/resize/ResizeControls';
import { useToast } from "@/components/hooks/use-toast";
import { Home, Layout, ArrowLeft } from 'lucide-react';
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

export default function DirectAssetsPage() {
  const router = useRouter();
  const [selectedAsset, setSelectedAsset] = useState<WebflowAsset | null>(null);
  const [isResizing, setIsResizing] = useState(false);
  const { toast } = useToast();
  const [assetDisplayName, setAssetDisplayName] = useState<string>('');

  useEffect(() => {
    // If an asset is selected but dimensions are unknown, try to determine them
    if (selectedAsset && (!selectedAsset.width || !selectedAsset.height)) {
      // Create a proxied URL to avoid CORS issues
      const encodedUrl = encodeURIComponent(selectedAsset.url);
      const proxiedUrl = `/api/proxy-image?url=${encodedUrl}`;
      
      // Load the image to get its dimensions
      const img = new Image();
      img.onload = () => {
        // Update the selected asset with the detected dimensions
        setSelectedAsset({
          ...selectedAsset,
          width: img.naturalWidth,
          height: img.naturalHeight
        });
      };
      img.src = proxiedUrl;
    }
  }, [selectedAsset]);

  useEffect(() => {
    if (selectedAsset) {
      // Use name if available, otherwise extract from URL
      const displayName = selectedAsset.name || getFilenameFromUrl(selectedAsset.url);
      setAssetDisplayName(displayName);
    } else {
      setAssetDisplayName('');
    }
  }, [selectedAsset]);

  const handleResize = (dimensions: { width: number; height: number }) => {
    toast({
      title: "Success",
      description: `Image resized to ${dimensions.width}x${dimensions.height} and uploaded to Webflow assets.`,
    });
  };

  const handleAssetSelect = (asset: WebflowAsset) => {
    setSelectedAsset(asset);
    // Don't automatically go to resize mode, let the user confirm with the button
  };

  const handleBackToAssets = () => {
    setIsResizing(false);
  };

  return (
    <div className="min-h-screen flex flex-col font-iosevka mx-auto">
      {/* Header */}
      <header className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between relative">
            <div className="flex items-center">
              <Layout className="h-6 w-6 text-blue-500" />
              <span className="ml-2 text-xl font-semibold text-black">Resizing</span>
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
          {isResizing && (
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
            {isResizing
              ? "Resize: " + (assetDisplayName || 'Image')
              : 'Browse Webflow Assets'
            }
          </h1>
        </div>
        
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          {isResizing && selectedAsset ? (
            <ResizeControls 
              onApply={handleResize} 
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
                    onClick={() => setIsResizing(true)}
                  >
                    Resize This Image
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
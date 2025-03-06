// components/resize/AssetsBrowser.tsx
import { useState, useEffect } from 'react';
import { Loader2, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { WebflowAsset } from '@/app/types/webflow'; // Import shared type
import React from 'react';

interface AssetsBrowserProps {
  onAssetSelect: (asset: WebflowAsset) => void;
  selectedAsset: WebflowAsset | null;
}

// Helper function to get proxied image URL
const getProxiedImageUrl = (originalUrl: string | undefined): string => {
  if (!originalUrl) return '/placeholder-image.svg';
  
  // URL encode the original URL
  const encodedUrl = encodeURIComponent(originalUrl);
  return `/api/proxy-image?url=${encodedUrl}`;
};

// Helper function to extract filename from URL
const getFilenameFromUrl = (url: string | undefined): string => {
  if (!url) return 'Unnamed asset';
  
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

export const AssetsBrowser: React.FC<AssetsBrowserProps> = ({ 
  onAssetSelect, 
  selectedAsset 
}) => {
  const [assets, setAssets] = useState<WebflowAsset[]>([]);
  const [filteredAssets, setFilteredAssets] = useState<WebflowAsset[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filter, setFilter] = useState<'all' | 'images'>('images');
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(12);
  const [totalPages, setTotalPages] = useState(1);

  // Function to preload image dimensions
  const preloadImageDimensions = async (asset: WebflowAsset): Promise<WebflowAsset> => {
    return new Promise((resolve) => {
      // If dimensions already exist, return immediately
      if (asset.width && asset.height) {
        resolve(asset);
        return;
      }
      
      // Create a proxied URL to avoid CORS issues
      const encodedUrl = encodeURIComponent(asset.url);
      const proxiedUrl = `/api/proxy-image?url=${encodedUrl}`;
      
      // Load the image to get its dimensions
      const img = new Image();
      img.onload = () => {
        // Return the asset with added dimensions
        resolve({
          ...asset,
          width: img.naturalWidth,
          height: img.naturalHeight
        });
      };
      img.onerror = () => {
        // If loading fails, just return the original asset
        resolve(asset);
      };
      img.src = proxiedUrl;
    });
  };

  // Handle asset selection with dimension loading
  const handleAssetSelect = async (asset: WebflowAsset) => {
    // Only if the asset doesn't have dimensions, try to get them
    if (!asset.width || !asset.height) {
      try {
        const assetWithDimensions = await preloadImageDimensions(asset);
        onAssetSelect(assetWithDimensions);
      } catch (error) {
        console.error('Failed to load dimensions:', error);
        onAssetSelect(asset);
      }
    } else {
      onAssetSelect(asset);
    }
  };

  useEffect(() => {
    const fetchAssets = async () => {
      setIsLoading(true);
      setError(null);
      
      try {
        const response = await fetch('/api/webflow-assets');
        
        if (!response.ok) {
          throw new Error(`Failed to fetch assets: ${response.statusText}`);
        }
        
        const data = await response.json();
        setAssets(data.assets || []);
      } catch (error) {
        console.error('Error fetching Webflow assets:', error);
        setError('Failed to load assets. Please try again later.');
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchAssets();
  }, []);
  
  // Filter and search assets whenever assets, filter or searchTerm change
  useEffect(() => {
    if (!assets || assets.length === 0) {
      setFilteredAssets([]);
      setTotalPages(1);
      return;
    }
    
    let result = [...assets];
    
    // Apply file type filter
    if (filter === 'images') {
      result = result.filter(asset => {
        // Safely check fileType
        const fileType = asset.fileType || '';
        const url = asset.url || '';
        
        return fileType.startsWith('image/') || 
               url.match(/\.(jpg|jpeg|png|gif|svg|webp)$/i);
      });
    }
    
    // Apply search term
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter(asset => {
        // Use name if available, otherwise use filename from URL
        const name = asset.name || getFilenameFromUrl(asset.url);
        return name.toLowerCase().includes(term);
      });
    }
    
    // Sort by most recent first
    result.sort((a, b) => {
      const dateA = new Date(a.createdOn || 0).getTime();
      const dateB = new Date(b.createdOn || 0).getTime();
      return dateB - dateA;
    });
    
    setFilteredAssets(result);
    
    // Update total pages
    setTotalPages(Math.max(1, Math.ceil(result.length / itemsPerPage)));
    
    // Reset to first page when filters change
    setCurrentPage(1);
  }, [assets, filter, searchTerm, itemsPerPage]);

  // Calculate current page items
  const currentItems = filteredAssets.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const handleNextPage = () => {
    setCurrentPage(prev => Math.min(prev + 1, totalPages));
  };

  const handlePrevPage = () => {
    setCurrentPage(prev => Math.max(prev - 1, 1));
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="h-10 w-10 animate-spin text-blue-500" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center p-6 bg-red-50 text-red-700 rounded-md">
        <p>{error}</p>
        <Button 
          onClick={() => window.location.reload()} 
          variant="outline" 
          className="mt-4"
        >
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <div className="flex-1">
          <Input
            placeholder="Search assets..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full"
          />
        </div>
        <div className="flex gap-2">
          <Button
            variant={filter === 'all' ? "default" : "outline"}
            onClick={() => setFilter('all')}
            size="sm"
          >
            All Files
          </Button>
          <Button
            variant={filter === 'images' ? "default" : "outline"}
            onClick={() => setFilter('images')}
            size="sm"
          >
            Images
          </Button>
        </div>
      </div>
      
      {filteredAssets.length === 0 ? (
        <div className="text-center py-10 text-gray-500">
          {searchTerm ? 'No assets match your search.' : 'No assets found.'}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {currentItems.map((asset) => (
              <div 
                key={asset.id}
                className={`
                  border rounded-md overflow-hidden cursor-pointer transition-all
                  hover:shadow-md hover:border-blue-400
                  ${selectedAsset?.id === asset.id ? 'ring-2 ring-blue-500 border-blue-500' : ''}
                `}
                onClick={() => handleAssetSelect(asset)}
              >
                <div className="aspect-square bg-gray-100 flex items-center justify-center overflow-hidden">
                  {(asset.fileType && asset.fileType.startsWith('image/')) || 
                   (asset.url && asset.url.match(/\.(jpg|jpeg|png|gif|svg|webp)$/i)) ? (
                    <img 
                      src={getProxiedImageUrl(asset.url)} 
                      alt={asset.name || getFilenameFromUrl(asset.url)} 
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = '/placeholder-image.svg';
                      }}
                    />
                  ) : (
                    <div className="text-gray-400 text-xs text-center p-4">
                      {asset.fileType || 'Unknown file type'}
                    </div>
                  )}
                </div>
                <div className="p-2">
                  <div className="text-xs truncate" title={asset.name || getFilenameFromUrl(asset.url)}>
                    {asset.name || getFilenameFromUrl(asset.url)}
                  </div>
                  <div className="text-xs text-gray-500">
                    {asset.createdOn 
                      ? new Date(asset.createdOn).toLocaleDateString() 
                      : 'Unknown date'}
                  </div>
                </div>
              </div>
            ))}
          </div>
          
          {/* Pagination Controls */}
          <div className="flex items-center justify-between border-t pt-4 mt-6">
            <div className="text-sm text-gray-500">
              Showing {Math.min(filteredAssets.length, (currentPage - 1) * itemsPerPage + 1)} - {Math.min(filteredAssets.length, currentPage * itemsPerPage)} of {filteredAssets.length} assets
            </div>
            <div className="flex items-center space-x-2">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handlePrevPage} 
                disabled={currentPage === 1}
              >
                <ChevronLeft className="h-4 w-4" />
                <span className="sr-only">Previous Page</span>
              </Button>
              <div className="text-sm font-medium">
                Page {currentPage} of {totalPages}
              </div>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleNextPage} 
                disabled={currentPage === totalPages}
              >
                <ChevronRight className="h-4 w-4" />
                <span className="sr-only">Next Page</span>
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { CollectionSelector, type Collection } from '@/components/resize/CollectionSelector';
import { ResizeControls } from '@/components/resize/ResizeControls';
import { useToast } from "@/components/hooks/use-toast";
import { Home, Layout } from 'lucide-react';
import { Button } from "@/components/ui/button";

export default function SpecificImagesPage() {
  const router = useRouter();
  const [selectedCollection, setSelectedCollection] = useState<Collection | null>(null);
  const { toast } = useToast();

  // Automatically select all items and their images when a collection is selected
  const handleCollectionSelect = (collection: Collection | null) => {
    setSelectedCollection(collection);

    if (collection) {
      // Flatten all images from all items in the selected collection
      const allImages = collection.items.flatMap(item => item.images);

      // Log or process the selected images
      console.log('Selected Images:', allImages);

      // Optionally, you can pass these images to a resize function or state
      // For example:
      // handleResizeAllImages(allImages);
    }
  };

  const handleResize = (dimensions: { width: number; height: number }) => {
    toast({
      title: "Success",
      description: `All images resized to ${dimensions.width}x${dimensions.height}.`,
    });
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

      <h1 className="text-2xl font-bold mb-6 font-iosevka px-14 mt-8">Resize Whole Collections</h1>
      
      <div className="grid gap-6 font-iosevka px-10">
        {/* Collection Selector */}
        <CollectionSelector
          selectedCollection={selectedCollection}
          onCollectionSelect={handleCollectionSelect}
        />

        {/* Resize Controls */}
        {selectedCollection && (
          <ResizeControls onApply={handleResize} />
        )}
      </div>
    </div>
  );
}
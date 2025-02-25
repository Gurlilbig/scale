'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { CollectionSelector, type Collection } from '@/components/resize/CollectionSelector';
import { ItemSelector } from '@/components/resize/ItemSelector';
import { ImageSelector } from '@/components/resize/ImageSelector';
import { ResizeControls } from '@/components/resize/ResizeControls';
import { useToast } from "@/components/hooks/use-toast";
import { Home, Layout } from 'lucide-react';
import { Button } from "@/components/ui/button";

export default function SpecificImagesPage() {
  const router = useRouter();
  const [selectedCollection, setSelectedCollection] = useState<Collection | null>(null);
  const [selectedItem, setSelectedItem] = useState<Collection['items'][0] | null>(null);
  const [selectedImage, setSelectedImage] = useState<Collection['items'][0]['images'][0] | null>(null);
  const { toast } = useToast();

  const handleResize = (dimensions: { width: number; height: number }) => {
    toast({
      title: "Success",
      description: `Image resized to ${dimensions.width}x${dimensions.height} and uploaded to Webflow assets.`,
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

      <h1 className="text-2xl font-bold mb-6 font-iosevka px-14 mt-8">Resize Specific Images</h1>
      
      <div className="grid gap-6 font-iosevka px-10">
        <CollectionSelector
          selectedCollection={selectedCollection}
          onCollectionSelect={(collection) => {
            setSelectedCollection(collection);
            setSelectedItem(null);
            setSelectedImage(null);
          }}
        />

        {selectedCollection && (
          <ItemSelector
            collection={selectedCollection}
            selectedItem={selectedItem}
            onItemSelect={(item) => {
              setSelectedItem(item);
              setSelectedImage(null);
            }}
          />
        )}

        {selectedItem && (
          <ImageSelector
            item={selectedItem}
            selectedImage={selectedImage}
            onImageSelect={setSelectedImage}
          />
        )}

        {selectedImage && (
          <div className="bg-white rounded-lg shadow-md overflow-hidden">
            <ResizeControls 
              onApply={handleResize} 
              imageUrl={selectedImage.url} 
            />
          </div>
        )}
      </div>
    </div>
  );
}
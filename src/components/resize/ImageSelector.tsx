import { useState, useEffect } from 'react';
import { Checkbox } from "@/components/ui/checkbox";
import type { Collection } from './CollectionSelector';
import React from 'react';

interface ImageDimensions {
  width: number;
  height: number;
}

export const ImageSelector = ({
  item,
  selectedImage,
  onImageSelect,
}: {
  item: Collection['items'][0];
  selectedImage: Collection['items'][0]['images'][0] | null;
  onImageSelect: (image: Collection['items'][0]['images'][0] | null) => void;
}) => {
  const [imageDimensions, setImageDimensions] = useState<Record<string, ImageDimensions>>({});

  useEffect(() => {
    // Load dimensions for all images in the item
    item.images.forEach((image) => {
      const img = new Image();
      img.onload = () => {
        setImageDimensions(prev => ({
          ...prev,
          [image.id]: {
            width: img.naturalWidth,
            height: img.naturalHeight
          }
        }));
      };
      img.src = image.url;
    });
  }, [item.images]);

  return (
    <div className="space-y-4 p-4">
      <h2 className="text-xl font-semibold mb-4">Select Image Field from {item.name}</h2>
      {item.images.length > 0 ? (
        <div className="space-y-2">
          {item.images.map((image) => (
            <div key={image.id} className="flex items-center space-x-2">
              <Checkbox
                id={image.id}
                checked={selectedImage?.id === image.id}
                onCheckedChange={(checked) => {
                  onImageSelect(checked ? image : null);
                }}
              />
              <div className="flex flex-col">
                <label
                  htmlFor={image.id}
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                >
                  {image.name}
                </label>
                {imageDimensions[image.id] && (
                  <span className="text-xs text-gray-500 mt-1">
                    Current dimensions: {imageDimensions[image.id].width}x{imageDimensions[image.id].height}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="p-4 border border-gray-200 rounded-md bg-gray-50 text-gray-500">
          No image fields found in this item
        </div>
      )}
    </div>
  );
};
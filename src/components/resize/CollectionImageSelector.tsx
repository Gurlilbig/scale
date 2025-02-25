import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import Image from "next/image";

interface CollectionImageSelectorProps {
  collection: {
    id: string;
    name: string;
    images: {
      id: string;
      name: string;
      field: string; // This is the field that contains the image data
    }[];
  };
}

export const CollectionImageSelector = ({ collection }: CollectionImageSelectorProps) => {
  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">Collection Images</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {collection.images.map((image) => (
          <Card key={image.id} className="p-4">
            <div className="flex items-start space-x-4">
              <Checkbox 
                checked={true} 
                // Disabled to prevent unchecking
                disabled={true}
                className="mt-1"
              />
              <div className="space-y-2 flex-1">
                <div className="relative h-40 w-full">
                  <Image
                    src={image.field} // Use `field` as the image source
                    alt={image.name}
                    fill
                    className="object-cover rounded-md"
                  />
                </div>
                <p className="text-sm font-medium truncate">{image.name}</p>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
};
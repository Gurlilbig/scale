import { useState, useEffect } from 'react';
import { Checkbox } from "@/components/ui/checkbox";

interface Collection {
  id: string;
  name: string;
  items: {
    id: string;
    name: string;
    lastUpdated: string; // Adding this field
    slug: string | null; // Adding this field
    images: {
      id: string;
      name: string;
      field: string;
      url: string;
      fileId: string | null; // Adding this field
      alt: string | null; // Adding this field
    }[];
    fieldData: Record<string, any>; // Adding this field
  }[];
}

export const CollectionSelector = ({
  onCollectionSelect,
  selectedCollection,
}: {
  onCollectionSelect: (collection: Collection | null) => void;
  selectedCollection: Collection | null;
}) => {
  const [collections, setCollections] = useState<Collection[]>([]);

  useEffect(() => {
    async function fetchCollections() {
      try {
        const response = await fetch('/api/fetch-collections');
        const data = await response.json();
        setCollections(data);
      } catch (error) {
        console.error('Error fetching collections:', error);
      }
    }

    fetchCollections();
  }, []);

  return (
    <div className="space-y-4 p-4">
      <h2 className="text-xl font-semibold mb-4">Select Collection</h2>
      <div className="space-y-2">
        {collections.map((collection) => (
          <div key={collection.id} className="flex items-center space-x-2">
            <Checkbox
              id={collection.id}
              checked={selectedCollection?.id === collection.id}
              onCheckedChange={(checked) => {
                onCollectionSelect(checked ? collection : null);
              }}
            />
            <label
              htmlFor={collection.id}
              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
            >
              {collection.name}
            </label>
          </div>
        ))}
      </div>
    </div>
  );
};

export type { Collection };
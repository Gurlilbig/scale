// src/components/resize/ItemSelector.tsx
import { Checkbox } from "@/components/ui/checkbox";
import type { Collection } from './CollectionSelector';
import React from 'react';

export const ItemSelector = ({
  collection,
  selectedItem,
  onItemSelect,
}: {
  collection: Collection;
  selectedItem: Collection['items'][0] | null;
  onItemSelect: (item: Collection['items'][0] | null) => void;
}) => {
  return (
    <div className="space-y-4 p-4">
      <h2 className="text-xl font-semibold mb-4">Select Item from {collection.name}</h2>
      <div className="space-y-2">
        {collection.items.map((item) => (
          <div key={item.id} className="flex items-center space-x-2">
            <Checkbox
              id={item.id}
              checked={selectedItem?.id === item.id}
              onCheckedChange={(checked) => {
                onItemSelect(checked ? item : null);
              }}
            />
            <label
              htmlFor={item.id}
              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
            >
              {item.name}
            </label>
          </div>
        ))}
      </div>
    </div>
  );
};
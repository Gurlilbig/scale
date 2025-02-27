'use client';

import { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Maximize2, Minimize2 } from 'lucide-react';
import { setExtensionSize, isWebflowEnvironment } from '@/lib/webflow-extension';

type ExtensionSize = 'default' | 'comfortable' | 'large' | {width: number; height: number};

export const ResizeButton: React.FC = () => {
  const [currentSize, setCurrentSize] = useState<ExtensionSize>('default');
  const [isMaximized, setIsMaximized] = useState(false);
  
  // Only show the resize button if we're in the Webflow environment
  if (!isWebflowEnvironment()) {
    return null;
  }

  const handleResize = async () => {
    try {
      // Toggle between default and large size
      const newSize: ExtensionSize = isMaximized ? 'default' : 'large';
      
      await setExtensionSize(newSize);
      
      // Update state
      setCurrentSize(newSize);
      setIsMaximized(!isMaximized);
    } catch (error) {
      console.error('Failed to resize extension:', error);
    }
  };
  
  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={handleResize}
      className="hover:bg-gray-100"
      title={isMaximized ? "Minimize" : "Maximize"}
    >
      {isMaximized ? (
        <Minimize2 className="h-5 w-5" />
      ) : (
        <Maximize2 className="h-5 w-5" />
      )}
    </Button>
  );
};
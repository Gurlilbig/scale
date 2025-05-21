// src/lib/webflow-extension.ts

// Access the Webflow object from the window
declare global {
    interface Window {
      webflow: {
        setExtensionSize: (size: 'default' | 'comfortable' | 'large' | {width: number; height: number}) => Promise<null>;
        // Add other Webflow APIs as needed
      };
    }
  }
  
  /*
   * Set the size of the Webflow extension UI
   * @param size 'default' | 'comfortable' | 'large' | {width: number; height: number}
   * @returns Promise that resolves when size is set
   */
  export const setExtensionSize = async (
    size: 'default' | 'comfortable' | 'large' | {width: number; height: number}
  ): Promise<void> => {
    try {
      if (typeof window !== 'undefined' && window.webflow) {
        await window.webflow.setExtensionSize(size);
        console.log(`Extension UI size set to: ${typeof size === 'string' ? size : `${size.width}x${size.height}`}`);
      } else {
        console.warn('Webflow extension API not available');
      }
    } catch (error) {
      console.error('Error setting extension size:', error);
      throw error;
    }
  };
  
  /**
   * Check if the app is running in the Webflow environment
   * @returns boolean indicating if running in Webflow
   */
  export const isWebflowEnvironment = (): boolean => {
    return typeof window !== 'undefined' && !!window.webflow;
  };
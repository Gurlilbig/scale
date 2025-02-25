import { useRouter } from 'next/navigation'; // Import the useRouter hook
import { Image } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { OptionCard } from './OptionCard';

interface CropModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onOptionSelect: (option: string) => void;
}

export const CropModal = ({ isOpen, onOpenChange, onOptionSelect }: CropModalProps) => {
  const router = useRouter(); // Initialize the router

  const handleCropSpecific = () => {
    onOptionSelect('crop-specific'); // Call the onOptionSelect callback
    router.push('/crop/specific-images'); // Navigate to the specific route
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Crop Image Assets</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-4 font-iosevka">
          <OptionCard
            icon={Image}
            title="Specific Images"
            description="Choose specific images to crop"
            onClick={handleCropSpecific} // Use the new handler
          />
        </div>
      </DialogContent>
    </Dialog>
  );
};
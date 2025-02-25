// src/components/home/ResizeModal.tsx
import { Folder, Image } from 'lucide-react';
import { useRouter } from 'next/navigation';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { OptionCard } from './OptionCard';

interface ResizeModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onOptionSelect: (option: string) => void;
}

export const ResizeModal = ({ isOpen, onOpenChange, onOptionSelect }: ResizeModalProps) => {
  const router = useRouter();

  const handleSpecificImagesClick = () => {
    onOpenChange(false); // Close the modal
    router.push('/resize/specific-images'); // Navigate to the specific images page
  };

  // const handleCollectionsClick = () => {
  //   onOpenChange(false); // Close the modal
  //   router.push('/resize/collections'); // Navigate to the specific images page
  // };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Resize Image Assets</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-4 font-iosevka">
          {/* <OptionCard
            icon={Folder}
            title="Resize Collections"
            description="Resize all images in selected collections"
            onClick={handleCollectionsClick}
          /> */}
          <OptionCard
            icon={Image}
            title="Specific Images"
            description="Choose specific images to resize"
            onClick={handleSpecificImagesClick}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
};
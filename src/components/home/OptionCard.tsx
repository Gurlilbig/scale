// src/components/home/OptionCard.tsx
import { LucideIcon } from 'lucide-react';
import React from 'react';

interface OptionCardProps {
  icon: LucideIcon;
  title: string;
  description: string;
  onClick: () => void;
}

export const OptionCard = ({ icon: Icon, title, description, onClick }: OptionCardProps) => (
  <button
    onClick={onClick}
    className="relative flex flex-col items-center p-6 rounded-lg border-2 border-border hover:border-primary transition-colors"
  >
    <div className="flex flex-col items-center text-center space-y-2">
      <Icon className="h-8 w-8 mb-2" />
      <h3 className="font-semibold">{title}</h3>
      <p className="text-sm text-muted-foreground">{description}</p>
    </div>
  </button>
);
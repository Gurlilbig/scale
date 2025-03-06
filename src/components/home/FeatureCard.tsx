import { LucideIcon } from 'lucide-react';
import React from 'react';

interface FeatureCardProps {
  icon: LucideIcon;
  title: string;
  description: string;
  buttonText: string;
  onClick: () => void;
  accentColor: string;
  hoverColor: string;
}

export const FeatureCard = ({ 
  icon: Icon, 
  title, 
  description, 
  buttonText, 
  onClick,
  accentColor,
  hoverColor
}: FeatureCardProps) => (
  <div className="group relative bg-white rounded-xl shadow-lg overflow-hidden hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1">
    <div className="p-8">
      <div className={`flex items-center justify-center w-16 h-16 ${accentColor} rounded-full mb-4 ${hoverColor} transition-colors`}>
        <Icon className="h-8 w-8 text-blue-600" />
      </div>
      <h2 className="text-2xl font-semibold text-gray-900 mb-4">{title}</h2>
      <p className="text-gray-600">{description}</p>
      <button 
        onClick={onClick}
        className={`mt-6 px-6 py-2 ${accentColor.replace('bg-blue-100', 'bg-blue-600').replace('bg-green-100', 'bg-green-600')} text-white rounded-lg hover:${accentColor.replace('bg-blue-100', 'bg-blue-700').replace('bg-green-100', 'bg-green-700')} transition-colors`}
      >
        {buttonText}
      </button>
    </div>
  </div>
);
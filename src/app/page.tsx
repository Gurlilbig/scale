'use client';

import React from 'react';

import { useState } from 'react';
import Link from 'next/link';
import { Home, Layout, Crop } from 'lucide-react';
import { FeatureCard } from '@/components/home/FeatureCard';
import { ResizeModal } from '@/components/home/ResizeModal';
import { CropModal } from '@/components/home/CropModal';

export default function HomePage() {
  const [isResizeModalOpen, setIsResizeModalOpen] = useState(false);
  const [isCropModalOpen, setIsCropModalOpen] = useState(false);

  const handleOptionSelect = (option: string) => {
    console.log('Selected option:', option);
    setIsResizeModalOpen(false);
    setIsCropModalOpen(false);
    // Here you would navigate to the appropriate page or show the next step
  };

  return (
    <div className="min-h-screen flex flex-col font-iosevka">
      {/* Header */}
      <header className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center">
            <Link href="/" passHref>
              <div className="cursor-pointer">
                <Home className="h-6 w-6 text-blue-600" />
              </div>
            </Link>
            <span className="ml-2 text-xl font-semibold text-gray-900">Welcome back</span>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-grow flex items-center justify-center bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <h1 className="text-4xl font-bold text-center text-gray-900 mb-8">
            What would you like to do?
          </h1>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            <FeatureCard
              icon={Layout}
              title="Resize"
              description="Resize multiple images from your Webflow collections or specific assets while maintaining quality."
              buttonText="Get Started"
              onClick={() => setIsResizeModalOpen(true)}
              accentColor="bg-blue-100"
              hoverColor="group-hover:bg-blue-200"
            />

            <FeatureCard
              icon={Crop}
              title="Crop"
              description="Precisely crop specific images from your Webflow assets with our intuitive cropping tool."
              buttonText="Get Started"
              onClick={() => setIsCropModalOpen(true)}
              accentColor="bg-green-100"
              hoverColor="group-hover:bg-green-200"
            />
          </div>
        </div>
      </main>

      <ResizeModal
        isOpen={isResizeModalOpen}
        onOpenChange={setIsResizeModalOpen}
        onOptionSelect={handleOptionSelect}
      />

      <CropModal
        isOpen={isCropModalOpen}
        onOpenChange={setIsCropModalOpen}
        onOptionSelect={handleOptionSelect}
      />

      {/* Footer */}
      <footer className="bg-white border-t">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <p className="text-center text-gray-600">
            © {new Date().getFullYear()} Lil Big Things. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
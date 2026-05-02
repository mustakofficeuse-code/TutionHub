import React, { useState } from 'react';
import { X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface ViewableImageProps {
  src: string;
  alt: string;
  className?: string;
  roundedFull?: boolean;
}

export default function ViewableImage({ src, alt, className = '', roundedFull = true }: ViewableImageProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <img
        src={src}
        alt={alt}
        className={`${className} ${roundedFull ? 'rounded-full' : ''} cursor-pointer transition-transform hover:scale-105`}
        onClick={() => setIsOpen(true)}
      />
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[200] flex items-center justify-center p-4 cursor-zoom-out"
            onClick={() => setIsOpen(false)}
          >
            <motion.img
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              src={src}
              alt={alt}
              className="max-w-full max-h-full object-contain rounded-xl"
              onClick={(e) => e.stopPropagation()}
            />
            <button 
              className="absolute top-6 right-6 text-white p-2"
              onClick={() => setIsOpen(false)}
            >
              <X className="w-8 h-8" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

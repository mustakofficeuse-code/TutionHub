import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import logoUrl from '../assets/images/gold_tuitionhub_logo_1779680854835.png';
import { X, Search } from 'lucide-react';

interface LogoProps {
  className?: string;
  size?: number | string;
  disableZoom?: boolean;
}

export const Logo: React.FC<LogoProps> = ({ className = '', size = '100%', disableZoom = false }) => {
  const [isZoomed, setIsZoomed] = useState(false);

  const handleLogoClick = (e: React.MouseEvent) => {
    if (disableZoom) return;
    e.stopPropagation();
    setIsZoomed(true);
  };

  return (
    <>
      <div 
        onClick={handleLogoClick}
        className={`relative ${!disableZoom ? 'cursor-pointer group/logo' : ''}`}
        style={{ width: size, height: size }}
      >
        <img
          src={logoUrl}
          alt="TuitionHub Logo"
          className={`select-none object-cover rounded-full w-full h-full ${className}`}
          draggable={false}
          referrerPolicy="no-referrer"
        />
        {!disableZoom && (
          <div className="absolute inset-0 bg-black/30 opacity-0 group-hover/logo:opacity-100 transition-opacity duration-200 rounded-full flex items-center justify-center">
            <Search className="w-4 h-4 text-white scale-90 group-hover/logo:scale-100 transition-transform duration-200" />
          </div>
        )}
      </div>

      {isZoomed && createPortal(
        <div 
          className="fixed inset-0 z-[3000] bg-black/90 backdrop-blur-xl flex flex-col items-center justify-center p-4 select-none animate-[fadeIn_0.2s_ease-out]"
          onClick={() => setIsZoomed(false)}
        >
          {/* Close button top right */}
          <button 
            onClick={(e) => { e.stopPropagation(); setIsZoomed(false); }}
            className="absolute top-6 right-6 p-3 bg-white/10 hover:bg-white/20 text-white rounded-full transition-all duration-200 hover:scale-110 border border-white/5 shadow-2xl"
          >
            <X className="w-6 h-6" />
          </button>

          {/* Logo container content */}
          <div 
            className="flex flex-col items-center max-w-md w-full gap-6 text-center animate-[scaleIn_0.2s_ease-out]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Glowing Logo Circle */}
            <div className="relative w-64 h-64 sm:w-80 sm:h-80 rounded-full overflow-hidden shadow-[0_0_60px_rgba(223,183,60,0.25)] border-4 border-amber-400 p-1 bg-[#121b22]">
              <img
                src={logoUrl}
                alt="TuitionHub Logo Large"
                className="select-none object-contain rounded-full w-full h-full"
                draggable={false}
                referrerPolicy="no-referrer"
              />
            </div>

            {/* Informational Subtext */}
            <div className="space-y-1 font-sans">
              <h2 className="text-2xl font-extrabold text-white tracking-tight">
                Tuition<span className="text-amber-400">Hub</span>
              </h2>
              <p className="text-xs font-semibold text-amber-400/80 tracking-widest uppercase">
                Smart Classroom Companion
              </p>
              <p className="text-[11px] text-slate-400 font-medium px-4 max-w-xs mt-2 leading-relaxed">
                Empowering teachers and pupils with seamless attendance, analytics, shared study forums, and instant cloud-pushed notification grids.
              </p>
            </div>
            
            <button 
              onClick={() => setIsZoomed(false)}
              className="mt-4 px-6 py-2.5 bg-amber-400 hover:bg-amber-500 font-bold text-xs tracking-wide uppercase text-slate-950 rounded-xl transition-all shadow-lg hover:shadow-amber-400/20 active:scale-95"
            >
              Close Viewer
            </button>
          </div>
        </div>,
        document.body
      )}
    </>
  );
};

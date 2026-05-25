import React from 'react';

interface LogoProps {
  className?: string;
  size?: number | string;
}

export const Logo: React.FC<LogoProps> = ({ className = '', size = '100%' }) => {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 512 512"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`select-none ${className}`}
      id="tuitionhub-svg-logo"
    >
      {/* Base Definitions for High-End Metallic Shimmers */}
      <defs>
        {/* Luxury Golden Linear Gradients */}
        <linearGradient id="goldMetallic" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#FFF2B2" />
          <stop offset="20%" stopColor="#D1AC30" />
          <stop offset="45%" stopColor="#F9DF7B" />
          <stop offset="60%" stopColor="#DFB73C" />
          <stop offset="80%" stopColor="#AA820A" />
          <stop offset="100%" stopColor="#FDF1A9" />
        </linearGradient>

        <linearGradient id="goldSoft" x1="0%" y1="100%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#8A6605" />
          <stop offset="30%" stopColor="#DFB73C" />
          <stop offset="50%" stopColor="#FFF2B2" />
          <stop offset="70%" stopColor="#DFB73C" />
          <stop offset="100%" stopColor="#9E780E" />
        </linearGradient>

        <linearGradient id="darkShield" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#1e1e1e" />
          <stop offset="50%" stopColor="#0F0F0F" />
          <stop offset="100%" stopColor="#050505" />
        </linearGradient>

        {/* Drop Shadows and Glow Filters */}
        <filter id="goldGlow" x="-10%" y="-10%" width="120%" height="120%">
          <feDropShadow dx="0" dy="4" stdDeviation="6" floodColor="#DFB73C" floodOpacity="0.4" />
        </filter>
        <filter id="subtleShadow" x="-10%" y="-10%" width="120%" height="120%">
          <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="#000000" floodOpacity="0.6" />
        </filter>
      </defs>

      {/* 1. Luxurious Dark Round Shield Backdrop */}
      <circle cx="256" cy="256" r="236" fill="url(#darkShield)" stroke="url(#goldSoft)" strokeWidth="3" />

      {/* 2. Double Metallic Gold Outer Accent Rings */}
      <circle cx="256" cy="256" r="226" fill="none" stroke="url(#goldMetallic)" strokeWidth="4" />
      <circle cx="256" cy="256" r="214" fill="none" stroke="url(#goldSoft)" strokeWidth="1.5" opacity="0.8" />

      {/* 3. Elegant Inner Shield Frame */}
      <path
        d="M 160 160 L 352 160 C 352 280, 256 324, 256 324 C 256 324, 160 280, 160 160 Z"
        fill="#0D0D0D"
        stroke="url(#goldMetallic)"
        strokeWidth="3"
        filter="url(#subtleShadow)"
      />

      {/* 4. Polished Golden Crown on top of the Shield */}
      <g transform="translate(186, 102)" filter="url(#subtleShadow)">
        {/* Elegant base path of the crown */}
        <path
          d="M 10 38 Q 70 48, 130 38 L 126 30 Q 70 38, 14 30 Z"
          fill="url(#goldMetallic)"
        />
        {/* Base trim row */}
        <rect x="25" y="33" width="90" height="2" rx="1" fill="#FFFFFF" opacity="0.6" />
        {/* Crown peaks and points */}
        <path
          d="M 10 30 L 22 10 L 44 26 L 70 2 C 70 2, 96 26, 96 26 L 118 10 L 130 30 Z"
          fill="url(#goldSoft)"
          stroke="url(#goldMetallic)"
          strokeWidth="1.5"
        />
        {/* Insets for 3D depth inside crown peaks */}
        <path
          d="M 22 13 L 26 28 L 14 28 Z M 70 6 L 76 28 L 64 28 Z M 118 13 L 126 28 L 114 28 Z"
          fill="url(#goldMetallic)"
          opacity="0.9"
        />
        {/* Spheres on the crown peaks */}
        <circle cx="22" cy="10" r="4.5" fill="url(#goldMetallic)" />
        <circle cx="70" cy="2" r="5.5" fill="url(#goldMetallic)" />
        <circle cx="118" cy="10" r="4.5" fill="url(#goldMetallic)" />
      </g>

      {/* 5. Golden Laurel Wreath Branches curved on the sides */}
      <g stroke="url(#goldSoft)" strokeWidth="1" strokeLinecap="round">
        {/* Left Wing Laurels */}
        <path d="M 125 180 Q 95 240, 125 310" fill="none" stroke="url(#goldSoft)" strokeWidth="2.5" />
        {/* Leaves */}
        <path d="M 125 180 Q 110 170, 115 160 C 125 165, 125 180, 125 180 Z" fill="url(#goldMetallic)" />
        <path d="M 121 200 Q 100 190, 106 180 C 118 185, 121 200, 121 200 Z" fill="url(#goldMetallic)" />
        <path d="M 115 225 Q 92 215, 96 205 C 108 210, 115 225, 115 225 Z" fill="url(#goldMetallic)" />
        <path d="M 111 250 Q 86 242, 90 230 C 104 235, 111 250, 111 250 Z" fill="url(#goldMetallic)" />
        <path d="M 112 275 Q 88 271, 91 258 C 105 261, 112 275, 112 275 Z" fill="url(#goldMetallic)" />
        <path d="M 116 300 Q 94 302, 98 288 C 110 290, 116 300, 116 300 Z" fill="url(#goldMetallic)" />
        <path d="M 125 310 Q 108 322, 110 308 C 120 306, 125 310, 125 310 Z" fill="url(#goldMetallic)" />

        {/* Right Wing Laurels */}
        <path d="M 387 180 Q 417 240, 387 310" fill="none" stroke="url(#goldSoft)" strokeWidth="2.5" />
        {/* Leaves */}
        <path d="M 387 180 Q 402 170, 397 160 C 387 165, 387 180, 387 180 Z" fill="url(#goldMetallic)" />
        <path d="M 391 200 Q 412 190, 406 180 C 394 185, 391 200, 391 200 Z" fill="url(#goldMetallic)" />
        <path d="M 397 225 Q 420 215, 416 205 C 404 210, 397 225, 397 225 Z" fill="url(#goldMetallic)" />
        <path d="M 401 250 Q 426 242, 422 230 C 408 235, 401 250, 401 250 Z" fill="url(#goldMetallic)" />
        <path d="M 400 275 Q 424 271, 421 258 C 407 261, 400 275, 400 275 Z" fill="url(#goldMetallic)" />
        <path d="M 396 300 Q 418 302, 414 288 C 402 290, 396 300, 396 300 Z" fill="url(#goldMetallic)" />
        <path d="M 387 310 Q 404 322, 402 308 C 392 306, 387 310, 387 310 Z" fill="url(#goldMetallic)" />
      </g>

      {/* 6. Bold 3D Golden Letter "T" & Graduation Cap Nested inside Shield */}
      <g transform="translate(196, 175)" filter="url(#goldGlow)">
        {/* Elegant 3D Letter "T" of TuitionHub */}
        {/* Front face of T */}
        <path
          d="M 24 35 L 96 35 L 96 49 L 71 49 L 71 106 C 71 114, 49 114, 49 106 L 49 49 L 24 49 Z"
          fill="url(#goldMetallic)"
        />
        {/* 3D Gold bevel shadow of T */}
        <path
          d="M 24 49 L 49 49 L 49 106 C 49 116, 71 116, 71 106 L 71 49 L 96 49 L 96 52 L 74 52 L 74 106 C 74 117, 46 117, 46 106 L 46 52 L 24 52 Z"
          fill="url(#goldSoft)"
          opacity="0.8"
        />

        {/* Sleek Golden Graduation Cap */}
        {/* Cap Diamond Base */}
        <path
          d="M 60 4 L 116 26 L 60 48 L 4 26 Z"
          fill="url(#goldMetallic)"
          stroke="#000000"
          strokeWidth="1.5"
        />
        {/* Cap Diamond Rim highlight */}
        <path
          d="M 60 7 L 111 26 L 60 45 L 9 26 Z"
          fill="none"
          stroke="#FFFFFF"
          strokeWidth="1.2"
          opacity="0.4"
        />
        {/* Cap Skull/Under-cap Base */}
        <path
          d="M 30 30 V 38 C 30 46, 90 46, 90 38 V 30"
          fill="url(#goldSoft)"
          stroke="url(#goldMetallic)"
          strokeWidth="1.5"
        />
        {/* Pearl/Node Button on cap center */}
        <ellipse cx="60" cy="26" rx="4.5" ry="3" fill="#FFFFFF" />

        {/* Elegant Long Hanging Metallic Tassel */}
        <path
          d="M 60 26 C 30 26, 14 38, 14 54"
          fill="none"
          stroke="url(#goldSoft)"
          strokeWidth="2.5"
          strokeLinecap="round"
        />
        {/* Tassel end fringe */}
        <path
          d="M 14 54 L 11 64 L 17 64 Z"
          fill="url(#goldMetallic)"
        />
      </g>

      {/* 7. Luxurious Open Gold Book (Foundation of Learning) at Base of Shield */}
      <g transform="translate(186, 276)" filter="url(#subtleShadow)">
        {/* Left Book Page */}
        <path
          d="M 12 18 C 34 8, 66 18, 70 20 L 70 42 C 66 40, 34 30, 12 40 Z"
          fill="url(#goldMetallic)"
          stroke="url(#goldSoft)"
          strokeWidth="1.2"
        />
        {/* Right Book Page */}
        <path
          d="M 128 18 C 106 8, 74 18, 70 20 L 70 42 C 74 40, 106 30, 128 40 Z"
          fill="url(#goldMetallic)"
          stroke="url(#goldSoft)"
          strokeWidth="1.2"
        />
        {/* Pages edge detailing */}
        <path d="M 15 22 Q 40 14, 67 22" stroke="#8A6605" strokeWidth="0.8" fill="none" opacity="0.7" />
        <path d="M 15 26 Q 40 18, 67 26" stroke="#8A6605" strokeWidth="0.8" fill="none" opacity="0.7" />
        <path d="M 15 30 Q 40 22, 67 30" stroke="#8A6605" strokeWidth="0.8" fill="none" opacity="0.7" />
        <path d="M 125 22 Q 100 14, 73 22" stroke="#8A6605" strokeWidth="0.8" fill="none" opacity="0.7" />
        <path d="M 125 26 Q 100 18, 73 26" stroke="#8A6605" strokeWidth="0.8" fill="none" opacity="0.7" />
        <path d="M 125 30 Q 100 22, 73 30" stroke="#8A6605" strokeWidth="0.8" fill="none" opacity="0.7" />

        {/* Book spine/center gold node */}
        <path d="M 70 17 L 70 44" stroke="url(#goldMetallic)" strokeWidth="3" />
      </g>

      {/* 8. Premium Small Golden Shimmer Star at bottom center of Shield */}
      <polygon
        points="256,334 260,344 270,344 262,350 265,360 256,354 247,360 250,350 242,344 252,344"
        fill="url(#goldMetallic)"
        filter="url(#goldGlow)"
      />

      {/* 9. Elegant "TuitionHub" Brand Typography Embossed along Bottom */}
      <text
        x="256"
        y="410"
        fontFamily="'Inter', system-ui, sans-serif"
        fontWeight="800"
        fontSize="38"
        fill="url(#goldMetallic)"
        textAnchor="middle"
        letterSpacing="-0.5"
        filter="url(#subtleShadow)"
      >
        TuitionHub
      </text>

      {/* 10. Minimalist Subtitle "LEARNING NETWORK" with Wide Tracking */}
      <text
        x="256"
        y="442"
        fontFamily="'JetBrains Mono', monospace"
        fontWeight="700"
        fontSize="12.5"
        fill="url(#goldSoft)"
        textAnchor="middle"
        letterSpacing="4.5"
        opacity="0.9"
      >
        LEARNING NETWORK
      </text>

      {/* 11. Subtle Horizontal Gold Ribbon/Arrow Accents at the very bottom */}
      <g stroke="url(#goldSoft)" strokeWidth="1.5">
        <path d="M 170 455 Q 210 457, 230 455" fill="none" />
        <path d="M 342 455 Q 302 457, 282 455" fill="none" />
        <circle cx="230" cy="455" r="2.5" fill="url(#goldMetallic)" />
        <circle cx="282" cy="455" r="2.5" fill="url(#goldMetallic)" />
      </g>
    </svg>
  );
};

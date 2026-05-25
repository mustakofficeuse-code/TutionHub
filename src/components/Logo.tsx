import React from 'react';

interface LogoProps {
  className?: string;
  size?: number | string;
}

export const Logo: React.FC<LogoProps> = ({ className = '', size = '100%' }) => {
  return (
    <img
      src="/logo.png"
      alt="TuitionHub Logo"
      className={`select-none object-cover rounded-full ${className}`}
      style={{ width: size, height: size }}
      draggable={false}
      referrerPolicy="no-referrer"
    />
  );
};

import React from 'react';
import logoUrl from '../assets/images/gold_tuitionhub_logo_1779680854835.png';

interface LogoProps {
  className?: string;
  size?: number | string;
}

export const Logo: React.FC<LogoProps> = ({ className = '', size = '100%' }) => {
  return (
    <img
      src={logoUrl}
      alt="TuitionHub Logo"
      className={`select-none object-cover rounded-full ${className}`}
      style={{ width: size, height: size }}
      draggable={false}
      referrerPolicy="no-referrer"
    />
  );
};

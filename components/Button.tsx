import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  icon?: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({ 
  children, 
  variant = 'primary', 
  className = '', 
  icon,
  ...props 
}) => {
  const baseStyles = "inline-flex items-center justify-center px-4 py-2 border text-sm font-medium focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-osint-green disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200";
  
  const variants = {
    primary: "border-osint-green text-osint-green hover:bg-osint-green hover:text-osint-black shadow-[0_0_10px_rgba(0,255,65,0.2)]",
    secondary: "border-osint-gray text-gray-300 hover:border-gray-400 hover:text-white bg-transparent",
    danger: "border-osint-alert text-osint-alert hover:bg-osint-alert hover:text-white",
    ghost: "border-transparent text-gray-400 hover:text-osint-green"
  };

  return (
    <button 
      className={`${baseStyles} ${variants[variant]} ${className}`}
      {...props}
    >
      {icon && <span className="mr-2">{icon}</span>}
      {children}
    </button>
  );
};
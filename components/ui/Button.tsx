import React from 'react';
import { ButtonProps } from '../../types';

const Button: React.FC<ButtonProps> = ({ children, variant = 'primary', size = 'md', className = '', ...props }) => {
  const baseStyles = 'font-medium rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 dark:focus:ring-offset-gray-800 transition ease-in-out duration-150 disabled:opacity-50 flex items-center justify-center';
  
  const sizeStyles = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2 text-base',
    lg: 'px-6 py-3 text-lg',
  };

  const variantStyles = {
    primary: 'bg-primary-600 text-white hover:bg-primary-700 focus:ring-primary-500 dark:hover:bg-primary-500',
    secondary: 'bg-gray-200 text-gray-800 hover:bg-gray-300 focus:ring-gray-400 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600 dark:focus:ring-gray-500',
    danger: 'bg-red-600 text-white hover:bg-red-700 focus:ring-red-500 dark:hover:bg-red-500',
    ghost: 'bg-transparent text-primary-600 hover:bg-primary-50 focus:ring-primary-500 dark:text-primary-400 dark:hover:bg-primary-700/30 dark:focus:ring-primary-500',
    accent: 'bg-accent text-primary-950 hover:bg-yellow-400 focus:ring-yellow-500 dark:bg-accent dark:text-primary-950 dark:hover:bg-yellow-400 dark:focus:ring-yellow-500',
    info: 'bg-primary-400 text-white hover:bg-primary-500 focus:ring-primary-300 dark:bg-primary-500 dark:text-white dark:hover:bg-primary-600 dark:focus:ring-primary-400',
  };

  return (
    <button
      type="button"
      className={`${baseStyles} ${sizeStyles[size]} ${variantStyles[variant]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
};

export default Button;
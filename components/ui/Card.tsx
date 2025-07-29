import React from 'react';
import { CardProps } from '../../types';

const Card: React.FC<CardProps> = ({ children, className, onClick, ...rest }) => {
  return (
    <div
      className={`bg-white dark:bg-gray-800 shadow-lg dark:shadow-md dark:shadow-gray-700/50 rounded-lg p-6 ${className || ''}`}
      onClick={onClick}
      {...rest} // Spread other props like role, tabIndex, aria-label
    >
      {children}
    </div>
  );
};

export default Card;
import React from 'react';
import './Divider.css';

export interface DividerProps {
  variant?: 'primary' | 'secondary';
  orientation?: 'horizontal' | 'vertical';
  className?: string;
}

const Divider: React.FC<DividerProps> = ({
  variant = 'primary',
  orientation = 'horizontal',
  className = ''
}) => {
  const classNames = [
    'ds-divider',
    `ds-divider--${variant}`,
    `ds-divider--${orientation}`,
    className
  ].filter(Boolean).join(' ');

  return <hr className={classNames} />;
};

export default Divider;


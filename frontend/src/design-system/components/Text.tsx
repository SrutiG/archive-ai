import React from 'react';
import './Text.css';

export interface TextProps {
  variant?: 'body' | 'description' | 'small' | 'caption';
  children: React.ReactNode;
  className?: string;
  as?: 'p' | 'span' | 'div';
}

const Text: React.FC<TextProps> = ({
  variant = 'body',
  children,
  className = '',
  as: Component = 'p'
}) => {
  const classNames = ['ds-text', `ds-text--${variant}`, className]
    .filter(Boolean)
    .join(' ');

  return (
    <Component className={classNames}>
      {children}
    </Component>
  );
};

export default Text;


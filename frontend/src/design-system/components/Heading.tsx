import React from 'react';
import './Heading.css';

export interface HeadingProps {
  level: 1 | 2 | 3 | 4 | 5 | 6;
  children: React.ReactNode;
  className?: string;
}

const Heading: React.FC<HeadingProps> = ({ level, children, className = '' }) => {
  const Component = `h${level}` as keyof JSX.IntrinsicElements;
  const classNames = ['ds-heading', `ds-heading--h${level}`, className]
    .filter(Boolean)
    .join(' ');

  return (
    <Component className={classNames}>
      {children}
    </Component>
  );
};

export default Heading;


import React from 'react';
import Heading from './Heading';
import Text from './Text';
import './PageHeader.css';

export interface PageHeaderProps {
  title: string;
  description?: string;
  children?: React.ReactNode;
  className?: string;
}

const PageHeader: React.FC<PageHeaderProps> = ({
  title,
  description,
  children,
  className = ''
}) => {
  return (
    <div className={`ds-page-header ${className}`}>
      <div className="ds-page-header__content">
        <Heading level={1}>{title}</Heading>
        {description && (
          <Text variant="description" className="ds-page-header__description">
            {description}
          </Text>
        )}
      </div>
      {children && (
        <div className="ds-page-header__actions">
          {children}
        </div>
      )}
    </div>
  );
};

export default PageHeader;


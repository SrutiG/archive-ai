import React from 'react';
import Heading from './Heading';
import Text from './Text';
import './SectionHeader.css';

export interface SectionHeaderProps {
  title: string;
  description?: string;
  className?: string;
}

const SectionHeader: React.FC<SectionHeaderProps> = ({
  title,
  description,
  className = ''
}) => {
  return (
    <div className={`ds-section-header ${className}`}>
      <Heading level={2}>{title}</Heading>
      {description && (
        <Text variant="description" className="ds-section-header__description">
          {description}
        </Text>
      )}
    </div>
  );
};

export default SectionHeader;


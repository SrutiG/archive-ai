import React, { useState, useRef, useEffect } from 'react';
import './BrandAutocomplete.css';

interface BrandAutocompleteProps {
  selectedBrands: string[];
  onBrandsChange: (brands: string[]) => void;
  disabled?: boolean;
}

const FASHION_BRANDS = [
  'Rick Owens',
  'Maison Margiela',
  'Ann Demeulemeester',
  'Yohji Yamamoto',
  'Comme des Garçons',
  'Issey Miyake',
  'Junya Watanabe',
  'Acne Studios',
  'Helmut Lang',
  'Raf Simons',
  'Dries Van Noten',
  'Balenciaga',
  'Vetements',
  'Dion Lee',
  'Peter Do',
  'The Row',
  'Celine',
  'Loewe',
  'Bottega Veneta',
  'Prada',
  'Miu Miu',
  'Saint Laurent',
  'Gucci',
  'Dior',
  'Chanel',
  'Versace',
  'Fendi',
  'Givenchy',
  'Jil Sander',
  'Marni',
  'Stella McCartney',
  'Vivienne Westwood',
  'Alexander McQueen',
  'Banana Republic',
  'Camper',
  'Professor E',
  'Zara',
  'H&M',
  'COS',
  'Arket',
  'Everlane',
  'Cuyana',
  'Reformation',
  'Aritzia',
  'Ganni',
  'Staud',
  'Nanushka',
  'Totême',
  'Vintage',
  'Thrift',
  'Jean Paul Gaultier',
  'Deadwood',
  'Stussy',
  'Reformation',
  'Moschino',
  'Other'
];

const BrandAutocomplete: React.FC<BrandAutocompleteProps> = ({ 
  selectedBrands, 
  onBrandsChange,
  disabled = false 
}) => {
  const [inputValue, setInputValue] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [filteredBrands, setFilteredBrands] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (inputValue.trim()) {
      const filtered = FASHION_BRANDS.filter(brand =>
        brand.toLowerCase().includes(inputValue.toLowerCase()) &&
        !selectedBrands.includes(brand)
      );
      setFilteredBrands(filtered);
      setShowSuggestions(filtered.length > 0);
    } else {
      setFilteredBrands([]);
      setShowSuggestions(false);
    }
  }, [inputValue, selectedBrands]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value);
  };

  const handleSelectBrand = (brand: string) => {
    if (!selectedBrands.includes(brand)) {
      onBrandsChange([...selectedBrands, brand]);
    }
    setInputValue('');
    setShowSuggestions(false);
    inputRef.current?.focus();
  };

  const handleRemoveBrand = (brandToRemove: string) => {
    onBrandsChange(selectedBrands.filter(brand => brand !== brandToRemove));
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && filteredBrands.length > 0) {
      e.preventDefault();
      handleSelectBrand(filteredBrands[0]);
    } else if (e.key === 'Escape') {
      setShowSuggestions(false);
      inputRef.current?.blur();
    }
  };

  return (
    <div className="brand-autocomplete" ref={containerRef}>
      <div className="brand-input-wrapper">
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={() => {
            if (inputValue.trim() && filteredBrands.length > 0) {
              setShowSuggestions(true);
            }
          }}
          placeholder="Search and add brands..."
          disabled={disabled}
          className="brand-input"
        />
        {showSuggestions && filteredBrands.length > 0 && (
          <ul className="brand-suggestions">
            {filteredBrands.slice(0, 8).map((brand) => (
              <li
                key={brand}
                onClick={() => handleSelectBrand(brand)}
                className="brand-suggestion-item"
              >
                {brand}
              </li>
            ))}
          </ul>
        )}
      </div>
      {selectedBrands.length > 0 && (
        <div className="selected-brands">
          {selectedBrands.map((brand) => (
            <span key={brand} className="brand-tag">
              {brand}
              <button
                type="button"
                onClick={() => handleRemoveBrand(brand)}
                className="brand-remove"
                disabled={disabled}
                aria-label={`Remove ${brand}`}
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
};

export default BrandAutocomplete;


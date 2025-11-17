import React, { useState, useEffect, useRef, useCallback } from 'react';
import { apiGet } from '../utils/api';
import './ProductSearch.css';

export interface ProductSearchResult {
  title: string;
  brand?: string;
  description?: string;
  imageUrl?: string;
  productUrl?: string;
  price?: string;
  category?: string;
  colors?: string[];
  materials?: string[];
  measurements?: {
    size?: string;
    [key: string]: string | number | undefined;
  };
  rawMetadata?: Record<string, unknown>;
}

interface ProductSearchProps {
  onSelectProduct: (product: ProductSearchResult) => void;
  onClose: () => void;
}

const ProductSearch: React.FC<ProductSearchProps> = ({ onSelectProduct, onClose }) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<ProductSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [error, setError] = useState<string | null>(null);
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const resultsRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Debounced search function
  const performSearch = useCallback(async (searchQuery: string) => {
    if (!searchQuery.trim()) {
      setResults([]);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    setError(null);

    try {
      const response = await apiGet(
        `/api/products/search?q=${encodeURIComponent(searchQuery)}&enrich=false`
      );
      
      if (!response.ok) {
        throw new Error(`Search failed: ${response.status}`);
      }
      
      const data = await response.json() as { results: ProductSearchResult[]; query: string; enriched: boolean };
      setResults(data.results || []);
      setSelectedIndex(-1);
    } catch (err) {
      console.error('Search error:', err);
      setError('Failed to search products. Please try again.');
      setResults([]);
    } finally {
      setIsSearching(false);
    }
  }, []);

  // Debounce search input
  useEffect(() => {
    // Clear previous timeout
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    // Set new timeout
    searchTimeoutRef.current = setTimeout(() => {
      performSearch(query);
    }, 300); // 300ms debounce

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [query, performSearch]);

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => 
        prev < results.length - 1 ? prev + 1 : prev
      );
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => prev > 0 ? prev - 1 : -1);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (selectedIndex >= 0 && results[selectedIndex]) {
        handleSelectProduct(results[selectedIndex]);
      }
    } else if (e.key === 'Escape') {
      onClose();
    }
  };

  // Scroll selected item into view
  useEffect(() => {
    if (selectedIndex >= 0 && resultsRef.current) {
      const selectedElement = resultsRef.current.children[selectedIndex] as HTMLElement;
      if (selectedElement) {
        selectedElement.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }
    }
  }, [selectedIndex]);

  const handleSelectProduct = (product: ProductSearchResult) => {
    onSelectProduct(product);
    setQuery('');
    setResults([]);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setQuery(e.target.value);
    setSelectedIndex(-1);
  };

  return (
    <div className="product-search-overlay" onClick={onClose}>
      <div className="product-search-container" onClick={(e) => e.stopPropagation()}>
        <div className="product-search-header">
          <h3>Search for Products</h3>
          <button className="product-search-close" onClick={onClose}>×</button>
        </div>

        <div className="product-search-input-wrapper">
          <input
            ref={inputRef}
            type="text"
            className="product-search-input"
            placeholder="Search for products (e.g., 'everlane ribbed turtleneck')..."
            value={query}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
          />
          {isSearching && (
            <div className="product-search-loading">Searching...</div>
          )}
        </div>

        {error && (
          <div className="product-search-error">{error}</div>
        )}

        {query && !isSearching && results.length === 0 && (
          <div className="product-search-empty">
            No products found. Try a different search term.
          </div>
        )}

        {results.length > 0 && (
          <div className="product-search-results" ref={resultsRef}>
            {results.map((product, index) => (
              <div
                key={index}
                className={`product-search-result ${index === selectedIndex ? 'selected' : ''}`}
                onClick={() => handleSelectProduct(product)}
                onMouseEnter={() => setSelectedIndex(index)}
              >
                {product.imageUrl && (
                  <img
                    src={product.imageUrl}
                    alt={product.title}
                    className="product-search-result-image"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = 'none';
                    }}
                  />
                )}
                <div className="product-search-result-content">
                  <div className="product-search-result-title">
                    {product.brand && <span className="product-search-result-brand">{product.brand}</span>}
                    {product.title}
                  </div>
                  {product.description && (
                    <div className="product-search-result-description">
                      {product.description.substring(0, 100)}
                      {product.description.length > 100 ? '...' : ''}
                    </div>
                  )}
                  {product.colors && product.colors.length > 0 && (
                    <div className="product-search-result-tags">
                      Colors: {product.colors.join(', ')}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {query && results.length > 0 && (
          <div className="product-search-footer">
            Use ↑↓ to navigate, Enter to select, Esc to close
          </div>
        )}
      </div>
    </div>
  );
};

export default ProductSearch;


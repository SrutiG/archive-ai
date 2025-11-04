import React, { useState, useRef, useEffect } from 'react';
import { WardrobeItem } from '../App';
import './ItemAutocomplete.css';

interface ItemAutocompleteProps {
  items: WardrobeItem[];
  selectedItems: WardrobeItem[];
  onItemsChange: (items: WardrobeItem[]) => void;
  maxItems?: number;
  disabled?: boolean;
  apiUrl: string;
}

const ItemAutocomplete: React.FC<ItemAutocompleteProps> = ({ 
  items, 
  selectedItems, 
  onItemsChange,
  maxItems = 3,
  disabled = false,
  apiUrl
}) => {
  const [inputValue, setInputValue] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [filteredItems, setFilteredItems] = useState<WardrobeItem[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const canAddMore = selectedItems.length < maxItems;

  useEffect(() => {
    const selectedIds = new Set(selectedItems.map(item => item.id));
    let filtered: WardrobeItem[];
    
    if (inputValue.trim()) {
      // Filter by search term
      filtered = items.filter(item =>
        item.title.toLowerCase().includes(inputValue.toLowerCase()) &&
        !selectedIds.has(item.id)
      );
    } else {
      // Show all available items when no search term
      filtered = items.filter(item => !selectedIds.has(item.id));
    }
    
    setFilteredItems(filtered);
    // Show suggestions when there are items and can add more
    setShowSuggestions(filtered.length > 0 && canAddMore);
  }, [inputValue, selectedItems, items, canAddMore, maxItems]);

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

  const handleSelectItem = (item: WardrobeItem) => {
    if (selectedItems.length < maxItems && !selectedItems.find(i => i.id === item.id)) {
      onItemsChange([...selectedItems, item]);
    }
    setInputValue('');
    setShowSuggestions(false);
    inputRef.current?.focus();
  };

  const handleRemoveItem = (itemToRemove: WardrobeItem) => {
    onItemsChange(selectedItems.filter(item => item.id !== itemToRemove.id));
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && filteredItems.length > 0) {
      e.preventDefault();
      handleSelectItem(filteredItems[0]);
    } else if (e.key === 'Escape') {
      setShowSuggestions(false);
      inputRef.current?.blur();
    }
  };

  return (
    <div className="item-autocomplete" ref={containerRef}>
      {selectedItems.length > 0 && (
        <div className="selected-items">
          {selectedItems.map((item) => (
            <span key={item.id} className="item-tag">
              {item.imageUrl && (
                <img 
                  src={`${apiUrl}${item.imageUrl}`} 
                  alt={item.title}
                  className="item-tag-image"
                />
              )}
              <span className="item-tag-title">{item.title}</span>
              <button
                type="button"
                onClick={() => handleRemoveItem(item)}
                className="item-remove"
                disabled={disabled}
                aria-label={`Remove ${item.title}`}
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}
      <div className="item-input-wrapper">
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={() => {
            // Show suggestions when focused if there are items available
            if (canAddMore) {
              const selectedIds = new Set(selectedItems.map(item => item.id));
              const availableItems = items.filter(item => !selectedIds.has(item.id));
              setFilteredItems(availableItems);
              setShowSuggestions(availableItems.length > 0);
            }
          }}
          placeholder={canAddMore ? `Search and add items (${selectedItems.length}/${maxItems})...` : `Maximum ${maxItems} items selected`}
          disabled={disabled || !canAddMore}
          className="item-input"
        />
        {showSuggestions && filteredItems.length > 0 && canAddMore && (
          <ul className="item-suggestions">
            {filteredItems.map((item) => (
              <li
                key={item.id}
                onClick={() => handleSelectItem(item)}
                className="item-suggestion-item"
              >
                <div className="item-suggestion-content">
                  {item.imageUrl && (
                    <img 
                      src={`${apiUrl}${item.imageUrl}`} 
                      alt={item.title}
                      className="item-suggestion-image"
                    />
                  )}
                  <div className="item-suggestion-text">
                    <span className="item-suggestion-title">{item.title}</span>
                    <span className="item-suggestion-category">{item.category}</span>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

export default ItemAutocomplete;


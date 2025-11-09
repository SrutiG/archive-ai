import React, { useState, useRef, useEffect } from 'react';

export interface AutocompleteOption {
  value: string;
  label: string;
}

interface MultiSelectAutocompleteProps {
  label: string;
  options: AutocompleteOption[];
  values: string[];
  onChange: (values: string[]) => void;
  placeholder?: string;
}

interface SingleSelectAutocompleteProps {
  label: string;
  options: AutocompleteOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  allowCustom?: boolean;
}

const useOutsideClick = (ref: React.RefObject<HTMLElement>, handler: () => void) => {
  useEffect(() => {
    const listener = (event: MouseEvent) => {
      if (!ref.current || ref.current.contains(event.target as Node)) {
        return;
      }
      handler();
    };
    document.addEventListener('mousedown', listener);
    return () => {
      document.removeEventListener('mousedown', listener);
    };
  }, [ref, handler]);
};

const MultiSelectAutocomplete: React.FC<MultiSelectAutocompleteProps> = ({
  label,
  options,
  values,
  onChange,
  placeholder = 'Start typing…',
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [inputValue, setInputValue] = useState('');
  const [isOpen, setIsOpen] = useState(false);

  useOutsideClick(containerRef, () => setIsOpen(false));

  const availableOptions = options.filter(
    (option) =>
      option.label.toLowerCase().includes(inputValue.toLowerCase()) &&
      !values.includes(option.value)
  );

  const getLabel = (value: string): string =>
    options.find((option) => option.value === value)?.label || value;

  const handleAdd = (value: string) => {
    if (!value || values.includes(value)) {
      return;
    }
    onChange([...values, value]);
    setInputValue('');
    setIsOpen(false);
    if (inputRef.current) {
      inputRef.current.focus();
    }
  };

  const handleRemove = (value: string) => {
    onChange(values.filter((item) => item !== value));
  };

  const handleInputKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Backspace' && inputValue === '' && values.length > 0) {
      event.preventDefault();
      handleRemove(values[values.length - 1]);
    }
  };

  return (
    <div className="attribute-autocomplete" ref={containerRef}>
      <span className="attribute-group-title">{label}</span>
      <div className="attribute-autocomplete-control">
        <div
          className="attribute-chips"
          tabIndex={0}
          onClick={() => {
            inputRef.current?.focus();
            setIsOpen(true);
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              inputRef.current?.focus();
              setIsOpen(true);
            }
          }}
        >
          {values.map((value) => (
            <span className="attribute-chip" key={value}>
              {getLabel(value)}
              <button
                type="button"
                onClick={() => handleRemove(value)}
                aria-label={`Remove ${getLabel(value)}`}
              >
                ×
              </button>
            </span>
          ))}
          <input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={(event) => {
              setInputValue(event.target.value);
              setIsOpen(true);
            }}
            onFocus={() => setIsOpen(true)}
            onKeyDown={handleInputKeyDown}
            placeholder={values.length === 0 ? placeholder : ''}
          />
        </div>
        {isOpen && availableOptions.length > 0 && (
          <ul className="attribute-suggestions">
            {availableOptions.map((option) => (
              <li key={option.value}>
                <button
                  type="button"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => handleAdd(option.value)}
                >
                  {option.label}
                </button>
              </li>
            ))}
          </ul>
        )}
        {isOpen && availableOptions.length === 0 && inputValue.trim() !== '' && (
          <div className="attribute-suggestions attribute-suggestions--empty">
            <span>No matches</span>
          </div>
        )}
      </div>
    </div>
  );
};

const SingleSelectAutocomplete: React.FC<SingleSelectAutocompleteProps> = ({
  label,
  options,
  value,
  onChange,
  placeholder = 'Start typing…',
  allowCustom = false,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [inputValue, setInputValue] = useState('');
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const selectedLabel =
      options.find((option) => option.value === value)?.label || value;
    setInputValue(selectedLabel);
  }, [value, options]);

  useOutsideClick(containerRef, () => setIsOpen(false));

  const filteredOptions = options.filter((option) =>
    option.label.toLowerCase().includes(inputValue.toLowerCase())
  );

  const handleSelect = (newValue: string) => {
    onChange(newValue);
    setIsOpen(false);
    if (inputRef.current) {
      inputRef.current.blur();
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter' && allowCustom && inputValue.trim()) {
      event.preventDefault();
      handleSelect(inputValue.trim());
    }
  };

  return (
    <div className="attribute-autocomplete" ref={containerRef}>
      <span className="attribute-group-title">{label}</span>
      <div className="attribute-autocomplete-control">
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={(event) => {
            setInputValue(event.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="attribute-single-input"
        />
        {value && (
          <button
            type="button"
            className="attribute-clear"
            onClick={() => handleSelect('')}
            aria-label={`Clear ${label}`}
          >
            ×
          </button>
        )}
        {isOpen && filteredOptions.length > 0 && (
          <ul className="attribute-suggestions">
            {filteredOptions.map((option) => (
              <li key={option.value}>
                <button
                  type="button"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => handleSelect(option.value)}
                >
                  {option.label}
                </button>
              </li>
            ))}
          </ul>
        )}
        {isOpen && filteredOptions.length === 0 && inputValue.trim() !== '' && (
          <div className="attribute-suggestions attribute-suggestions--empty">
            <span>No matches</span>
          </div>
        )}
      </div>
    </div>
  );
};

export { MultiSelectAutocomplete, SingleSelectAutocomplete };


import React, { useEffect, useMemo, useState } from 'react';
import './EasyItemInputModal.css';
import { Button, SectionHeader } from '../design-system';
import { apiPost } from '../utils/api';

interface EasyItemInputModalProps {
  isOpen: boolean;
  onClose: () => void;
  onItemsCreated: () => void;
}

interface GeneratedItem {
  id: string;
  title: string;
  category: string;
  description?: string;
  createdAt: string;
}

interface BatchCreateResponse {
  createdItems: GeneratedItem[];
  skippedTitles?: string[];
}

const MAX_CHAR_LIMIT = 800;

const exampleText = `I have a soft gray cashmere sweater, relaxed blue jeans, white leather sneakers, a vintage tan trench coat, chunky silver hoop earrings`;

const EasyItemInputModal: React.FC<EasyItemInputModalProps> = ({ isOpen, onClose, onItemsCreated }) => {
  const [inputText, setInputText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successState, setSuccessState] = useState<BatchCreateResponse | null>(null);

  useEffect(() => {
    if (isOpen) {
      setInputText('');
      setIsSubmitting(false);
      setError(null);
      setSuccessState(null);
    }
  }, [isOpen]);

  const characterCount = inputText.length;

  const isSubmitDisabled = useMemo(() => {
    if (isSubmitting) return true;
    if (!inputText.trim()) return true;
    if (characterCount === 0) return true;
    if (characterCount > MAX_CHAR_LIMIT) return true;
    return false;
  }, [characterCount, inputText, isSubmitting]);

  const handleClose = () => {
    if (isSubmitting) return;
    onClose();
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (isSubmitDisabled) return;

    const trimmed = inputText.trim();
    if (!trimmed) {
      setError('Please describe at least one item.');
      return;
    }

    if (trimmed.length > MAX_CHAR_LIMIT) {
      setError('Please shorten your description to 800 characters or less.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const response = await apiPost('/api/items/batch', { text: trimmed });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || 'We could not parse those items. Please try again.');
      }
      const data: BatchCreateResponse = await response.json();
      setSuccessState(data);
      onItemsCreated();
    } catch (submitError) {
      const message =
        submitError instanceof Error ? submitError.message : 'Unexpected error while creating items.';
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) {
    return null;
  }

  return (
    <div className="easy-item-modal-overlay" role="dialog" aria-modal="true">
      <div className="easy-item-modal">
        <SectionHeader title={successState ? 'Items added to your wardrobe' : 'Quick wardrobe entry'} />

        <button className="easy-item-modal__close" onClick={handleClose} aria-label="Close quick entry modal">
          ×
        </button>

        {!successState ? (
          <form className="easy-item-modal__form" onSubmit={handleSubmit}>
            <p className="easy-item-modal__intro">
              Drop in a stream of consciousness list of what you own. We’ll turn everything into wardrobe entries you can refine later.
            </p>

            <label htmlFor="quick-entry-text" className="easy-item-modal__label">
              Describe the pieces you own
            </label>
            <textarea
              id="quick-entry-text"
              value={inputText}
              onChange={(event) => {
                const value = event.target.value;
                if (value.length <= MAX_CHAR_LIMIT) {
                  setInputText(value);
                } else {
                  setInputText(value.slice(0, MAX_CHAR_LIMIT));
                }
              }}
              placeholder={exampleText}
              rows={8}
              disabled={isSubmitting}
            />
            <div className="easy-item-modal__char-count">
              {characterCount}/{MAX_CHAR_LIMIT} characters
            </div>

            {error && <div className="easy-item-modal__error">{error}</div>}

            <div className="easy-item-modal__actions">
              <Button type="button" variant="secondary" onClick={handleClose} disabled={isSubmitting}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitDisabled}>
                {isSubmitting ? 'Creating items...' : 'Add items'}
              </Button>
            </div>

            <div className="easy-item-modal__helper">
              <strong>Need ideas?</strong>
              <ul>
                <li>Comma separated: <em>soft gray cashmere sweater, relaxed blue jeans, white leather sneakers</em></li>
                <li>Dashes: <em>- silk brown blazer<br/>- black flared trousers<br/>- white fedora</em></li>
                <li>One per line:<br/><em>navy striped t-shirt<br/>cream wide-leg trousers<br/>tan suede ankle boots</em></li>
              </ul>
              <p className="easy-item-modal__helper-note">
                <strong>Tip:</strong> The more descriptive cues you include—color, fabric, fit, season, vibe—the smarter the model becomes when generating outfits later.
              </p>
            </div>
          </form>
        ) : (
          <div className="easy-item-modal__result">
            <p className="easy-item-modal__success-message">
              We added {successState.createdItems.length} {successState.createdItems.length === 1 ? 'item' : 'items'} to
              your wardrobe.
            </p>

            <ul className="easy-item-modal__result-list">
              {successState.createdItems.map((item) => (
                <li key={item.id}>
                  <span className="easy-item-modal__result-title">{item.title}</span>
                  <span className="easy-item-modal__result-meta">{item.category}</span>
                  {item.description && <span className="easy-item-modal__result-description">{item.description}</span>}
                </li>
              ))}
            </ul>

            {successState.skippedTitles && successState.skippedTitles.length > 0 && (
              <div className="easy-item-modal__skipped">
                <strong>Skipped:</strong> {successState.skippedTitles.join(', ')}
              </div>
            )}

            <div className="easy-item-modal__actions easy-item-modal__actions--result">
              <Button onClick={handleClose}>Close</Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default EasyItemInputModal;


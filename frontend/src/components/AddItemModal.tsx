import React, { useState } from 'react';
import './AddItemModal.css';
import ProductSearch, { ProductSearchResult } from './ProductSearch';
import EasyItemInputModal from './EasyItemInputModal';
import ItemInput from './ItemInput';
import { apiPost } from '../utils/api';

interface AddItemModalProps {
  isOpen: boolean;
  onClose: () => void;
  onItemAdded: () => void;
  apiUrl: string;
  loading: boolean;
  setLoading: (loading: boolean) => void;
}

type AddMode = 'select' | 'search' | 'batch' | 'manual';

const AddItemModal: React.FC<AddItemModalProps> = ({
  isOpen,
  onClose,
  onItemAdded,
  apiUrl,
  loading,
  setLoading,
}) => {
  const [mode, setMode] = useState<AddMode>('select');

  if (!isOpen) return null;

  const handleProductSelect = async (product: ProductSearchResult) => {
    setLoading(true);
    try {
      const response = await apiPost('/api/items/from-product', { product });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to add product');
      }

      const newItem = await response.json();
      console.log('Product added successfully:', newItem);

      setMode('select');
      onItemAdded();
      onClose();
    } catch (err) {
      console.error('Error adding product:', err);
      alert(err instanceof Error ? err.message : 'Failed to add product');
    } finally {
      setLoading(false);
    }
  };

  const handleItemsCreated = () => {
    setMode('select');
    onItemAdded();
    onClose();
  };

  const handleManualItemAdded = () => {
    setMode('select');
    onItemAdded();
    onClose();
  };

  return (
    <div className="add-item-modal-overlay" onClick={onClose}>
      {loading && (
        <div className="add-item-modal-loading-overlay">
          <div className="add-item-modal-loading-spinner"></div>
          <p>Adding item to wardrobe...</p>
        </div>
      )}
      <div className="add-item-modal-container" onClick={(e) => e.stopPropagation()}>
        {mode === 'select' && (
          <>
            <div className="add-item-modal-header">
              <h2>Add Item to Wardrobe</h2>
              <button className="add-item-modal-close" onClick={onClose}>×</button>
            </div>
            <div className="add-item-modal-options">
              <button
                className="add-item-option"
                onClick={() => setMode('search')}
                disabled={loading}
              >
                <div className="add-item-option-icon">🔍</div>
                <div className="add-item-option-content">
                  <h3>Search Products</h3>
                  <p>Search for products online and add them with automatic metadata</p>
                </div>
              </button>
              <button
                className="add-item-option"
                onClick={() => setMode('batch')}
                disabled={loading}
              >
                <div className="add-item-option-icon">📝</div>
                <div className="add-item-option-content">
                  <h3>Batch Text Input</h3>
                  <p>Paste a list of items and add multiple at once</p>
                </div>
              </button>
              <button
                className="add-item-option"
                onClick={() => setMode('manual')}
                disabled={loading}
              >
                <div className="add-item-option-icon">✏️</div>
                <div className="add-item-option-content">
                  <h3>Add Manually</h3>
                  <p>Fill out the form to add an item with all details</p>
                </div>
              </button>
            </div>
          </>
        )}

        {mode === 'search' && (
          <div className="add-item-modal-content">
            <div className="add-item-modal-header">
              <button className="add-item-modal-back" onClick={() => setMode('select')}>
                ← Back
              </button>
              <h2>Search Products</h2>
              <button className="add-item-modal-close" onClick={onClose}>×</button>
            </div>
            <ProductSearch
              onSelectProduct={handleProductSelect}
              onClose={() => setMode('select')}
            />
          </div>
        )}

        {mode === 'batch' && (
          <div className="add-item-modal-content">
            <div className="add-item-modal-header">
              <button className="add-item-modal-back" onClick={() => setMode('select')}>
                ← Back
              </button>
              <h2>Batch Text Input</h2>
              <button className="add-item-modal-close" onClick={onClose}>×</button>
            </div>
            <div className="add-item-modal-body">
              <EasyItemInputModal
                isOpen={true}
                onClose={() => setMode('select')}
                onItemsCreated={handleItemsCreated}
                apiUrl={apiUrl}
              />
            </div>
          </div>
        )}

        {mode === 'manual' && (
          <div className="add-item-modal-content">
            <div className="add-item-modal-header">
              <button className="add-item-modal-back" onClick={() => setMode('select')}>
                ← Back
              </button>
              <h2>Add Item Manually</h2>
              <button className="add-item-modal-close" onClick={onClose}>×</button>
            </div>
            <div className="add-item-modal-body">
              <ItemInput
                onItemAdded={handleManualItemAdded}
                loading={loading}
                setLoading={setLoading}
                apiUrl={apiUrl}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AddItemModal;


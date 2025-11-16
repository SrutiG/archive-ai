import React, { useState } from 'react';
import './AddItemModal.css';
import ProductSearch, { ProductSearchResult } from './ProductSearch';
import EasyItemInputModal from './EasyItemInputModal';
import ItemInput from './ItemInput';
import { apiPost } from '../utils/api';
import SearchIcon from '@mui/icons-material/Search';
import AddLinkIcon from '@mui/icons-material/AddLink';
import DescriptionIcon from '@mui/icons-material/Description';
import EditIcon from '@mui/icons-material/Edit';
import CloseIcon from '@mui/icons-material/Close';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';

interface AddItemModalProps {
  isOpen: boolean;
  onClose: () => void;
  onItemAdded: () => void;
  apiUrl: string;
  loading: boolean;
  setLoading: (loading: boolean) => void;
}

type AddMode = 'select' | 'search' | 'batch' | 'manual' | 'link';

const AddItemModal: React.FC<AddItemModalProps> = ({
  isOpen,
  onClose,
  onItemAdded,
  apiUrl,
  loading,
  setLoading,
}) => {
  const [mode, setMode] = useState<AddMode>('select');
  const [loadingMessage, setLoadingMessage] = useState<string>('Adding item to wardrobe...');

  if (!isOpen) return null;

  const handleProductSelect = async (product: ProductSearchResult) => {
    setLoadingMessage('Adding item to wardrobe...');
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
          <p>{loadingMessage}</p>
        </div>
      )}
      <div className="add-item-modal-container" onClick={(e) => e.stopPropagation()}>
        {mode === 'select' && (
          <>
            <div className="add-item-modal-header">
              <h2>Add Item to Wardrobe</h2>
              <button className="add-item-modal-close" onClick={onClose}>
                <CloseIcon />
              </button>
            </div>
            <div className="add-item-modal-options">
              <button
                className="add-item-option"
                onClick={() => setMode('search')}
                disabled={loading}
              >
                <div className="add-item-option-icon">
                  <SearchIcon />
                </div>
                <div className="add-item-option-content">
                  <h3>Search Products</h3>
                  <p>Search for products online and add them with automatic metadata</p>
                </div>
              </button>
              <button
                className="add-item-option"
                onClick={() => setMode('link')}
                disabled={loading}
              >
                <div className="add-item-option-icon">
                  <AddLinkIcon />
                </div>
                <div className="add-item-option-content">
                  <h3>Add from Link</h3>
                  <p>Paste a product URL, preview details, then confirm</p>
                </div>
              </button>
              <button
                className="add-item-option"
                onClick={() => setMode('batch')}
                disabled={loading}
              >
                <div className="add-item-option-icon">
                  <DescriptionIcon />
                </div>
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
                <div className="add-item-option-icon">
                  <EditIcon />
                </div>
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
                <ArrowBackIcon /> Back
              </button>
              <h2>Search Products</h2>
              <button className="add-item-modal-close" onClick={onClose}>
                <CloseIcon />
              </button>
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
                <ArrowBackIcon /> Back
              </button>
              <h2>Batch Text Input</h2>
              <button className="add-item-modal-close" onClick={onClose}>
                <CloseIcon />
              </button>
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
                <ArrowBackIcon /> Back
              </button>
              <h2>Add Item Manually</h2>
              <button className="add-item-modal-close" onClick={onClose}>
                <CloseIcon />
              </button>
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

        {mode === 'link' && (
          <AddFromLink
            onBack={() => setMode('select')}
            onClose={onClose}
            onSelectProduct={handleProductSelect}
            loading={loading}
            setLoading={setLoading}
            setLoadingMessage={setLoadingMessage}
          />
        )}
      </div>
    </div>
  );
};

export default AddItemModal;

interface AddFromLinkProps {
  onBack: () => void;
  onClose: () => void;
  onSelectProduct: (p: ProductSearchResult) => void;
  loading: boolean;
  setLoading: (b: boolean) => void;
  setLoadingMessage: (message: string) => void;
}

const AddFromLink: React.FC<AddFromLinkProps> = ({ onBack, onClose, onSelectProduct, loading, setLoading, setLoadingMessage }) => {
  const [url, setUrl] = React.useState('');
  const [product, setProduct] = React.useState<ProductSearchResult | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const handleFetch = async () => {
    setError(null);
    setProduct(null);
    if (!url || !/^https?:\/\//i.test(url)) {
      setError('Please enter a valid URL (http/https).');
      return;
    }
    setLoadingMessage('Fetching product...');
    setLoading(true);
    try {
      const resp = await apiPost('/api/products/ingest-url', { url });
      if (!resp.ok) {
        const data = await resp.json();
        throw new Error(data.error || 'Failed to scrape product');
      }
      const data = await resp.json();
      setProduct(data.product as ProductSearchResult);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to scrape product');
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = async () => {
    if (!product) return;
    await onSelectProduct(product);
  };

  return (
    <div className="add-item-modal-content">
      <div className="add-item-modal-header">
        <button className="add-item-modal-back" onClick={onBack}>
          <ArrowBackIcon /> Back
        </button>
        <h2>Add from Link</h2>
        <button className="add-item-modal-close" onClick={onClose}>
          <CloseIcon />
        </button>
      </div>
      <div className="add-item-modal-body">
        <div style={{ display: 'flex', gap: '8px' }}>
          <input
            type="url"
            placeholder="Paste product URL (e.g., https://everlane.com/...)"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            className="product-search-input"
            disabled={loading}
            style={{ flex: 1 }}
          />
          <button onClick={handleFetch} disabled={loading || !url}>Fetch</button>
        </div>
        {error && <div className="product-search-error" style={{ marginTop: 8 }}>{error}</div>}
        {product && (
          <div className="product-search-result" style={{ marginTop: 12 }}>
            {product.imageUrl && (
              <img
                src={product.imageUrl}
                alt={product.title}
                className="product-search-result-image"
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
              />
            )}
            <div className="product-search-result-content">
              <div className="product-search-result-title">
                {product.brand && <span className="product-search-result-brand">{product.brand}</span>}
                {product.title}
              </div>
              {product.description && (
                <div className="product-search-result-description">
                  {product.description.substring(0, 160)}{product.description.length > 160 ? '...' : ''}
                </div>
              )}
              {product.colors && product.colors.length > 0 && (
                <div className="product-search-result-tags">Colors: {product.colors.join(', ')}</div>
              )}
              <div style={{ marginTop: 8, display: 'flex', gap: 8, justifyContent: 'space-between', alignItems: 'center' }}>
                <a href={product.productUrl} target="_blank" rel="noreferrer">Open link</a>
                <button onClick={handleConfirm} disabled={loading}>Confirm & Add</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};


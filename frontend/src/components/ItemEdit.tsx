import React, { useState, useRef, useEffect } from 'react';
import './ItemInput.css';
import { WardrobeItem } from '../App';

interface ItemEditProps {
  item: WardrobeItem;
  onItemUpdated: () => void;
  onCancel: () => void;
  apiUrl: string;
}

interface Measurements {
  size?: string;
  waist?: number;
  inseam?: number;
  chest?: number;
  length?: number;
  shoeSize?: string;
  [key: string]: string | number | undefined;
}

const ItemEdit: React.FC<ItemEditProps> = ({ item, onItemUpdated, onCancel, apiUrl }) => {
  const [title, setTitle] = useState(item.title);
  const [category, setCategory] = useState(item.category);
  const [description, setDescription] = useState(item.description || '');
  const [categories, setCategories] = useState<string[]>([]);
  const [photo, setPhoto] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [measurements, setMeasurements] = useState<Measurements>(item.measurements || {});
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [isCameraOpen, setIsCameraOpen] = useState(false);

  // Fetch categories on mount
  useEffect(() => {
    fetch(`${apiUrl}/api/categories`)
      .then(res => res.json())
      .then(data => setCategories(data))
      .catch(err => console.error('Error fetching categories:', err));
  }, [apiUrl]);

  // Set initial preview to existing image
  useEffect(() => {
    if (item.imageUrl) {
      setPreview(`${apiUrl}${item.imageUrl}`);
    }
  }, [item.imageUrl, apiUrl]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setPhoto(file);
      setError(null);
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const openCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'environment' }
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setIsCameraOpen(true);
      }
    } catch (err) {
      console.error('Error accessing camera:', err);
      setError('Could not access camera. Please check permissions.');
    }
  };

  const closeCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setIsCameraOpen(false);
  };

  const capturePhoto = () => {
    if (videoRef.current) {
      const canvas = document.createElement('canvas');
      canvas.width = videoRef.current.videoWidth;
      canvas.height = videoRef.current.videoHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(videoRef.current, 0, 0);
        canvas.toBlob((blob) => {
          if (blob) {
            const file = new File([blob], 'photo.jpg', { type: 'image/jpeg' });
            setPhoto(file);
            setPreview(canvas.toDataURL());
            closeCamera();
          }
        }, 'image/jpeg', 0.8);
      }
    }
  };

  const updateMeasurement = (key: string, value: string | number) => {
    setMeasurements(prev => {
      const updated = { ...prev };
      if (value === '' || value === null || value === undefined) {
        delete updated[key];
      } else {
        updated[key] = typeof value === 'string' && !isNaN(Number(value)) && key !== 'size' && key !== 'shoeSize'
          ? Number(value)
          : value;
      }
      return updated;
    });
  };

  const getMeasurementFields = () => {
    const fields: JSX.Element[] = [];
    
    // Common fields
    fields.push(
      <div key="size" className="measurement-field">
        <label>Size (e.g., S, M, L, XL)</label>
        <input
          type="text"
          value={measurements.size || ''}
          onChange={(e) => updateMeasurement('size', e.target.value)}
          placeholder="S, M, L, XL..."
          disabled={loading}
        />
      </div>
    );

    // Category-specific fields
    if (['Tops', 'Outerwear'].includes(category)) {
      fields.push(
        <div key="chest" className="measurement-field">
          <label>Chest (inches)</label>
          <input
            type="number"
            step="0.5"
            value={measurements.chest || ''}
            onChange={(e) => updateMeasurement('chest', e.target.value)}
            placeholder="38"
            disabled={loading}
          />
        </div>
      );
      fields.push(
        <div key="length" className="measurement-field">
          <label>Length (inches)</label>
          <input
            type="number"
            step="0.5"
            value={measurements.length || ''}
            onChange={(e) => updateMeasurement('length', e.target.value)}
            placeholder="28"
            disabled={loading}
          />
        </div>
      );
    }

    if (['Bottoms', 'Dresses'].includes(category)) {
      fields.push(
        <div key="waist" className="measurement-field">
          <label>Waist (inches)</label>
          <input
            type="number"
            step="0.5"
            value={measurements.waist || ''}
            onChange={(e) => updateMeasurement('waist', e.target.value)}
            placeholder="32"
            disabled={loading}
          />
        </div>
      );
      if (category === 'Bottoms') {
        fields.push(
          <div key="inseam" className="measurement-field">
            <label>Inseam (inches)</label>
            <input
              type="number"
              step="0.5"
              value={measurements.inseam || ''}
              onChange={(e) => updateMeasurement('inseam', e.target.value)}
              placeholder="32"
              disabled={loading}
            />
          </div>
        );
      }
      fields.push(
        <div key="length" className="measurement-field">
          <label>Length (inches)</label>
          <input
            type="number"
            step="0.5"
            value={measurements.length || ''}
            onChange={(e) => updateMeasurement('length', e.target.value)}
            placeholder="28"
            disabled={loading}
          />
        </div>
      );
    }

    if (category === 'Shoes') {
      fields.push(
        <div key="shoeSize" className="measurement-field">
          <label>Shoe Size (e.g., 9, 10.5, 42 EU)</label>
          <input
            type="text"
            value={measurements.shoeSize || ''}
            onChange={(e) => updateMeasurement('shoeSize', e.target.value)}
            placeholder="9 or 42 EU"
            disabled={loading}
          />
        </div>
      );
    }

    return fields;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!title.trim()) {
      setError('Please enter a title');
      return;
    }

    if (!category) {
      setError('Please select a category');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const formData = new FormData();
      if (photo) {
        formData.append('photo', photo);
      }
      formData.append('title', title);
      formData.append('category', category);
      if (description.trim()) {
        formData.append('description', description);
      }
      if (Object.keys(measurements).length > 0) {
        formData.append('measurements', JSON.stringify(measurements));
      }

      const response = await fetch(`${apiUrl}/api/items/${item.id}`, {
        method: 'PUT',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update item');
      }

      const updatedItem = await response.json();
      console.log('Item updated successfully:', updatedItem);

      onItemUpdated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update item');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="ItemInput">
      <div className="edit-header">
        <h2>Edit Item</h2>
        <button onClick={onCancel} className="btn btn-secondary" disabled={loading}>
          Cancel
        </button>
      </div>
      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label htmlFor="title">Item Title *</label>
          <input
            type="text"
            id="title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g., Blue Denim Jacket"
            disabled={loading}
            required
          />
        </div>

        <div className="form-group">
          <label htmlFor="category">Category *</label>
          <select
            id="category"
            value={category}
            onChange={(e) => {
              setCategory(e.target.value);
              // Reset measurements when category changes
              if (e.target.value !== item.category) {
                setMeasurements({});
              }
            }}
            disabled={loading}
            required
          >
            <option value="">Select a category</option>
            {categories.map(cat => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
        </div>

        <div className="form-group">
          <label htmlFor="description">Description</label>
          <textarea
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe the item (color, style, fabric, etc.) - this helps with outfit generation"
            rows={3}
            disabled={loading}
          />
        </div>

        {category && (
          <div className="form-group">
            <label>Measurements (Optional)</label>
            <div className="measurements-grid">
              {getMeasurementFields()}
            </div>
          </div>
        )}

        <div className="form-group">
          <label>Photo {photo ? '(New photo selected)' : '(Current photo - optional to change)'}</label>
          <div className="photo-options">
            {!isCameraOpen && (
              <>
                <button
                  type="button"
                  onClick={openCamera}
                  className="btn btn-secondary"
                  disabled={loading}
                >
                  📷 Take New Photo
                </button>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="btn btn-secondary"
                  disabled={loading}
                >
                  📁 Choose New File
                </button>
              </>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileSelect}
              style={{ display: 'none' }}
            />
          </div>

          {isCameraOpen && (
            <div className="camera-container">
              <video ref={videoRef} autoPlay playsInline className="camera-video" />
              <div className="camera-controls">
                <button
                  type="button"
                  onClick={capturePhoto}
                  className="btn btn-primary capture-btn"
                >
                  Capture
                </button>
                <button
                  type="button"
                  onClick={closeCamera}
                  className="btn btn-secondary"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {preview && !isCameraOpen && (
            <div className="preview-container">
              <img src={preview} alt="Preview" className="preview-image" />
              <button
                type="button"
                onClick={() => {
                  setPreview(photo ? null : `${apiUrl}${item.imageUrl}`);
                  setPhoto(null);
                  if (fileInputRef.current) {
                    fileInputRef.current.value = '';
                  }
                }}
                className="btn btn-small"
              >
                {photo ? 'Remove New Photo' : 'Keep Current Photo'}
              </button>
            </div>
          )}
        </div>

        {error && <div className="error-message">{error}</div>}

        <div className="form-actions">
          <button
            type="button"
            onClick={onCancel}
            className="btn btn-secondary"
            disabled={loading}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="btn btn-primary"
            disabled={loading || !title.trim() || !category}
          >
            {loading ? 'Updating...' : 'Update Item'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default ItemEdit;


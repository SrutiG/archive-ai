import React, { useState, useRef, useEffect } from 'react';
import './ItemInput.css';
import { WardrobeItem } from '../App';
import { SectionHeader, Button } from '../design-system';
import { getMeasurementFields, Measurements as MeasurementsType } from '../utils/measurementFields';
import { useCamera } from '../hooks/useCamera';

interface ItemEditProps {
  item: WardrobeItem;
  onItemUpdated: () => void;
  onCancel: () => void;
  apiUrl: string;
}

type Measurements = MeasurementsType;

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
  
  const {
    isCameraOpen,
    isVideoReady,
    countdown,
    videoRef,
    openCamera,
    closeCamera,
    startCapture,
    handleVideoReady,
    error: cameraError,
    setError: setCameraError
  } = useCamera();
  
  // Merge camera errors with component errors
  useEffect(() => {
    if (cameraError) {
      setError(cameraError);
    }
  }, [cameraError]);

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

  const handleCapturePhoto = () => {
    startCapture((file: File, dataUrl: string) => {
      setPhoto(file);
      setPreview(dataUrl);
      setError(null);
      closeCamera();
    });
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
        <SectionHeader title="Edit Item" />
        <Button variant="secondary" size="medium" onClick={onCancel} disabled={loading}>
          Cancel
        </Button>
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
              {getMeasurementFields({
                category,
                measurements,
                updateMeasurement,
                loading
              })}
            </div>
          </div>
        )}

        <div className="form-group">
          <label>Photo {photo ? '(New photo selected)' : '(Current photo - optional to change)'}</label>
          <div className="photo-options">
            {!isCameraOpen && (
              <>
                <Button
                  type="button"
                  variant="secondary"
                  size="medium"
                  onClick={openCamera}
                  disabled={loading}
                >
                  📷 Take New Photo
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  size="medium"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={loading}
                >
                  📁 Choose New File
                </Button>
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
              <video 
                ref={videoRef} 
                autoPlay 
                playsInline 
                className="camera-video"
                onLoadedMetadata={handleVideoReady}
              />
              {countdown !== null && (
                <div className="countdown-overlay">
                  <div className="countdown-number">{countdown}</div>
                </div>
              )}
              <div className="camera-controls">
                <Button
                  type="button"
                  variant="primary"
                  size="medium"
                  onClick={handleCapturePhoto}
                  className="capture-btn"
                  disabled={!isVideoReady || countdown !== null}
                >
                  {countdown !== null ? `Capturing in ${countdown}...` : isVideoReady ? 'Capture' : 'Loading...'}
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  size="medium"
                  onClick={closeCamera}
                  disabled={countdown !== null}
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}

          {preview && !isCameraOpen && (
            <div className="preview-container">
              <img src={preview} alt="Preview" className="preview-image" />
              <Button
                type="button"
                variant="secondary"
                size="small"
                onClick={() => {
                  setPreview(photo ? null : `${apiUrl}${item.imageUrl}`);
                  setPhoto(null);
                  if (fileInputRef.current) {
                    fileInputRef.current.value = '';
                  }
                }}
              >
                {photo ? 'Remove New Photo' : 'Keep Current Photo'}
              </Button>
            </div>
          )}
        </div>

        {error && <div className="error-message">{error}</div>}

        <div className="form-actions">
          <Button
            type="button"
            variant="secondary"
            size="medium"
            onClick={onCancel}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            size="medium"
            disabled={loading || !title.trim() || !category}
          >
            {loading ? 'Updating...' : 'Update Item'}
          </Button>
        </div>
      </form>
    </div>
  );
};

export default ItemEdit;


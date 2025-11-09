import React, { useState, useRef, useEffect } from 'react';
import './ItemInput.css';
import { WardrobeItem } from '../App';
import { SectionHeader, Button } from '../design-system';
import { getMeasurementFields, Measurements as MeasurementsType } from '../utils/measurementFields';
import { useCamera } from '../hooks/useCamera';
import { apiGet, apiUpload } from '../utils/api';
import WardrobeAttributeFields from './WardrobeAttributeFields';

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
  const [subCategory, setSubCategory] = useState(item.subCategory || '');
  const [description, setDescription] = useState(item.description || '');
  const [categories, setCategories] = useState<string[]>([]);
  const [subcategories, setSubcategories] = useState<Record<string, string[]>>({});
  const [photo, setPhoto] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [previewLoaded, setPreviewLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [measurements, setMeasurements] = useState<Measurements>(item.measurements || {});
  const [selectedColors, setSelectedColors] = useState<string[]>(item.colors || []);
  const [selectedFabrics, setSelectedFabrics] = useState<string[]>(item.fabrics || []);
  const [selectedSilhouettes, setSelectedSilhouettes] = useState<string[]>(
    item.silhouettes && item.silhouettes.length > 0
      ? item.silhouettes
      : item.silhouette
      ? [item.silhouette]
      : []
  );
  const [selectedFormalities, setSelectedFormalities] = useState<string[]>(item.formalities || []);
  const [selectedStyleTags, setSelectedStyleTags] = useState<string[]>(item.styleTags || []);
  const [selectedSeasons, setSelectedSeasons] = useState<string[]>(item.seasons || []);
  const [selectedOccasions, setSelectedOccasions] = useState<string[]>(item.occasions || []);
  const [pattern, setPattern] = useState(item.pattern || '');
  const [fit, setFit] = useState(item.fit || '');
  const [brand, setBrand] = useState(item.brand || '');
  const [careNotes, setCareNotes] = useState(item.careNotes || '');
  const [showDetails, setShowDetails] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    setSelectedColors(item.colors || []);
    setSelectedFabrics(item.fabrics || []);
    setSelectedSilhouettes(
      item.silhouettes && item.silhouettes.length > 0
        ? item.silhouettes
        : item.silhouette
        ? [item.silhouette]
        : []
    );
    setSelectedFormalities(item.formalities || []);
    setSelectedStyleTags(item.styleTags || []);
    setSelectedSeasons(item.seasons || []);
    setSelectedOccasions(item.occasions || []);
    setPattern(item.pattern || '');
    setFit(item.fit || '');
    setBrand(item.brand || '');
    setCareNotes(item.careNotes || '');
  }, [item]);

  
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
    setError: _setCameraError
  } = useCamera();
  
  // Merge camera errors with component errors
  useEffect(() => {
    if (cameraError) {
      setError(cameraError);
    }
  }, [cameraError]);

  // Fetch categories on mount
  useEffect(() => {
    Promise.all([apiGet('/api/categories'), apiGet('/api/subcategories')])
      .then(async ([categoriesRes, subcategoriesRes]) => {
        const [categoriesData, subcategoriesData] = await Promise.all([
          categoriesRes.json(),
          subcategoriesRes.json()
        ]);
        setCategories(categoriesData);
        setSubcategories(subcategoriesData);
      })
      .catch(err => console.error('Error fetching categories or subcategories:', err));
  }, []);

  useEffect(() => {
    if (!category || subCategory) {
      return;
    }
    const options = subcategories[category];
    if (options && options.length > 0) {
      const defaultOption = options.find(option => option.toLowerCase() !== 'other');
      if (defaultOption) {
        setSubCategory(defaultOption);
      }
    }
  }, [category, subCategory, subcategories]);

  // Set initial preview to existing image only if it exists
  // But don't show preview until image successfully loads (to avoid showing placeholders)
  useEffect(() => {
    if (item.imageUrl) {
      // If imageUrl is already a full URL (http:// or https://), use it directly
      // Otherwise, prepend apiUrl for local paths
      const imgUrl = (item.imageUrl.startsWith('http://') || item.imageUrl.startsWith('https://'))
        ? item.imageUrl
        : `${apiUrl}${item.imageUrl}`;
      setPreview(imgUrl);
      setPreviewLoaded(false); // Reset loaded state when imageUrl changes
      
      // Test if image loads successfully
      const img = new Image();
      img.onload = () => {
        // Only show preview if image is larger than 1x1 (likely not a placeholder)
        if (img.width > 1 && img.height > 1) {
          setPreviewLoaded(true);
        } else {
          setPreview(null);
          setPreviewLoaded(false);
        }
      };
      img.onerror = () => {
        // Image failed to load, don't show preview
        setPreview(null);
        setPreviewLoaded(false);
      };
      img.src = imgUrl;
    } else {
      // Clear preview if no image exists
      setPreview(null);
      setPreviewLoaded(false);
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
        setPreviewLoaded(true); // User-selected photos always show
      };
      reader.readAsDataURL(file);
    }
  };

  const handleCapturePhoto = () => {
    startCapture((file: File, dataUrl: string) => {
      setPhoto(file);
      setPreview(dataUrl);
      setPreviewLoaded(true); // Camera photos always show
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
      if (subCategory) {
        formData.append('subCategory', subCategory);
      }
      if (description.trim()) {
        formData.append('description', description);
      }
      formData.append('colors', JSON.stringify(selectedColors));
      formData.append('fabrics', JSON.stringify(selectedFabrics));
      formData.append('formalities', JSON.stringify(selectedFormalities));
      formData.append('styleTags', JSON.stringify(selectedStyleTags));
      formData.append('seasons', JSON.stringify(selectedSeasons));
      formData.append('occasions', JSON.stringify(selectedOccasions));
      formData.append('pattern', pattern);
    formData.append('silhouettes', JSON.stringify(selectedSilhouettes));
      formData.append('fit', fit);
      if (showDetails || brand) {
        formData.append('brand', brand);
      }
      if (showDetails || careNotes || item.careNotes) {
        formData.append('careNotes', careNotes);
      }
      if (Object.keys(measurements).length > 0) {
        formData.append('measurements', JSON.stringify(measurements));
      }

      const response = await apiUpload(`/api/items/${item.id}`, formData, 'PUT');

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
              const nextCategory = e.target.value;
              if (nextCategory === category) {
                return;
              }
              setCategory(nextCategory);
              // Reset measurements when category changes
              if (nextCategory !== item.category) {
                setMeasurements({});
              }
              const options = subcategories[nextCategory] || [];
              const defaultOption = options.find(option => option.toLowerCase() !== 'other');
              setSubCategory(defaultOption || '');
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

        {category && (
          <div className="form-group">
            <label htmlFor="subCategory">Sub-category</label>
            <select
              id="subCategory"
              value={subCategory}
              onChange={(e) => setSubCategory(e.target.value)}
              disabled={loading}
            >
              <option value="">Select a sub-category</option>
              {(subcategories[category] || ['Other']).map(option => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>
        )}

        <WardrobeAttributeFields
          category={category}
          subCategory={subCategory}
          showDetails={showDetails}
          onToggleDetails={() => setShowDetails(prev => !prev)}
          selectedColors={selectedColors}
          onColorsChange={setSelectedColors}
          selectedFabrics={selectedFabrics}
          onFabricsChange={setSelectedFabrics}
          selectedSilhouettes={selectedSilhouettes}
          onSilhouettesChange={setSelectedSilhouettes}
          selectedFormalities={selectedFormalities}
          onFormalitiesChange={setSelectedFormalities}
          selectedStyleTags={selectedStyleTags}
          onStyleTagsChange={setSelectedStyleTags}
          selectedSeasons={selectedSeasons}
          onSeasonsChange={setSelectedSeasons}
          selectedOccasions={selectedOccasions}
          onOccasionsChange={setSelectedOccasions}
          pattern={pattern}
          onPatternChange={setPattern}
          fit={fit}
          onFitChange={setFit}
          brand={brand}
          onBrandChange={setBrand}
          careNotes={careNotes}
          onCareNotesChange={setCareNotes}
        />

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

          {preview && previewLoaded && !isCameraOpen && (
            <div className="preview-container">
              <img 
                src={preview} 
                alt="Preview" 
                className="preview-image"
                onError={() => {
                  // If preview image fails to load, hide preview
                  setPreview(null);
                  setPreviewLoaded(false);
                }}
              />
              <Button
                type="button"
                variant="secondary"
                size="small"
                onClick={() => {
                  if (photo) {
                    // Remove new photo selection
                    setPreview(null);
                    setPreviewLoaded(false);
                    setPhoto(null);
                    if (fileInputRef.current) {
                      fileInputRef.current.value = '';
                    }
                  } else {
                    // Remove existing photo
                    setPreview(null);
                    setPreviewLoaded(false);
                  }
                }}
              >
                {photo ? 'Remove New Photo' : 'Remove Photo'}
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


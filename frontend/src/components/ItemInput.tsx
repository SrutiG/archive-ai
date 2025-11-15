import React, { useState, useRef, useEffect } from 'react';
import './ItemInput.css';
import { SectionHeader, Button } from '../design-system';
import { getMeasurementFields, Measurements as MeasurementsType } from '../utils/measurementFields';
import { useCamera } from '../hooks/useCamera';
import { apiGet, apiUpload } from '../utils/api';
import WardrobeAttributeFields from './WardrobeAttributeFields';

interface ItemInputProps {
  onItemAdded: () => void;
  loading: boolean;
  setLoading: (loading: boolean) => void;
  apiUrl: string;
}

type Measurements = MeasurementsType;

const ItemInput: React.FC<ItemInputProps> = ({ onItemAdded, loading, setLoading, apiUrl: _apiUrl }) => {
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('');
  const [subCategory, setSubCategory] = useState('');
  const [description, setDescription] = useState('');
  const [categories, setCategories] = useState<string[]>([]);
  const [subcategories, setSubcategories] = useState<Record<string, string[]>>({});
  const [photo, setPhoto] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [measurements, setMeasurements] = useState<Measurements>({});
  const [showDetails, setShowDetails] = useState(false);
  const [selectedColors, setSelectedColors] = useState<string[]>([]);
  const [selectedFabrics, setSelectedFabrics] = useState<string[]>([]);
  const [selectedSilhouettes, setSelectedSilhouettes] = useState<string[]>([]);
  const [selectedFormalities, setSelectedFormalities] = useState<string[]>([]);
  const [selectedStyleTags, setSelectedStyleTags] = useState<string[]>([]);
  const [selectedSeasons, setSelectedSeasons] = useState<string[]>([]);
  const [selectedOccasions, setSelectedOccasions] = useState<string[]>([]);
  const [pattern, setPattern] = useState('');
  const [fit, setFit] = useState('');
  const [brand, setBrand] = useState('');
  const [careNotes, setCareNotes] = useState('');
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
    apiGet('/api/categories')
      .then(res => res.json())
      .then(data => setCategories(data))
      .catch(err => console.error('Error fetching categories:', err));
    apiGet('/api/subcategories')
      .then(res => res.json())
      .then(data => setSubcategories(data))
      .catch(err => console.error('Error fetching subcategories:', err));
  }, []);

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
      if (subCategory) {
        formData.append('subCategory', subCategory);
      }
      if (description.trim()) {
        formData.append('description', description);
      }
      if (selectedColors.length > 0) {
        formData.append('colors', JSON.stringify(selectedColors));
      }
      if (selectedFabrics.length > 0) {
        formData.append('fabrics', JSON.stringify(selectedFabrics));
      }
      if (selectedSilhouettes.length > 0) {
        formData.append('silhouettes', JSON.stringify(selectedSilhouettes));
      }
      if (selectedFormalities.length > 0) {
        formData.append('formalities', JSON.stringify(selectedFormalities));
      }
      if (selectedStyleTags.length > 0) {
        formData.append('styleTags', JSON.stringify(selectedStyleTags));
      }
      if (selectedSeasons.length > 0) {
        formData.append('seasons', JSON.stringify(selectedSeasons));
      }
      if (selectedOccasions.length > 0) {
        formData.append('occasions', JSON.stringify(selectedOccasions));
      }
      if (pattern) {
        formData.append('pattern', pattern);
      }
      if (fit) {
        formData.append('fit', fit);
      }
      if (brand) {
        formData.append('brand', brand);
      }
      if (careNotes.trim()) {
        formData.append('careNotes', careNotes.trim());
      }
      if (Object.keys(measurements).length > 0) {
        formData.append('measurements', JSON.stringify(measurements));
      }

      const response = await apiUpload('/api/items', formData);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to add item');
      }

      const newItem = await response.json();
      console.log('Item added successfully:', newItem);

      // Reset form
      setTitle('');
      setCategory('');
      setSubCategory('');
      setDescription('');
      setMeasurements({});
      setPhoto(null);
      setPreview(null);
      setSelectedColors([]);
      setSelectedFabrics([]);
      setSelectedSilhouettes([]);
      setSelectedFormalities([]);
      setSelectedStyleTags([]);
      setSelectedSeasons([]);
      setSelectedOccasions([]);
      setPattern('');
      setFit('');
      setBrand('');
      setCareNotes('');
      setShowDetails(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      
      setTimeout(() => {
        onItemAdded();
      }, 100);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add item');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="ItemInput">
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
              setMeasurements({}); // Reset measurements when category changes
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
              {(subcategories[category] || ['Other']).map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>
        )}

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
              }).map((field, index) => (
                <React.Fragment key={index}>{field}</React.Fragment>
              ))}
            </div>
          </div>
        )}

        <div className="form-group">
          <label>Photo (Optional)</label>
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
                  📷 Take Photo
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  size="medium"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={loading}
                >
                  📁 Choose File
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
                  setPreview(null);
                  setPhoto(null);
                  if (fileInputRef.current) {
                    fileInputRef.current.value = '';
                  }
                }}
              >
                Remove
              </Button>
            </div>
          )}
        </div>

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
          pattern={pattern}
          onPatternChange={setPattern}
          selectedFormalities={selectedFormalities}
          onFormalitiesChange={setSelectedFormalities}
          selectedStyleTags={selectedStyleTags}
          onStyleTagsChange={setSelectedStyleTags}
          selectedSeasons={selectedSeasons}
          onSeasonsChange={setSelectedSeasons}
          selectedOccasions={selectedOccasions}
          onOccasionsChange={setSelectedOccasions}
          fit={fit}
          onFitChange={setFit}
          brand={brand}
          onBrandChange={setBrand}
          careNotes={careNotes}
          onCareNotesChange={setCareNotes}
        />

        {error && <div className="error-message">{error}</div>}

        <Button
          type="submit"
          variant="primary"
          size="medium"
          disabled={loading || !title.trim() || !category}
        >
          {loading ? 'Adding...' : 'Add Item'}
        </Button>
      </form>
    </div>
  );
};

export default ItemInput;
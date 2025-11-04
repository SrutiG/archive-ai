import React, { useState, useRef } from 'react';
import './ItemInput.css';

interface ItemInputProps {
  onItemAdded: () => void;
  loading: boolean;
  setLoading: (loading: boolean) => void;
  apiUrl: string;
}

const ItemInput: React.FC<ItemInputProps> = ({ onItemAdded, loading, setLoading, apiUrl }) => {
  const [title, setTitle] = useState('');
  const [photo, setPhoto] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [isCameraOpen, setIsCameraOpen] = useState(false);

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
        video: { facingMode: 'environment' } // Use back camera on mobile
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!title.trim()) {
      setError('Please enter a title');
      return;
    }

    if (!photo) {
      setError('Please take or select a photo');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('photo', photo);
      formData.append('title', title);

      const response = await fetch(`${apiUrl}/api/items`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to add item');
      }

      const newItem = await response.json();
      console.log('Item added successfully:', newItem);

      // Reset form
      setTitle('');
      setPhoto(null);
      setPreview(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      
      // Wait a moment to ensure backend has processed, then refresh
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
      <h2>Add New Item</h2>
      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label htmlFor="title">Item Title</label>
          <input
            type="text"
            id="title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g., Blue Denim Jacket"
            disabled={loading}
          />
        </div>

        <div className="form-group">
          <label>Photo</label>
          <div className="photo-options">
            {!isCameraOpen && (
              <>
                <button
                  type="button"
                  onClick={openCamera}
                  className="btn btn-secondary"
                  disabled={loading}
                >
                  📷 Take Photo
                </button>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="btn btn-secondary"
                  disabled={loading}
                >
                  📁 Choose File
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
                  setPreview(null);
                  setPhoto(null);
                  if (fileInputRef.current) {
                    fileInputRef.current.value = '';
                  }
                }}
                className="btn btn-small"
              >
                Remove
              </button>
            </div>
          )}
        </div>

        {error && <div className="error-message">{error}</div>}

        <button
          type="submit"
          className="btn btn-primary"
          disabled={loading || !title.trim() || !photo}
        >
          {loading ? 'Adding...' : 'Add Item'}
        </button>
      </form>
    </div>
  );
};

export default ItemInput;

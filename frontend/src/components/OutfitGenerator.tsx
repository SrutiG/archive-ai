import React, { useState, useEffect } from 'react';
import './OutfitGenerator.css';
import { WardrobeItem } from '../App';
import { getPlaceholderImage } from '../utils/placeholderImages';
import StockPhotoImage from './StockPhotoImage';

interface OutfitGeneratorProps {
  items: WardrobeItem[];
  apiUrl: string;
}

interface OutfitStatus {
  clicksUsed: number;
  maxClicks: number;
  remaining: number;
}

const OutfitGenerator: React.FC<OutfitGeneratorProps> = ({ items, apiUrl }) => {
  const [outfits, setOutfits] = useState<string[][]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<OutfitStatus | null>(null);

  const fetchStatus = async () => {
    try {
      const response = await fetch(`${apiUrl}/api/outfits/status`);
      const data = await response.json();
      setStatus(data);
    } catch (err) {
      console.error('Error fetching status:', err);
    }
  };

  useEffect(() => {
    fetchStatus();
  }, []);

  const handleGenerate = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${apiUrl}/api/outfits/generate`, {
        method: 'POST',
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to generate outfits');
      }

      setOutfits(data.outfits || []);
      setStatus({
        clicksUsed: data.clicksUsed,
        maxClicks: data.maxClicks,
        remaining: data.maxClicks - data.clicksUsed,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate outfits');
    } finally {
      setLoading(false);
      fetchStatus();
    }
  };

  // Check if we have enough items in different categories
  const itemsByCategory = items.reduce((acc, item) => {
    if (!acc[item.category]) {
      acc[item.category] = [];
    }
    acc[item.category].push(item);
    return acc;
  }, {} as Record<string, WardrobeItem[]>);

  const categoryCount = Object.keys(itemsByCategory).length;
  const canGenerate = categoryCount >= 2 && items.length >= 2;

  return (
    <div className="OutfitGenerator">
      <div className="OutfitGenerator-header">
        <h2>Outfit Generator</h2>
        {status && (
          <div className="status-badge">
            <span className="status-text">
              {status.remaining} / {status.maxClicks} clicks remaining today
            </span>
          </div>
        )}
      </div>

      {!canGenerate ? (
        <div className="info-message">
          <p>
            {categoryCount < 2
              ? 'Add items from at least 2 different categories to generate outfits.'
              : 'Add at least 2 items to generate outfits.'}
          </p>
          <p className="current-stats">
            Current: {items.length} items in {categoryCount} categories
          </p>
        </div>
      ) : (
        <>
          <button
            className="btn btn-primary generate-btn"
            onClick={handleGenerate}
            disabled={loading || (status?.remaining ?? 0) <= 0}
          >
            {loading
              ? 'Generating Outfits...'
              : status?.remaining === 0
              ? 'Daily Limit Reached'
              : 'Generate Outfit Combinations'}
          </button>

          {error && <div className="error-message">{error}</div>}

          {outfits.length > 0 && (
            <div className="outfits-container">
              <h3>Generated Outfits ({outfits.length})</h3>
              <div className="outfits-list">
                {outfits.map((outfit, index) => (
                  <div key={index} className="outfit-card">
                    <div className="outfit-number">Outfit {index + 1}</div>
                    <div className="outfit-items">
                      {outfit.map((itemTitle, itemIndex) => {
                        const item = items.find((i) => i.title === itemTitle);
                        return (
                          <div key={itemIndex} className="outfit-item">
                            {item ? (
                              <>
                                <StockPhotoImage
                                  item={item}
                                  apiUrl={apiUrl}
                                  alt={itemTitle}
                                  className="outfit-item-image"
                                />
                                <span className="outfit-item-title">{itemTitle}</span>
                              </>
                            ) : (
                              <span className="outfit-item-title">{itemTitle}</span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default OutfitGenerator;

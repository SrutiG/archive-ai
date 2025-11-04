import React, { useState, useEffect } from 'react';
import './OutfitsPage.css';
import { WardrobeItem } from '../App';
import FeedbackModal from '../components/FeedbackModal';

interface OutfitsPageProps {
  apiUrl: string;
}

interface GeneratedOutfit {
  itemTitles: string[];
}

interface SavedOutfit {
  id: string;
  itemTitles: string[];
  createdAt: string;
  prompt?: string;
  notes?: string;
}

interface OutfitStatus {
  clicksUsed: number;
  maxClicks: number;
  remaining: number;
}

interface OutfitFeedback {
  id: string;
  itemTitles: string[];
  type: 'like' | 'dislike';
  feedback?: string;
  createdAt: string;
  prompt?: string;
}

const OutfitsPage: React.FC<OutfitsPageProps> = ({ apiUrl }) => {
  const [items, setItems] = useState<WardrobeItem[]>([]);
  const [generatedOutfits, setGeneratedOutfits] = useState<GeneratedOutfit[]>([]);
  const [savedOutfits, setSavedOutfits] = useState<SavedOutfit[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [prompt, setPrompt] = useState('');
  const [status, setStatus] = useState<OutfitStatus | null>(null);
  const [savingOutfitId, setSavingOutfitId] = useState<number | null>(null);
  const [feedback, setFeedback] = useState<OutfitFeedback[]>([]);
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [feedbackModalType, setFeedbackModalType] = useState<'like' | 'dislike'>('like');
  const [feedbackModalOutfit, setFeedbackModalOutfit] = useState<string[]>([]);
  const [feedbackModalIndex, setFeedbackModalIndex] = useState<number | null>(null);
  const [showFeedbackSection, setShowFeedbackSection] = useState(false);

  useEffect(() => {
    fetchItems();
    fetchSavedOutfits();
    fetchStatus();
    fetchFeedback();
  }, []);

  const fetchItems = async () => {
    try {
      const response = await fetch(`${apiUrl}/api/items`);
      const data = await response.json();
      setItems(data);
    } catch (error) {
      console.error('Error fetching items:', error);
    }
  };

  const fetchSavedOutfits = async () => {
    try {
      const response = await fetch(`${apiUrl}/api/outfits/saved`);
      const data = await response.json();
      // Ensure data is an array and each outfit has itemTitles
      const outfits = (Array.isArray(data) ? data : []).filter((outfit: any) => 
        outfit && Array.isArray(outfit.itemTitles)
      );
      setSavedOutfits(outfits);
    } catch (error) {
      console.error('Error fetching saved outfits:', error);
      setSavedOutfits([]);
    }
  };

  const fetchStatus = async () => {
    try {
      const response = await fetch(`${apiUrl}/api/outfits/status`);
      const data = await response.json();
      setStatus(data);
    } catch (err) {
      console.error('Error fetching status:', err);
    }
  };

  const handleGenerate = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${apiUrl}/api/outfits/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ prompt: prompt.trim() || undefined }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to generate outfits');
      }

      // Ensure outfits is an array and each outfit has itemTitles
      const outfits = (data.outfits || []).filter((outfit: any) => 
        outfit && Array.isArray(outfit.itemTitles || outfit)
      ).map((outfit: any) => ({
        itemTitles: Array.isArray(outfit.itemTitles) ? outfit.itemTitles : (Array.isArray(outfit) ? outfit : [])
      }));

      setGeneratedOutfits(outfits);
      setStatus({
        clicksUsed: data.clicksUsed || 0,
        maxClicks: data.maxClicks || 10,
        remaining: (data.maxClicks || 10) - (data.clicksUsed || 0),
      });
      // Don't clear prompt - keep it for feedback context
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate outfits');
    } finally {
      setLoading(false);
      fetchStatus();
    }
  };

  const handleSaveOutfit = async (outfit: GeneratedOutfit, index: number) => {
    setSavingOutfitId(index);
    try {
      const response = await fetch(`${apiUrl}/api/outfits/save`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          itemTitles: outfit.itemTitles || [],
          prompt: prompt || undefined,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to save outfit');
      }

      await fetchSavedOutfits();
      // Remove from generated outfits
      setGeneratedOutfits(prev => prev.filter((_, i) => i !== index));
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to save outfit');
    } finally {
      setSavingOutfitId(null);
    }
  };

  const fetchFeedback = async () => {
    try {
      const response = await fetch(`${apiUrl}/api/outfits/feedback`);
      const data = await response.json();
      setFeedback(data);
    } catch (error) {
      console.error('Error fetching feedback:', error);
    }
  };

  const handleLikeDislike = (outfit: GeneratedOutfit, index: number, type: 'like' | 'dislike') => {
    setFeedbackModalType(type);
    setFeedbackModalOutfit(outfit.itemTitles);
    setFeedbackModalIndex(index);
    setShowFeedbackModal(true);
  };

  const handleFeedbackSubmit = async (feedbackText: string) => {
    if (feedbackModalIndex === null) return;

    try {
      const response = await fetch(`${apiUrl}/api/outfits/feedback`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          itemTitles: feedbackModalOutfit,
          type: feedbackModalType,
          feedback: feedbackText.trim() || undefined,
          prompt: prompt || undefined,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to save feedback');
      }

      await fetchFeedback();
      setShowFeedbackModal(false);
      setFeedbackModalIndex(null);
      setFeedbackModalOutfit([]);
      
      // Remove the outfit from generated list after feedback
      setGeneratedOutfits(prev => prev.filter((_, i) => i !== feedbackModalIndex));
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to save feedback');
    }
  };

  const handleDeleteFeedback = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this feedback?')) {
      return;
    }

    try {
      const response = await fetch(`${apiUrl}/api/outfits/feedback/${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete feedback');
      }

      await fetchFeedback();
    } catch (err) {
      alert('Failed to delete feedback');
    }
  };

  const handleDeleteSavedOutfit = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this saved outfit?')) {
      return;
    }

    try {
      const response = await fetch(`${apiUrl}/api/outfits/saved/${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete outfit');
      }

      await fetchSavedOutfits();
    } catch (err) {
      alert('Failed to delete outfit');
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
    <div className="OutfitsPage">
      <h1>Outfit Generator</h1>
      <p className="page-description">
        Generate personalized outfit combinations based on your wardrobe and style preferences
      </p>

      <div className="generate-section">
        <div className="generate-form">
          <div className="form-group">
            <label htmlFor="prompt">Additional Context (Optional)</label>
            <textarea
              id="prompt"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="e.g., 'Temperature: 65°F, Occasion: casual dinner, Mood: relaxed and comfortable'"
              rows={3}
              disabled={loading}
              className="prompt-textarea"
            />
            <small>Add details about weather, occasion, mood, or any specific requirements</small>
          </div>

          {status && (
            <div className="status-badge">
              <span>
                {status.remaining} / {status.maxClicks} clicks remaining today
              </span>
            </div>
          )}

          {!canGenerate ? (
            <div className="info-message">
              <p>
                {categoryCount < 2
                  ? 'Need at least 2 different categories to generate outfits.'
                  : 'Add at least 2 items to generate outfits.'}
              </p>
              <p className="current-stats">
                Current: {items.length} items in {categoryCount} categories
              </p>
            </div>
          ) : (
            <button
              className="btn btn-primary generate-btn"
              onClick={handleGenerate}
              disabled={loading || (status?.remaining ?? 0) <= 0}
            >
              {loading
                ? 'Generating Outfits...'
                : status?.remaining === 0
                ? 'Daily Limit Reached'
                : 'Generate 5 Outfits'}
            </button>
          )}

          {error && <div className="error-message">{error}</div>}
        </div>
      </div>

      {generatedOutfits.length > 0 && (
        <div className="generated-outfits-section">
          <h2>Generated Outfits ({generatedOutfits.length})</h2>
          <div className="outfits-list">
            {generatedOutfits.map((outfit, index) => (
              <div key={index} className="outfit-card">
                <div className="outfit-number">Outfit {index + 1}</div>
                <div className="outfit-items">
                  {(outfit.itemTitles || []).map((itemTitle: string, itemIndex: number) => {
                    const item = items.find((i) => i.title === itemTitle);
                    return (
                      <div key={itemIndex} className="outfit-item">
                        {item ? (
                          <>
                            <img
                              src={`${apiUrl}${item.imageUrl}`}
                              alt={itemTitle}
                              className="outfit-item-image"
                              onError={(e) => {
                                (e.target as HTMLImageElement).src =
                                  'https://via.placeholder.com/80';
                              }}
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
                <div className="outfit-actions">
                  <button
                    className="btn btn-secondary like-btn"
                    onClick={() => handleLikeDislike(outfit, index, 'like')}
                    disabled={savingOutfitId === index}
                  >
                    ✓ Like
                  </button>
                  <button
                    className="btn btn-secondary dislike-btn"
                    onClick={() => handleLikeDislike(outfit, index, 'dislike')}
                    disabled={savingOutfitId === index}
                  >
                    ✗ Dislike
                  </button>
                  <button
                    className="btn btn-secondary save-outfit-btn"
                    onClick={() => handleSaveOutfit(outfit, index)}
                    disabled={savingOutfitId === index}
                  >
                    {savingOutfitId === index ? 'Saving...' : '💾 Save'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <FeedbackModal
        isOpen={showFeedbackModal}
        onClose={() => {
          setShowFeedbackModal(false);
          setFeedbackModalIndex(null);
          setFeedbackModalOutfit([]);
        }}
        onSubmit={handleFeedbackSubmit}
        type={feedbackModalType}
        outfitItems={feedbackModalOutfit}
      />

      {savedOutfits.length > 0 && (
        <div className="saved-outfits-section">
          <h2>Saved Outfits ({savedOutfits.length})</h2>
          <div className="outfits-list">
            {savedOutfits.map((outfit) => (
              <div key={outfit.id} className="outfit-card saved">
                {outfit.prompt && (
                  <div className="outfit-prompt">
                    <strong>Context:</strong> {outfit.prompt}
                  </div>
                )}
                <div className="outfit-items">
                  {(outfit.itemTitles || []).map((itemTitle: string, itemIndex: number) => {
                    const item = items.find((i) => i.title === itemTitle);
                    return (
                      <div key={itemIndex} className="outfit-item">
                        {item ? (
                          <>
                            <img
                              src={`${apiUrl}${item.imageUrl}`}
                              alt={itemTitle}
                              className="outfit-item-image"
                              onError={(e) => {
                                (e.target as HTMLImageElement).src =
                                  'https://via.placeholder.com/80';
                              }}
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
                <div className="outfit-footer">
                  <small>
                    Saved {new Date(outfit.createdAt).toLocaleDateString()}
                  </small>
                  <button
                    className="btn btn-small delete-outfit-btn"
                    onClick={() => handleDeleteSavedOutfit(outfit.id)}
                  >
                    🗑️ Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {feedback.length > 0 && (
        <div className="feedback-section">
          <button
            className="feedback-toggle-btn"
            onClick={() => setShowFeedbackSection(!showFeedbackSection)}
          >
            {showFeedbackSection ? '▼' : '▶'} Feedback History ({feedback.length})
          </button>
          
          {showFeedbackSection && (
            <div className="feedback-list">
              <h2>Your Feedback</h2>
              <div className="feedback-items">
                {feedback.map((fb) => (
                  <div key={fb.id} className={`feedback-item ${fb.type}`}>
                    <div className="feedback-header">
                      <span className={`feedback-type ${fb.type}`}>
                        {fb.type === 'like' ? '✓' : '✗'} {fb.type === 'like' ? 'Liked' : 'Disliked'}
                      </span>
                      <span className="feedback-date">
                        {new Date(fb.createdAt).toLocaleDateString()}
                      </span>
                      <button
                        className="btn btn-small delete-feedback-btn"
                        onClick={() => handleDeleteFeedback(fb.id)}
                      >
                        Delete
                      </button>
                    </div>
                    <div className="feedback-outfit">
                      {fb.itemTitles.join(' + ')}
                    </div>
                    {fb.feedback && (
                      <div className="feedback-text">
                        "{fb.feedback}"
                      </div>
                    )}
                    {fb.prompt && (
                      <div className="feedback-prompt">
                        <small>Context: {fb.prompt}</small>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default OutfitsPage;


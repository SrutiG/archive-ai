import React, { useState, useEffect } from 'react';
import './ExplorePage.css';
import { WardrobeItem } from '../App';
import { PageHeader, Button, Text } from '../design-system';

interface ExplorePageProps {
  apiUrl: string;
}

interface ExploreSuggestion {
  id: string;
  title: string;
  category: string;
  description: string;
  brand?: string;
  link?: string;
  pairsWellWith: string[];
  imageUrl?: string;
  createdAt: string;
}

const ExplorePage: React.FC<ExplorePageProps> = ({ apiUrl }) => {
  const [items, setItems] = useState<WardrobeItem[]>([]);
  const [suggestions, setSuggestions] = useState<ExploreSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<string>('');
  const [shouldUpdate, setShouldUpdate] = useState(false);

  const handleGenerate = async (forceRefresh: boolean = false) => {
    setLoading(true);
    setError(null);

    try {
      // Use force refresh endpoint if manually triggered
      const endpoint = forceRefresh 
        ? `${apiUrl}/api/explore/generate?force=true`
        : `${apiUrl}/api/explore/generate`;
      
      const response = await fetch(endpoint, {
        method: 'POST',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to generate suggestions');
      }

      const data = await response.json();
      setSuggestions(data.suggestions || []);
      setLastUpdate(data.lastUpdate || '');
      setShouldUpdate(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate suggestions');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchItems();
    
    // Auto-generate suggestions on first visit if none exist today
    const autoGenerate = async () => {
      try {
        const response = await fetch(`${apiUrl}/api/explore/suggestions`);
        const data = await response.json();
        
        // If no suggestions exist or should update, auto-generate
        if (!data.suggestions || data.suggestions.length === 0 || data.shouldUpdate) {
          setLoading(true);
          await handleGenerate(false);
        } else {
          // Load existing suggestions
          setSuggestions(data.suggestions || []);
          setLastUpdate(data.lastUpdate || '');
          setShouldUpdate(data.shouldUpdate || false);
        }
      } catch (error) {
        console.error('Error checking suggestions:', error);
        setLoading(false);
      }
    };
    
    autoGenerate();
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

  const fetchSuggestions = async () => {
    try {
      const response = await fetch(`${apiUrl}/api/explore/suggestions`);
      const data = await response.json();
      setSuggestions(data.suggestions || []);
      setLastUpdate(data.lastUpdate || '');
      setShouldUpdate(data.shouldUpdate || false);
    } catch (error) {
      console.error('Error fetching suggestions:', error);
    }
  };

  const handleRefresh = () => {
    handleGenerate(true);
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return 'Never';
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', { 
        month: 'long', 
        day: 'numeric', 
        year: 'numeric' 
      });
    } catch {
      return dateString;
    }
  };

  return (
    <div className="ExplorePage">
      <PageHeader
        title="Explore"
        description="Discover items that complement your wardrobe based on your style preferences"
      >
        {lastUpdate && (
          <div className="last-update">
            <Text variant="caption">Last updated: {formatDate(lastUpdate)}</Text>
          </div>
        )}
        <Button
          variant="primary"
          size="medium"
          onClick={handleRefresh}
          disabled={loading}
          className="refresh-btn"
        >
          {loading ? 'Generating...' : 'Refresh'}
        </Button>
      </PageHeader>

      {error && <div className="error-message">{error}</div>}

      {loading && (
        <div className="loading-state">
          <p>Generating personalized recommendations based on your wardrobe...</p>
        </div>
      )}

      {!loading && suggestions.length === 0 && (
        <div className="empty-state">
          <p>No suggestions yet. Click "Refresh" to generate personalized recommendations.</p>
        </div>
      )}

      {suggestions.length > 0 && (
        <div className="suggestions-grid">
          {suggestions.map((suggestion) => (
            <div key={suggestion.id} className="suggestion-card">
              <div className="suggestion-image">
                {suggestion.imageUrl ? (
                  <img
                    src={suggestion.imageUrl.startsWith('http') ? suggestion.imageUrl : `${apiUrl}${suggestion.imageUrl}`}
                    alt={suggestion.title}
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = 'none';
                      const parent = (e.target as HTMLImageElement).parentElement;
                      if (parent && !parent.querySelector('.placeholder-image')) {
                        const placeholder = document.createElement('div');
                        placeholder.className = 'placeholder-image';
                        placeholder.textContent = suggestion.title;
                        parent.appendChild(placeholder);
                      }
                    }}
                  />
                ) : (
                  <div className="placeholder-image">{suggestion.title}</div>
                )}
                <div className="suggestion-category">{suggestion.category}</div>
              </div>
              <div className="suggestion-content">
                <div className="suggestion-header">
                  <h3>{suggestion.title}</h3>
                  {suggestion.brand && (
                    <div className="suggestion-brand">{suggestion.brand}</div>
                  )}
                </div>
                <p className="suggestion-description">{suggestion.description}</p>
                {suggestion.pairsWellWith.length > 0 && (
                  <div className="pairs-well-with">
                    <strong>Pairs well with:</strong>
                    <ul>
                      {suggestion.pairsWellWith.map((itemTitle, index) => {
                        const item = items.find(i => i.title === itemTitle);
                        return (
                          <li key={index}>
                            {item ? (
                              <span className="pair-item">{itemTitle}</span>
                            ) : (
                              <span>{itemTitle}</span>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                )}
                {suggestion.link && (
                  <div className="suggestion-link">
                    <a 
                      href={suggestion.link} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="link-button"
                    >
                      Find Item →
                    </a>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ExplorePage;


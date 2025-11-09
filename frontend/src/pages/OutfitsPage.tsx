import React, { useState, useEffect, useRef } from 'react';
import './OutfitsPage.css';
import { WardrobeItem } from '../App';
import FeedbackModal from '../components/FeedbackModal';
import ItemAutocomplete from '../components/ItemAutocomplete';
import { PageHeader, SectionHeader, Button } from '../design-system';
import { getItemImageUrl, getPlaceholderImage } from '../utils/placeholderImages';
import { apiGet, apiPost, apiDelete } from '../utils/api';
import { useUser } from '../contexts/UserContext';

interface OutfitsPageProps {
  apiUrl: string;
}

interface GeneratedOutfit {
  items: string[];
  justification: string;
  stylingSuggestions: string[];
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

const CATEGORY_ORDER = [
  {
    key: 'tops',
    label: 'Top',
    keywords: ['top', 'tops', 'shirt', 'blouse', 'sweater', 'hoodie', 'coat', 'jacket', 'outerwear', 'blazer', 'cardigan', 'dress', 'sweatshirt', 'pullover', 'tee', 't-shirt'],
  },
  {
    key: 'bottoms',
    label: 'Bottom',
    keywords: ['bottom', 'bottoms', 'pant', 'pants', 'jean', 'jeans', 'short', 'shorts', 'skirt', 'trouser', 'leggings'],
  },
  {
    key: 'shoes',
    label: 'Shoes',
    keywords: ['shoe', 'shoes', 'boot', 'boots', 'sneaker', 'sneakers', 'heel', 'heels', 'loafer', 'loafers', 'flat', 'flats', 'sandals', 'sandal'],
  },
  {
    key: 'accessories',
    label: 'Accessories',
    keywords: ['accessory', 'accessories', 'bag', 'belt', 'hat', 'scarf', 'jewelry', 'watch', 'tie', 'glove', 'gloves'],
  },
] as const;

const CATEGORY_DIRECT_MAP: Record<string, typeof CATEGORY_ORDER[number]['key']> = {
  Tops: 'tops',
  Bottoms: 'bottoms',
  Dresses: 'bottoms',
  Outerwear: 'tops',
  Shoes: 'shoes',
  Accessories: 'accessories',
  Bags: 'accessories',
  Jewelry: 'accessories',
  Activewear: 'tops',
  Underwear: 'bottoms',
};

const CATEGORY_BUCKET_MAP: Record<string, typeof CATEGORY_ORDER[number]['key']> = {
  tops: 'tops',
  top: 'tops',
  outerwear: 'tops',
  coat: 'tops',
  coats: 'tops',
  jacket: 'tops',
  jackets: 'tops',
  blazer: 'tops',
  blazers: 'tops',
  cardigan: 'tops',
  cardigans: 'tops',
  sweater: 'tops',
  sweaters: 'tops',
  sweatshirt: 'tops',
  sweatshirts: 'tops',
  hoodie: 'tops',
  hoodies: 'tops',
  shirt: 'tops',
  shirts: 'tops',
  blouse: 'tops',
  blouses: 'tops',
  tee: 'tops',
  tees: 'tops',
  tshirt: 'tops',
  tshirts: 'tops',
  't-shirt': 'tops',
  't-shirts': 'tops',
  dress: 'tops',
  dresses: 'tops',
  activewear: 'tops',

  bottom: 'bottoms',
  bottoms: 'bottoms',
  pant: 'bottoms',
  pants: 'bottoms',
  trouser: 'bottoms',
  trousers: 'bottoms',
  jean: 'bottoms',
  jeans: 'bottoms',
  short: 'bottoms',
  shorts: 'bottoms',
  skirt: 'bottoms',
  skirts: 'bottoms',
  legging: 'bottoms',
  leggings: 'bottoms',
  jogger: 'bottoms',
  joggers: 'bottoms',

  shoe: 'shoes',
  shoes: 'shoes',
  boot: 'shoes',
  boots: 'shoes',
  sneaker: 'shoes',
  sneakers: 'shoes',
  heel: 'shoes',
  heels: 'shoes',
  flat: 'shoes',
  flats: 'shoes',
  loafer: 'shoes',
  loafers: 'shoes',
  sandal: 'shoes',
  sandals: 'shoes',
  mule: 'shoes',
  mules: 'shoes',

  accessory: 'accessories',
  accessories: 'accessories',
  bag: 'accessories',
  bags: 'accessories',
  belt: 'accessories',
  belts: 'accessories',
  hat: 'accessories',
  hats: 'accessories',
  scarf: 'accessories',
  scarves: 'accessories',
  jewelry: 'accessories',
  bracelet: 'accessories',
  bracelets: 'accessories',
  necklace: 'accessories',
  necklaces: 'accessories',
  earring: 'accessories',
  earrings: 'accessories',
  ring: 'accessories',
  rings: 'accessories',
  watch: 'accessories',
  watches: 'accessories',
  tie: 'accessories',
  ties: 'accessories',
  glove: 'accessories',
  gloves: 'accessories',
};

const stripLeadingMarkers = (value: string): string =>
  value.replace(/^[\s]*[-•*·+]+[\s]*/, '');

const normalizeTitleWhitespace = (value: string): string =>
  value.replace(/\s+/g, ' ').trim();

const normalizeTitleForMatch = (value: string): string =>
  normalizeTitleWhitespace(stripLeadingMarkers(value)).toLowerCase();

const formatTitleForDisplay = (value: string): string =>
  normalizeTitleWhitespace(stripLeadingMarkers(value));

const resolveCategoryBucket = (item: WardrobeItem | undefined, title: string): typeof CATEGORY_ORDER[number]['key'] => {
  const searchValues: string[] = [];

  if (item?.category) {
    if (CATEGORY_DIRECT_MAP[item.category]) {
      return CATEGORY_DIRECT_MAP[item.category];
    }
    const normalized = item.category.toLowerCase();
    searchValues.push(normalized);
    searchValues.push(...normalized.split(/[\s/,-]+/));
  }

  const normalizedTitle = title.toLowerCase();
  searchValues.push(normalizedTitle);
  searchValues.push(...normalizedTitle.split(/[\s/,-]+/));

  for (const value of searchValues) {
    if (!value) continue;
    if (CATEGORY_BUCKET_MAP[value]) {
      return CATEGORY_BUCKET_MAP[value];
    }

    for (const keyword in CATEGORY_BUCKET_MAP) {
      if (value.includes(keyword)) {
        return CATEGORY_BUCKET_MAP[keyword];
      }
    }
  }

  // Fallback to keyword list ordering
  for (const category of CATEGORY_ORDER) {
    if (
      category.keywords.some(
        (keyword) => normalizedTitle.includes(keyword) || (item?.category || '').toLowerCase().includes(keyword)
      )
    ) {
      return category.key;
    }
  }

  return 'accessories';
};

const OutfitsPage: React.FC<OutfitsPageProps> = ({ apiUrl }) => {
  const { currentUser } = useUser();
  const [items, setItems] = useState<WardrobeItem[]>([]);
  const [generatedOutfits, setGeneratedOutfits] = useState<GeneratedOutfit[]>([]);
  const [savedOutfits, setSavedOutfits] = useState<SavedOutfit[]>([]);
  const [loading, setLoading] = useState(false);
  const [itemsLoading, setItemsLoading] = useState(false);
  const [statusLoading, setStatusLoading] = useState(false);
  const [savedOutfitsLoading, setSavedOutfitsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [prompt, setPrompt] = useState('');
  const [status, setStatus] = useState<OutfitStatus | null>(null);
  const [savingOutfitId, setSavingOutfitId] = useState<number | null>(null);
  const [feedback, setFeedback] = useState<OutfitFeedback[]>([]);
  const [expandedContexts, setExpandedContexts] = useState<Record<string, boolean>>({});
  const [contextOverflow, setContextOverflow] = useState<Record<string, boolean>>({});
  const contextRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [feedbackModalType, setFeedbackModalType] = useState<'like' | 'dislike'>('like');
  const [feedbackModalOutfit, setFeedbackModalOutfit] = useState<string[]>([]);
  const [feedbackModalIndex, setFeedbackModalIndex] = useState<number | null>(null);
  const [showFeedbackSection, setShowFeedbackSection] = useState(false);
  const [likedOutfitIndices, setLikedOutfitIndices] = useState<Set<number>>(new Set());
  const [selectedItems, setSelectedItems] = useState<WardrobeItem[]>([]);

  useEffect(() => {
    if (currentUser) {
      fetchItems();
      fetchSavedOutfits();
      fetchStatus();
      fetchFeedback();
      // Clear generated outfits when switching users
      setGeneratedOutfits([]);
      setLikedOutfitIndices(new Set());
      setSelectedItems([]);
      setPrompt('');
    }
  }, [currentUser?.id]);

  const fetchItems = async () => {
    setItemsLoading(true);
    try {
      const response = await apiGet('/api/items');
      const data = await response.json();
      setItems(data);
    } catch (error) {
      console.error('Error fetching items:', error);
    } finally {
      setItemsLoading(false);
    }
  };

  const fetchSavedOutfits = async () => {
    setSavedOutfitsLoading(true);
    try {
      const response = await apiGet('/api/outfits/saved');
      const data = await response.json();
      // Ensure data is an array and each outfit has itemTitles
      const outfits = (Array.isArray(data) ? data : []).filter((outfit: any) => 
        outfit && Array.isArray(outfit.itemTitles)
      );
      setSavedOutfits(outfits);
    } catch (error) {
      console.error('Error fetching saved outfits:', error);
      setSavedOutfits([]);
    } finally {
      setSavedOutfitsLoading(false);
    }
  };

  useEffect(() => {
    const overflowMap: Record<string, boolean> = {};
    savedOutfits.forEach((outfit) => {
      const contentEl = contextRefs.current[outfit.id];
      if (contentEl) {
        overflowMap[outfit.id] = contentEl.scrollHeight > 160;
      }
    });
    setContextOverflow(overflowMap);

    const currentKeys = new Set(savedOutfits.map((outfit) => outfit.id));
    Object.keys(contextRefs.current).forEach((key) => {
      if (!currentKeys.has(key)) {
        delete contextRefs.current[key];
      }
    });
  }, [savedOutfits]);

  const fetchStatus = async () => {
    setStatusLoading(true);
    try {
      const response = await apiGet('/api/outfits/status');
      const data = await response.json();
      setStatus(data);
    } catch (err) {
      console.error('Error fetching status:', err);
    } finally {
      setStatusLoading(false);
    }
  };

  const handleGenerate = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await apiPost('/api/outfits/generate', { 
        prompt: prompt.trim() || undefined,
        selectedItemIds: selectedItems.map(item => item.id)
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to generate outfits');
      }

      // Ensure outfits is an array and handle both old and new formats
      const outfits = (data.outfits || []).map((outfit: any) => {
        // Handle new format with items, justification, stylingSuggestions
        if (outfit.items && Array.isArray(outfit.items)) {
          return {
            items: outfit.items,
            justification: outfit.justification || 'This combination creates a stylish and cohesive look.',
            stylingSuggestions: outfit.stylingSuggestions || []
          };
        }
        // Handle old format with itemTitles or direct array
        const items = Array.isArray(outfit.itemTitles) ? outfit.itemTitles : (Array.isArray(outfit) ? outfit : []);
        return {
          items,
          justification: 'This combination creates a stylish and cohesive look.',
          stylingSuggestions: []
        };
      }).filter((outfit: GeneratedOutfit) => outfit.items.length > 0);

      setGeneratedOutfits(outfits);
      setLikedOutfitIndices(new Set()); // Reset liked outfits when generating new ones
      setSelectedItems([]); // Clear selected items after generation
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
      const response = await apiPost('/api/outfits/save', {
        itemTitles: outfit.items || [],
        prompt: prompt || undefined,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to save outfit');
      }

      await fetchSavedOutfits();
      // Remove from generated outfits
      setGeneratedOutfits(prev => prev.filter((_, i) => i !== index));
      // Remove from liked indices if it was liked, and update indices for items after
      setLikedOutfitIndices(prev => {
        const newSet = new Set<number>();
        prev.forEach(idx => {
          if (idx < index) {
            newSet.add(idx);
          } else if (idx > index) {
            newSet.add(idx - 1);
          }
          // If idx === index, don't add it (it's removed)
        });
        return newSet;
      });
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to save outfit');
    } finally {
      setSavingOutfitId(null);
    }
  };

  const fetchFeedback = async () => {
    try {
      const response = await apiGet('/api/outfits/feedback');
      const data = await response.json();
      setFeedback(data);
    } catch (error) {
      console.error('Error fetching feedback:', error);
    }
  };

  const handleLikeDislike = (outfit: GeneratedOutfit, index: number, type: 'like' | 'dislike') => {
    setFeedbackModalType(type);
    setFeedbackModalOutfit(outfit.items);
    setFeedbackModalIndex(index);
    setShowFeedbackModal(true);
  };

  const handleFeedbackSubmit = async (feedbackText: string) => {
    if (feedbackModalIndex === null) return;

    try {
      const response = await apiPost('/api/outfits/feedback', {
        itemTitles: feedbackModalOutfit,
        type: feedbackModalType,
        feedback: feedbackText.trim() || undefined,
        prompt: prompt || undefined,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to save feedback');
      }

      await fetchFeedback();
      setShowFeedbackModal(false);
      
      if (feedbackModalType === 'like') {
        // Mark outfit as liked instead of removing it
        setLikedOutfitIndices(prev => new Set(prev).add(feedbackModalIndex));
      } else {
        // Remove disliked outfits from the list
        setGeneratedOutfits(prev => prev.filter((_, i) => i !== feedbackModalIndex));
        // Update liked indices to account for removed item
        setLikedOutfitIndices(prev => {
          const newSet = new Set<number>();
          prev.forEach(idx => {
            if (idx < feedbackModalIndex) {
              newSet.add(idx);
            } else if (idx > feedbackModalIndex) {
              newSet.add(idx - 1);
            }
          });
          return newSet;
        });
      }
      
      setFeedbackModalIndex(null);
      setFeedbackModalOutfit([]);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to save feedback');
    }
  };

  const handleDeleteFeedback = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this feedback?')) {
      return;
    }

    try {
      const response = await apiDelete(`/api/outfits/feedback/${id}`);

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
      const response = await apiDelete(`/api/outfits/saved/${id}`);

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
      <PageHeader
        title="Outfits"
        description="Generate personalized outfit combinations based on your wardrobe and style preferences"
      />

      {(itemsLoading || statusLoading) ? (
        <div className="generate-section">
          <SectionHeader title="Outfit Generator" />
          <div className="loading-container">
            <div className="loading-spinner"></div>
            <p className="loading-text">Loading outfit generator...</p>
          </div>
        </div>
      ) : (
        <div className="generate-section">
          <SectionHeader title="Outfit Generator" />
          <div className="generate-form">
            <div className="form-group">
              <label htmlFor="selectedItems">Build Outfit Around Specific Items (Optional, max 3)</label>
              <ItemAutocomplete
                items={items}
                selectedItems={selectedItems}
                onItemsChange={setSelectedItems}
                maxItems={3}
                disabled={loading}
                apiUrl={apiUrl}
              />
              <small>Select up to 3 items to build outfits around. All item details (description, measurements) will be included in the generation context.</small>
            </div>

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
              <Button
                variant="primary"
                size="medium"
                onClick={handleGenerate}
                disabled={loading || (status?.remaining ?? 0) <= 0}
                className="generate-btn"
              >
                {loading
                  ? 'Generating Outfits...'
                  : status?.remaining === 0
                  ? 'Daily Limit Reached'
                  : 'Generate 5 Outfits'}
              </Button>
            )}

            {error && <div className="error-message">{error}</div>}
          </div>
        </div>
      )}

      {generatedOutfits.length > 0 && (
        <div className="generated-outfits-section">
          <SectionHeader title={`Generated Outfits (${generatedOutfits.length})`} />
          <div className="outfits-list">
            {generatedOutfits.map((outfit, index) => {
              const isLiked = likedOutfitIndices.has(index);
              return (
              <div key={index} className={`outfit-card ${isLiked ? 'liked' : ''}`}>
                {isLiked && (
                  <div className="liked-indicator">
                    <span className="liked-icon">✓</span>
                    <span className="liked-text">Liked</span>
                  </div>
                )}
                <div className="outfit-number">Outfit {index + 1}</div>
                <div className="outfit-items">
                  {(outfit.items || []).map((itemTitle: string, itemIndex: number) => {
                    const item = items.find((i) => i.title === itemTitle);
                    return (
                      <div key={itemIndex} className="outfit-item">
                        {item ? (
                          <>
                            <img
                              src={getItemImageUrl(item, apiUrl)}
                              alt={itemTitle}
                              className="outfit-item-image"
                              onError={(e) => {
                                (e.target as HTMLImageElement).src = getPlaceholderImage(item.category);
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
                  <Button
                    variant="secondary"
                    size="small"
                    onClick={() => handleLikeDislike(outfit, index, 'like')}
                    disabled={savingOutfitId === index || isLiked}
                    className="like-btn"
                  >
                    {isLiked ? '✓ Liked' : '✓ Like'}
                  </Button>
                  <Button
                    variant="secondary"
                    size="small"
                    onClick={() => handleLikeDislike(outfit, index, 'dislike')}
                    disabled={savingOutfitId === index}
                    className="dislike-btn"
                  >
                    ✗ Dislike
                  </Button>
                  <Button
                    variant="secondary"
                    size="small"
                    onClick={() => handleSaveOutfit(outfit, index)}
                    disabled={savingOutfitId === index}
                    className="save-outfit-btn"
                  >
                    {savingOutfitId === index ? 'Saving...' : '💾 Save'}
                  </Button>
                </div>
                {outfit.justification && (
                  <div className="outfit-justification">
                    <strong>Why this combination:</strong> {outfit.justification}
                  </div>
                )}
                {outfit.stylingSuggestions && outfit.stylingSuggestions.length > 0 && (
                  <div className="outfit-styling-suggestions">
                    <strong>Styling suggestions:</strong>
                    <ul>
                      {outfit.stylingSuggestions.map((suggestion: string, suggestionIndex: number) => (
                        <li key={suggestionIndex}>{suggestion}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            );
            })}
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

      {savedOutfitsLoading ? (
        <div className="saved-outfits-section">
          <SectionHeader title="Saved Outfits" />
          <div className="loading-container">
            <div className="loading-spinner"></div>
            <p className="loading-text">Loading saved outfits...</p>
          </div>
        </div>
      ) : savedOutfits.length > 0 && (
        <div className="saved-outfits-section">
          <SectionHeader title={`Saved Outfits (${savedOutfits.length})`} />
          <div className="outfits-grid">
            {savedOutfits.map((outfit) => {
              const outfitItemData = (outfit.itemTitles || []).map((itemTitle: string) => {
                const normalizedKey = normalizeTitleForMatch(itemTitle);
                const matchedItem = items.find(
                  (i) => normalizeTitleForMatch(i.title) === normalizedKey
                );

                const displayTitle = matchedItem
                  ? matchedItem.title
                  : formatTitleForDisplay(itemTitle);

                return {
                  title: displayTitle,
                  item: matchedItem,
                  originalTitle: itemTitle,
                };
              });
              const isContextExpanded = expandedContexts[outfit.id] ?? false;
              const hasContextOverflow = contextOverflow[outfit.id] ?? false;

              const categoryBuckets = CATEGORY_ORDER.map((category) => ({
                ...category,
                items: [] as { title: string; item?: WardrobeItem }[],
              }));

              outfitItemData.forEach(({ title, item }) => {
                const bucketKey = resolveCategoryBucket(item, title);
                const targetBucket = categoryBuckets.find((bucket) => bucket.key === bucketKey);

                if (targetBucket) {
                  targetBucket.items.push({ title, item });
                }
              });

              return (
                <div
                  key={outfit.id}
                  className="outfit-card saved"
                >
                  <div className="outfit-card-content">
                    <div className="outfit-category-layout">
                      {categoryBuckets.map((bucket) => (
                        <div key={bucket.key} className="outfit-category-row">
                          <span className="outfit-category-row-label">{bucket.label}</span>
                          <div className="outfit-category-row-items">
                            {bucket.items.length > 0 ? (
                              bucket.items.map(({ title, item }) => (
                                <div key={title} className="outfit-category-row-item" data-tooltip={title}>
                                  <div className="outfit-category-row-thumb">
                                    {item ? (
                                      <img
                                        src={getItemImageUrl(item, apiUrl)}
                                        alt={title}
                                        className="outfit-category-row-image"
                                        onError={(e) => {
                                          (e.target as HTMLImageElement).src = getPlaceholderImage(item.category);
                                        }}
                                      />
                                    ) : (
                                      <div className="outfit-category-row-placeholder">{title}</div>
                                    )}
                                  </div>
                                  <span className="outfit-category-row-title">{title}</span>
                                </div>
                              ))
                            ) : (
                              <div className="outfit-category-row-item placeholder" data-tooltip="None">
                                <div className="outfit-category-row-thumb placeholder">
                                  <div className="outfit-category-row-placeholder-text">—</div>
                                </div>
                                <span className="outfit-category-row-title">None</span>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                    {outfit.prompt && (
                      <div
                        className={`outfit-context ${isContextExpanded ? 'expanded' : ''} ${
                          hasContextOverflow ? 'truncated' : ''
                        }`}
                      >
                        <strong>Context:</strong>
                        <div
                          className="outfit-context-content"
                          ref={(el) => {
                            contextRefs.current[outfit.id] = el;
                          }}
                        >
                          {outfit.prompt}
                        </div>
                        {hasContextOverflow && (
                          <button
                            type="button"
                            className="outfit-context-toggle"
                            onClick={() =>
                              setExpandedContexts(prev => ({
                                ...prev,
                                [outfit.id]: !isContextExpanded,
                              }))
                            }
                          >
                            {isContextExpanded ? 'Read less' : 'Read more'}
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="outfit-footer">
                    <small>{new Date(outfit.createdAt).toLocaleDateString()}</small>
                    <Button
                      variant="secondary"
                      size="small"
                      onClick={() => handleDeleteSavedOutfit(outfit.id)}
                      className="delete-outfit-btn"
                    >
                      🗑️ Delete
                    </Button>
                  </div>
                </div>
              );
            })}
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
              <SectionHeader title="Your Feedback" />
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
                      <Button
                        variant="secondary"
                        size="small"
                        onClick={() => handleDeleteFeedback(fb.id)}
                        className="delete-feedback-btn"
                      >
                        Delete
                      </Button>
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


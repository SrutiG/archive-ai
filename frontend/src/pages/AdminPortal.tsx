import React, { useCallback, useEffect, useMemo, useState } from 'react';
import './AdminPortal.css';

type AdminFeedbackType = 'like' | 'dislike' | 'neutral';

type AdminWardrobeItem = {
  id: string;
  title: string;
  category: string;
  subCategory?: string;
  brand?: string;
  description?: string;
  colors?: string[];
  fabrics?: string[];
  pattern?: string;
  silhouettes?: string[];
  fit?: string;
  formalities?: string[];
  styleTags?: string[];
  seasons?: string[];
  occasions?: string[];
  careNotes?: string;
  createdAt: string;
};

type AdminOutfitEvaluation = {
  outfitId: string;
  triageScore?: number;
  triageConfidence?: number;
  triageVerdict?: AdminFeedbackType;
  filteredByTriage?: boolean;
  finalScore?: number;
  finalConfidence?: number;
  finalVerdict?: AdminFeedbackType;
  finalRationale?: string;
  structuralIssues?: string[];
  autoApproved?: boolean;
  autoRejected?: boolean;
  aiNotes?: string;
};

type AdminGeneratedOutfit = {
  id: string;
  itemIds: string[];
  itemTitles: string[];
  items: Array<{
    id: string;
    title: string;
    category: string;
    subCategory?: string;
    brand?: string;
    colors?: string[];
    silhouettes?: string[];
    pattern?: string;
    fit?: string;
    formalities?: string[];
    styleTags?: string[];
    seasons?: string[];
    occasions?: string[];
  }>;
  justification: string;
  stylingSuggestions: string[];
  evaluation?: AdminOutfitEvaluation | null;
  status?: 'pending' | 'auto_rejected';
  createdAt?: string;
};

type TrainingRecord = {
  id: string;
  itemIds: string[];
  itemTitles: string[];
  feedbackType: AdminFeedbackType;
  feedbackComment?: string;
  prompt?: string;
  context?: string;
  createdAt: string;
  generationMetadata?: {
    justification?: string;
    stylingSuggestions?: string[];
  };
};

type FeedbackState = {
  comment: string;
  saving: boolean;
  error?: string | null;
};

const PASSWORD_STORAGE_KEY = 'admin-portal-password';
const DEFAULT_ITEM_BATCH = 48;
const DEFAULT_OUTFIT_BATCH = 12;
const API_BASE_URL = (import.meta.env.VITE_API_URL || 'http://localhost:3001').replace(/\/$/, '');

const AdminPortal: React.FC = () => {
  const [passwordInput, setPasswordInput] = useState('');
  const [password, setPassword] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [items, setItems] = useState<AdminWardrobeItem[]>([]);
  const [itemsLoading, setItemsLoading] = useState(false);
  const [itemBatchCount, setItemBatchCount] = useState(DEFAULT_ITEM_BATCH);
  const [generatedOutfits, setGeneratedOutfits] = useState<AdminGeneratedOutfit[]>([]);
  const [autoApprovedOutfits, setAutoApprovedOutfits] = useState<AdminGeneratedOutfit[]>([]);
  const [autoRejectedEvaluations, setAutoRejectedEvaluations] = useState<AdminOutfitEvaluation[]>([]);
  const [outfitCount, setOutfitCount] = useState(DEFAULT_OUTFIT_BATCH);
  const [prompt, setPrompt] = useState('');
  const [outfitsLoading, setOutfitsLoading] = useState(false);
  const [feedbackState, setFeedbackState] = useState<Record<string, FeedbackState>>({});
  const [trainingRecords, setTrainingRecords] = useState<TrainingRecord[]>([]);
  const [trainingLoading, setTrainingLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'wardrobe' | 'training'>('wardrobe');
  const [trainingError, setTrainingError] = useState<string | null>(null);

  const resetFeedbackState = useCallback((outfits: AdminGeneratedOutfit[]) => {
    const initialState: Record<string, FeedbackState> = {};
    outfits.forEach(outfit => {
      initialState[outfit.id] = {
        comment: '',
        saving: false,
        error: null,
      };
    });
    setFeedbackState(initialState);
  }, []);

  const headers = useMemo(() => {
    const base: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (password) {
      base['x-admin-password'] = password;
    }
    return base;
  }, [password]);

  const buildUrl = useCallback(
    (path: string) => {
      if (!API_BASE_URL) {
        return path;
      }
      const normalizedBase = API_BASE_URL.replace(/\/$/, '');
      if (path.startsWith('/')) {
        if (normalizedBase.endsWith('/api') && path.startsWith('/api')) {
          return `${normalizedBase}${path.slice(4)}`;
        }
        return `${normalizedBase}${path}`;
      }
      return `${normalizedBase}/${path}`;
    },
    []
  );

  const fetchPendingOutfits = useCallback(
    async (providedPassword?: string) => {
      const pass = providedPassword ?? password;
      if (!pass) {
        return;
      }
      try {
        const response = await fetch(buildUrl('/api/admin/outfits/pending'), {
          headers: providedPassword
            ? { 'x-admin-password': pass }
            : headers,
        });
        if (!response.ok) {
          throw new Error(`Failed with status ${response.status}`);
        }
        const data = await response.json();
        const outfits: AdminGeneratedOutfit[] = Array.isArray(data.outfits) ? data.outfits : [];
        const pending = outfits.filter(outfit => outfit.status !== 'auto_rejected');
        setGeneratedOutfits(pending);
        setAutoRejectedEvaluations([]);
        resetFeedbackState(pending);
      } catch (error) {
        console.error('[AdminPortal] Failed to fetch pending outfits:', error);
      }
    },
    [buildUrl, headers, password, resetFeedbackState]
  );

  const handleAuthenticationSuccess = useCallback(
    (providedPassword: string, nextItems: AdminWardrobeItem[]) => {
      setPassword(providedPassword);
      setPasswordInput(providedPassword);
      setIsAuthenticated(true);
      setAuthError(null);
      setItems(nextItems);
      if (typeof window !== 'undefined') {
        sessionStorage.setItem(PASSWORD_STORAGE_KEY, providedPassword);
      }
    },
    []
  );

  const fetchAdminItems = useCallback(
    async (providedPassword?: string) => {
      const pass = providedPassword ?? password;
      if (!pass) {
        return false;
      }
      setItemsLoading(true);
      try {
        const response = await fetch(buildUrl('/api/admin/items'), {
          headers: {
            'x-admin-password': pass,
          },
        });
        if (response.status === 401) {
          setIsAuthenticated(false);
          setAuthError('Invalid admin password.');
          return false;
        }
        if (!response.ok) {
          throw new Error(`Failed with status ${response.status}`);
        }
        const data = await response.json();
        handleAuthenticationSuccess(pass, data.items ?? []);
        await fetchPendingOutfits(pass);
        return true;
      } catch (error) {
        console.error('[AdminPortal] Failed to fetch admin items:', error);
        setAuthError('Unable to verify admin credentials.');
        return false;
      } finally {
        setItemsLoading(false);
      }
    },
    [buildUrl, fetchPendingOutfits, handleAuthenticationSuccess, password]
  );

  const fetchTrainingData = useCallback(
    async (providedPassword?: string) => {
      const pass = providedPassword ?? password;
      if (!pass) {
        return;
      }
      setTrainingLoading(true);
      setTrainingError(null);
      try {
        const response = await fetch(buildUrl('/api/admin/outfits/training?limit=100'), {
          headers: {
            'x-admin-password': pass,
          },
        });
        if (!response.ok) {
          throw new Error(`Failed with status ${response.status}`);
        }
        const data = await response.json();
        setTrainingRecords(Array.isArray(data.records) ? data.records : []);
      } catch (error) {
        console.error('[AdminPortal] Failed to fetch training records:', error);
        setTrainingError('Unable to load training records. Please try again.');
      } finally {
        setTrainingLoading(false);
      }
    },
    [buildUrl, password]
  );

  const attemptAutoLogin = useCallback(async () => {
    if (typeof window === 'undefined') {
      return;
    }
    const stored = sessionStorage.getItem(PASSWORD_STORAGE_KEY);
    if (stored) {
      setPasswordInput(stored);
      const success = await fetchAdminItems(stored);
      if (success) {
        await fetchTrainingData(stored);
        await fetchPendingOutfits(stored);
      }
    }
  }, [fetchAdminItems, fetchPendingOutfits, fetchTrainingData]);

  useEffect(() => {
    void attemptAutoLogin();
  }, [attemptAutoLogin]);

  const handleLoginSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = passwordInput.trim();
    if (!trimmed) {
      setAuthError('Enter the admin password to continue.');
      return;
    }
    const success = await fetchAdminItems(trimmed);
    if (success) {
      await fetchTrainingData(trimmed);
      await fetchPendingOutfits(trimmed);
    }
  };

  const handleGenerateItems = async () => {
    if (!password) {
      setAuthError('Authenticate before generating items.');
      return;
    }
    setItemsLoading(true);
    try {
      const response = await fetch(buildUrl('/api/admin/items/generate'), {
        method: 'POST',
        headers,
        body: JSON.stringify({ count: itemBatchCount }),
      });
      if (!response.ok) {
        throw new Error(`Failed with status ${response.status}`);
      }
      const data = await response.json();
      const createdItems: AdminWardrobeItem[] = data.createdItems ?? [];
      setItems(prev => [...createdItems, ...prev]);
      await fetchTrainingData();
    } catch (error) {
      console.error('[AdminPortal] Failed to generate items:', error);
      setAuthError('Unable to generate new admin wardrobe items.');
    } finally {
      setItemsLoading(false);
    }
  };

  const handleGenerateOutfits = async () => {
    if (!password) {
      setAuthError('Authenticate before generating outfits.');
      return;
    }
    setGeneratedOutfits([]);
    setAutoApprovedOutfits([]);
    setAutoRejectedEvaluations([]);
    setFeedbackState({});
    setOutfitsLoading(true);
    try {
      const response = await fetch(buildUrl('/api/admin/outfits/generate'), {
        method: 'POST',
        headers,
        body: JSON.stringify({
          count: outfitCount,
          prompt: prompt.trim() || undefined,
        }),
      });
      if (!response.ok) {
        const errorBody = await response.json().catch(() => ({}));
        const message = errorBody?.error ?? `Failed with status ${response.status}`;
        setAuthError(message);
        throw new Error(message);
      }
      const data = await response.json();
      const outfits: AdminGeneratedOutfit[] = data.outfits ?? [];
      const autoApproved: AdminGeneratedOutfit[] = data.autoApproved ?? [];
      const autoRejected: AdminOutfitEvaluation[] = data.autoRejected ?? [];
      setGeneratedOutfits(outfits);
      setAutoApprovedOutfits(autoApproved);
      setAutoRejectedEvaluations(autoRejected);
      resetFeedbackState(outfits);
      await fetchPendingOutfits();
      await fetchTrainingData();
      if (outfits.length === 0 && autoApproved.length === 0) {
        setAuthError('Generation completed but no outfits were returned. Add more admin items and try again.');
      } else {
        setAuthError(null);
      }
    } catch (error) {
      console.error('[AdminPortal] Failed to generate outfits:', error);
    } finally {
      setOutfitsLoading(false);
    }
  };

  const updateFeedbackState = useCallback(
    (outfitId: string, updater: (prev: FeedbackState) => FeedbackState) => {
      setFeedbackState(prev => {
        const current = prev[outfitId] ?? {
          comment: '',
          saving: false,
          error: null,
        };
        return {
          ...prev,
          [outfitId]: updater(current),
        };
      });
    },
    []
  );

  const handleDeleteTrainingRecord = useCallback(
    async (recordId: string) => {
      if (!password) {
        setAuthError('Authenticate before deleting training data.');
        return;
      }
      setTrainingError(null);
      try {
        const response = await fetch(buildUrl(`/api/admin/outfits/training/${recordId}`), {
          method: 'DELETE',
          headers,
        });
        if (!response.ok) {
          const message = `Failed with status ${response.status}`;
          setTrainingError(`Unable to delete training record: ${message}`);
          throw new Error(message);
        }
        setTrainingRecords(prev => prev.filter(record => record.id !== recordId));
      } catch (error) {
        console.error('[AdminPortal] Failed to delete training record:', error);
        setTrainingError('Unable to delete training record. Please try again.');
      }
    },
    [buildUrl, headers, password]
  );

  const handleCommentChange = (outfitId: string, comment: string) => {
    updateFeedbackState(outfitId, prev => ({
      ...prev,
      comment,
      error: null,
    }));
  };

  const handleFeedbackAction = useCallback(
    async (outfit: AdminGeneratedOutfit, feedbackType: AdminFeedbackType) => {
      const comment = feedbackState[outfit.id]?.comment ?? '';

      updateFeedbackState(outfit.id, prev => ({
        ...prev,
        saving: true,
        error: null,
      }));

      try {
        const response = await fetch(buildUrl('/api/admin/outfits/training'), {
          method: 'POST',
          headers,
          body: JSON.stringify({
            outfitId: outfit.id,
            itemIds: outfit.itemIds,
            itemTitles: outfit.itemTitles,
            feedbackType,
            feedbackComment: comment.trim() || undefined,
            prompt: prompt.trim() || undefined,
            context: prompt.trim() || undefined,
            justification: outfit.justification,
            stylingSuggestions: outfit.stylingSuggestions,
            anchorItemId: null,
          }),
        });

        if (!response.ok) {
          throw new Error(`Failed with status ${response.status}`);
        }

        setGeneratedOutfits(prev => prev.filter(entry => entry.id !== outfit.id));
        setFeedbackState(prev => {
          const next = { ...prev };
          delete next[outfit.id];
          return next;
        });
        await fetchTrainingData();
        await fetchPendingOutfits();
      } catch (error) {
        console.error('[AdminPortal] Failed to store training feedback:', error);
        updateFeedbackState(outfit.id, prev => ({
          ...prev,
          saving: false,
          error: 'Could not save feedback. Try again.',
        }));
      }
    },
    [buildUrl, feedbackState, fetchPendingOutfits, fetchTrainingData, headers, prompt, updateFeedbackState]
  );

  const wardrobeItemSummary = useMemo(() => {
    const byCategory = new Map<string, number>();
    items.forEach(item => {
      const count = byCategory.get(item.category) ?? 0;
      byCategory.set(item.category, count + 1);
    });
    return Array.from(byCategory.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [items]);

  return (
    <div className="admin-portal">
      <header className="admin-portal__header">
        <div>
          <h1>Admin Styling Lab</h1>
          <p className="admin-portal__subtitle">Seed wardrobe data, generate bulk outfits, and curate training feedback.</p>
        </div>
        {isAuthenticated && (
          <div className="admin-portal__summary">
            <span>{items.length.toLocaleString()} items</span>
            <span>{trainingRecords.length.toLocaleString()} training entries</span>
          </div>
        )}
      </header>

      {!isAuthenticated ? (
        <section className="admin-card admin-card--login">
          <h2>Enter Admin Password</h2>
          <form onSubmit={handleLoginSubmit} className="admin-login-form">
            <input
              type="password"
              placeholder="Admin password"
              value={passwordInput}
              onChange={event => setPasswordInput(event.target.value)}
              className="admin-input"
            />
            <button type="submit" className="admin-button admin-button--primary">
              Access Portal
            </button>
          </form>
          {authError && <p className="admin-error">{authError}</p>}
        </section>
      ) : (
        <>
          <nav className="admin-tabs">
            <button
              className={`admin-tab ${activeTab === 'wardrobe' ? 'admin-tab--active' : ''}`}
              onClick={() => setActiveTab('wardrobe')}
            >
              Generated Wardrobe
            </button>
            <button
              className={`admin-tab ${activeTab === 'training' ? 'admin-tab--active' : ''}`}
              onClick={() => setActiveTab('training')}
            >
              Outfit Training
            </button>
          </nav>

          {activeTab === 'wardrobe' && (
            <section className="admin-card">
              <header className="admin-card__header">
                <div>
                  <h2>Wardrobe Generator</h2>
                  <p>Spin up large batches of garments with randomized attributes and brands.</p>
                </div>
                <div className="admin-card__actions">
                  <label className="admin-inline-field">
                    <span>Batch size</span>
                    <input
                      type="number"
                      min={10}
                      max={200}
                      value={itemBatchCount}
                      onChange={event => setItemBatchCount(Number(event.target.value))}
                    />
                  </label>
                  <button
                    className="admin-button admin-button--primary"
                    onClick={handleGenerateItems}
                    disabled={itemsLoading}
                  >
                    {itemsLoading ? 'Generating...' : 'Generate Items'}
                  </button>
                </div>
              </header>

              <div className="admin-stats">
                {wardrobeItemSummary.map(([category, count]) => (
                  <span key={category}>
                    {category}: {count.toLocaleString()}
                  </span>
                ))}
              </div>

              <div className="admin-item-grid">
                {items.map(item => (
                  <article key={item.id} className="admin-item-card">
                    <header className="admin-item-card__header">
                      <span className="admin-item-card__category">
                        {item.category}
                        {item.subCategory && item.subCategory !== 'Other' ? ` · ${item.subCategory}` : ''}
                      </span>
                      {item.brand && <span className="admin-item-card__brand">{item.brand}</span>}
                    </header>
                    <h3>{item.title}</h3>
                    {item.description && <p className="admin-item-card__description">{item.description}</p>}
                    <dl className="admin-item-card__meta">
                      {item.colors && item.colors.length > 0 && (
                        <>
                          <dt>Colors</dt>
                          <dd>{item.colors.join(', ')}</dd>
                        </>
                      )}
                      {item.fabrics && item.fabrics.length > 0 && (
                        <>
                          <dt>Fabrics</dt>
                          <dd>{item.fabrics.join(', ')}</dd>
                        </>
                      )}
                      {item.pattern && (
                        <>
                          <dt>Pattern</dt>
                          <dd>{item.pattern}</dd>
                        </>
                      )}
                      {item.silhouettes && item.silhouettes.length > 0 && (
                        <>
                          <dt>Silhouettes</dt>
                          <dd>{item.silhouettes.join(', ')}</dd>
                        </>
                      )}
                      {item.formalities && item.formalities.length > 0 && (
                        <>
                          <dt>Formality</dt>
                          <dd>{item.formalities.join(', ')}</dd>
                        </>
                      )}
                      {item.styleTags && item.styleTags.length > 0 && (
                        <>
                          <dt>Style Tags</dt>
                          <dd>{item.styleTags.join(', ')}</dd>
                        </>
                      )}
                    </dl>
                  </article>
                ))}
              </div>
            </section>
          )}

          {activeTab === 'training' && (
            <section className="admin-card">
              <header className="admin-card__header">
                <div>
                  <h2>Outfit Training Playground</h2>
                  <p>Generate condensed outfit batches, then tag them with thumbs and notes for the training corpus.</p>
                </div>
                <div className="admin-card__actions">
                  <label className="admin-inline-field">
                    <span>Outfits</span>
                    <input
                      type="number"
                      min={5}
                      max={40}
                      value={outfitCount}
                      onChange={event => setOutfitCount(Number(event.target.value))}
                    />
                  </label>
                  <label className="admin-inline-field admin-inline-field--wide">
                    <span>Prompt / Context</span>
                    <input
                      type="text"
                      placeholder="Optional vibe or scenario"
                      value={prompt}
                      onChange={event => setPrompt(event.target.value)}
                    />
                  </label>
                  <button
                    className="admin-button admin-button--primary"
                    onClick={handleGenerateOutfits}
                    disabled={outfitsLoading}
                  >
                    {outfitsLoading ? 'Generating...' : 'Generate Outfits'}
                  </button>
                </div>
              </header>

              {authError && <p className="admin-error">{authError}</p>}

              <p className="admin-ai-legend">
                AI verdicts summarize the model&apos;s best guess. <strong>LIKE</strong> = ready to approve,{' '}
                <strong>DISLIKE</strong> = needs revision. Neutral calls are converted based on score so you see fewer
                undecided results.
              </p>

              {(autoApprovedOutfits.length > 0 || autoRejectedEvaluations.length > 0) && (
                <div className="admin-ai-summary">
                  {autoApprovedOutfits.length > 0 && (
                    <section className="admin-auto-panel admin-auto-panel--approved">
                      <header>
                        <h3>Auto-approved looks ({autoApprovedOutfits.length})</h3>
                        <p>
                          High-confidence wins were added directly to training data. Review the notes below if you want to
                          double-check.
                        </p>
                      </header>
                      <div className="admin-auto-panel__list">
                        {autoApprovedOutfits.map(outfit => {
                          const evaluation = outfit.evaluation;
                          return (
                            <article key={outfit.id} className="admin-auto-panel__card">
                              <div className="admin-auto-panel__card-header">
                                <span className="admin-auto-chip admin-auto-chip--verdict">
                                  Final verdict {evaluation?.finalVerdict?.toUpperCase() ?? '—'}
                                </span>
                                <span className="admin-auto-chip">
                                  Score {evaluation?.finalScore ?? '—'}/12 · conf {evaluation?.finalConfidence ?? '—'}/10
                                </span>
                              </div>
                              <h4>{outfit.itemTitles.join(', ')}</h4>
                              {evaluation?.finalRationale && (
                                <p className="admin-auto-panel__rationale">{evaluation.finalRationale}</p>
                              )}
                              {evaluation?.aiNotes && (
                                <p className="admin-auto-panel__note">{evaluation.aiNotes}</p>
                              )}
                            </article>
                          );
                        })}
                      </div>
                    </section>
                  )}
                  {autoRejectedEvaluations.length > 0 && (
                    <section className="admin-auto-panel admin-auto-panel--rejected">
                      <header>
                        <h3>Auto-declined looks ({autoRejectedEvaluations.length})</h3>
                        <p>These were confident fails and logged to the training ledger as dislikes.</p>
                      </header>
                      <ul className="admin-auto-panel__rejected-list">
                        {autoRejectedEvaluations.map(ev => (
                          <li key={ev.outfitId}>
                            <span className="admin-auto-chip">
                              Score {ev.finalScore ?? ev.triageScore ?? '—'}/12 · conf{' '}
                              {ev.finalConfidence ?? ev.triageConfidence ?? '—'}/10
                            </span>
                            {ev.finalVerdict && (
                              <span className="admin-auto-chip admin-auto-chip--verdict">
                                Verdict {ev.finalVerdict.toUpperCase()}
                              </span>
                            )}
                            {ev.structuralIssues && ev.structuralIssues.length > 0 && (
                              <p>Structure flags: {ev.structuralIssues.join('; ')}</p>
                            )}
                            {ev.finalRationale && <p>{ev.finalRationale}</p>}
                            {!ev.finalRationale && ev.aiNotes && <p>{ev.aiNotes}</p>}
                          </li>
                        ))}
                      </ul>
                    </section>
                  )}
                </div>
              )}

              <div className="admin-outfit-grid">
                {generatedOutfits.map(outfit => {
                  const state = feedbackState[outfit.id] ?? {
                    comment: '',
                    saving: false,
                    error: null,
                  };
                  const noteId = `admin-outfit-note-${outfit.id}`;
                  const evaluation = outfit.evaluation;
                  const resolvedScore = evaluation?.finalScore ?? evaluation?.triageScore;
                  const resolvedConfidence = evaluation?.finalConfidence ?? evaluation?.triageConfidence;
                  const resolvedVerdict = evaluation?.finalVerdict ?? evaluation?.triageVerdict;
                  const resolvedStage = evaluation?.finalScore !== undefined || evaluation?.finalVerdict !== undefined ? 'Final' : 'AI';
                  const aiSummary =
                    evaluation && (resolvedScore !== undefined || resolvedConfidence !== undefined || resolvedVerdict)
                      ? `${resolvedStage} verdict ${resolvedVerdict?.toUpperCase() ?? '—'} · score ${
                          resolvedScore ?? '—'
                        }/12 · conf ${resolvedConfidence ?? '—'}/10`
                      : null;

                  return (
                    <article key={outfit.id} className="admin-outfit-row">
                      {aiSummary && (
                        <div className="admin-outfit-row__evaluation">
                          <span className="admin-outfit-row__chip">{aiSummary}</span>
                        </div>
                      )}

                      <div className="admin-outfit-row__section">
                        <h3 className="admin-outfit-row__heading">Wardrobe pieces</h3>
                        <div className="admin-outfit-row__items">
                          {outfit.items.map(item => {
                            const attributes: Array<{ label: string; value: string }> = [];
                            if (item.colors && item.colors.length > 0) {
                              attributes.push({ label: 'Colors', value: item.colors.join(', ') });
                            }
                            if (item.pattern) {
                              attributes.push({ label: 'Pattern', value: item.pattern });
                            }
                            if (item.silhouettes && item.silhouettes.length > 0) {
                              attributes.push({ label: 'Silhouettes', value: item.silhouettes.join(', ') });
                            }
                            if (item.fit) {
                              attributes.push({ label: 'Fit', value: item.fit });
                            }
                            if (item.formalities && item.formalities.length > 0) {
                              attributes.push({ label: 'Formalities', value: item.formalities.join(', ') });
                            }
                            if (item.styleTags && item.styleTags.length > 0) {
                              attributes.push({ label: 'Style Tags', value: item.styleTags.join(', ') });
                            }
                            if (item.seasons && item.seasons.length > 0) {
                              attributes.push({ label: 'Seasons', value: item.seasons.join(', ') });
                            }
                            if (item.occasions && item.occasions.length > 0) {
                              attributes.push({ label: 'Occasions', value: item.occasions.join(', ') });
                            }

                            return (
                              <div key={item.id} className="admin-outfit-row__item">
                                <div className="admin-outfit-row__item-header">
                                  <span className="admin-outfit-row__item-title">{item.title}</span>
                                  <span className="admin-outfit-row__item-meta">
                                    {item.category}
                                    {item.subCategory && item.subCategory !== 'Other' ? ` · ${item.subCategory}` : ''}
                                    {item.brand ? ` · ${item.brand}` : ''}
                                  </span>
                                </div>
                                {attributes.length > 0 && (
                                  <div className="admin-outfit-row__attributes">
                                    {attributes.map(attribute => (
                                      <span
                                        key={`${item.id}-${attribute.label}`}
                                        className="admin-outfit-row__attribute"
                                      >
                                        <strong>{attribute.label}:</strong> {attribute.value}
                                      </span>
                                    ))}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      <div className="admin-outfit-row__section admin-outfit-row__section--context">
                        <h3 className="admin-outfit-row__heading">Model context</h3>
                        {evaluation?.finalRationale && (
                          <div className="admin-outfit-row__context-block">
                            <span className="admin-outfit-row__context-label">AI rationale</span>
                            <p className="admin-outfit-row__ai-summary">{evaluation.finalRationale}</p>
                          </div>
                        )}
                        {evaluation?.aiNotes && !evaluation.finalRationale && (
                          <div className="admin-outfit-row__context-block">
                            <span className="admin-outfit-row__context-label">AI notes</span>
                            <p className="admin-outfit-row__ai-summary">{evaluation.aiNotes}</p>
                          </div>
                        )}
                        {evaluation?.structuralIssues && evaluation.structuralIssues.length > 0 && (
                          <div className="admin-outfit-row__context-block admin-outfit-row__context-block--warning">
                            <span className="admin-outfit-row__context-label">Structure notes</span>
                            <ul>
                              {evaluation.structuralIssues.map(issue => (
                                <li key={issue}>{issue}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                        <div className="admin-outfit-row__context-block">
                          <span className="admin-outfit-row__context-label">Prompt</span>
                          <p>{prompt.trim() || '—'}</p>
                        </div>
                        <div className="admin-outfit-row__context-block">
                          <span className="admin-outfit-row__context-label">Why it works</span>
                          <p>{outfit.justification}</p>
                        </div>
                        {outfit.stylingSuggestions.length > 0 && (
                          <div className="admin-outfit-row__context-block">
                            <span className="admin-outfit-row__context-label">Styling prompts</span>
                            <ul>
                              {outfit.stylingSuggestions.map((tip, index) => (
                                <li key={index}>{tip}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>

                      <div className="admin-outfit-row__section admin-outfit-row__section--feedback">
                        <h3 className="admin-outfit-row__heading">Your verdict</h3>
                        <label className="admin-outfit-row__note-label" htmlFor={noteId}>
                          Quick note (optional)
                        </label>
                        <textarea
                          id={noteId}
                          className="admin-outfit-row__note"
                          placeholder="What should we learn from this look?"
                          value={state.comment}
                          onChange={event => handleCommentChange(outfit.id, event.target.value)}
                          disabled={state.saving}
                        />
                        {state.error && <p className="admin-error">{state.error}</p>}
                        <div className="admin-outfit-row__actions">
                          <button
                            type="button"
                            className="admin-feedback-button admin-feedback-button--like"
                            onClick={() => handleFeedbackAction(outfit, 'like')}
                            disabled={state.saving}
                          >
                            👍 Approve
                          </button>
                          <button
                            type="button"
                            className="admin-feedback-button admin-feedback-button--dislike"
                            onClick={() => handleFeedbackAction(outfit, 'dislike')}
                            disabled={state.saving}
                          >
                            👎 Reject
                          </button>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>
          )}

          <section className="admin-card">
            <header className="admin-card__header">
              <div>
                <h2>Training Data Ledger</h2>
                <p>Snapshot of the most recent labels stored for model fine-tuning.</p>
              </div>
              <button
                className="admin-button admin-button--ghost"
                onClick={() => fetchTrainingData()}
                disabled={trainingLoading}
              >
                {trainingLoading ? 'Refreshing...' : 'Refresh'}
              </button>
            </header>

            {trainingError && <p className="admin-error">{trainingError}</p>}

            <div className="admin-training-table">
              <table>
                <thead>
                  <tr>
                    <th>Timestamp</th>
                    <th>Feedback</th>
                    <th>Items</th>
                    <th>Comment</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {trainingRecords.slice(0, 25).map(record => (
                    <tr key={record.id}>
                      <td>{new Date(record.createdAt).toLocaleString()}</td>
                      <td className={`admin-training-badge admin-training-badge--${record.feedbackType}`}>
                        {record.feedbackType.toUpperCase()}
                      </td>
                      <td className="admin-training-items">
                        {record.itemTitles.join(', ')}
                      </td>
                      <td>{record.feedbackComment || '—'}</td>
                      <td className="admin-training-actions">
                        <button
                          type="button"
                          onClick={() => handleDeleteTrainingRecord(record.id)}
                          title="Discard feedback"
                        >
                          🗑️
                        </button>
                      </td>
                    </tr>
                  ))}
                  {trainingRecords.length === 0 && (
                    <tr>
                      <td colSpan={5} className="admin-training-empty">
                        No training entries yet. Generate outfits, tag them, and they&apos;ll land here.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </div>
  );
};

export default AdminPortal;


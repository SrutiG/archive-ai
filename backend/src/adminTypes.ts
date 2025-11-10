export type AdminFeedbackType = 'like' | 'dislike' | 'neutral';

export interface AdminOutfitItemSummary {
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
}

export interface AdminOutfitCandidate {
  id: string;
  itemIds: string[];
  itemTitles: string[];
  items: AdminOutfitItemSummary[];
  justification: string;
  stylingSuggestions: string[];
  prompt?: string;
}

export interface AdminOutfitEvaluation {
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
}

export interface AdminWardrobeItem {
  id: string;
  title: string;
  description?: string;
  brand?: string;
  category: string;
  subCategory?: string;
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
  imageUrl?: string;
  createdAt: string;
}

export interface OutfitTrainingRecord {
  id: string;
  itemIds: string[];
  itemTitles: string[];
  prompt?: string;
  context?: string;
  stylingNotes?: string;
  feedbackType: AdminFeedbackType;
  feedbackComment?: string;
  anchorItemId?: string | null;
  generationMetadata?: Record<string, unknown> | null;
  createdAt: string;
}

export type AdminGeneratedOutfitStatus = 'pending' | 'auto_rejected';

export interface AdminGeneratedOutfitRecord {
  id: string;
  itemIds: string[];
  itemTitles: string[];
  items: AdminOutfitItemSummary[];
  prompt?: string;
  context?: string;
  justification: string;
  stylingSuggestions: string[];
  evaluation: AdminOutfitEvaluation | null;
  status: AdminGeneratedOutfitStatus;
  createdAt: string;
}


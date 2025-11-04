import React, { useState } from 'react';
import './FeedbackModal.css';

interface FeedbackModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (feedback: string) => void;
  type: 'like' | 'dislike';
  outfitItems: string[];
}

const FeedbackModal: React.FC<FeedbackModalProps> = ({ 
  isOpen, 
  onClose, 
  onSubmit, 
  type,
  outfitItems 
}) => {
  const [feedbackText, setFeedbackText] = useState('');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(feedbackText);
    setFeedbackText('');
  };

  const handleClose = () => {
    setFeedbackText('');
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={handleClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{type === 'like' ? 'Like' : 'Dislike'} Outfit</h2>
          <button className="modal-close" onClick={handleClose}>×</button>
        </div>
        
        <div className="modal-body">
          <p className="modal-outfit-items">
            {outfitItems.join(' + ')}
          </p>
          
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label htmlFor="feedback">
                Why do you {type === 'like' ? 'like' : 'dislike'} this outfit? (Optional)
              </label>
              <textarea
                id="feedback"
                value={feedbackText}
                onChange={(e) => setFeedbackText(e.target.value)}
                placeholder={type === 'like' 
                  ? "e.g., 'Love the color combination, fits my style perfectly'"
                  : "e.g., 'Too casual for this occasion, colors don't work together'"}
                rows={4}
                className="feedback-textarea"
              />
            </div>
            
            <div className="modal-actions">
              <button type="button" className="btn btn-secondary" onClick={handleClose}>
                Cancel
              </button>
              <button type="submit" className="btn btn-primary">
                Submit {type === 'like' ? 'Like' : 'Dislike'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default FeedbackModal;


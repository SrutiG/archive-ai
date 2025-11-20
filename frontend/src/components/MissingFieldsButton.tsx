import React, { useState, useMemo, useEffect, useRef } from 'react';
import { WardrobeItem, WardrobeColorOption, WardrobeSilhouetteOption } from '../App';
import { checkMissingFields, MissingFieldInfo } from '../utils/checkMissingFields';
import { COLOR_OPTIONS, SILHOUETTE_OPTIONS } from '../constants/wardrobeAttributes';
import { apiPut } from '../utils/api';
import StockPhotoImage from './StockPhotoImage';
import './MissingFieldsButton.css';

interface QuizQuestion {
  item: WardrobeItem;
  field: string;
  fieldLabel: string;
}

interface MissingFieldsButtonProps {
  items: WardrobeItem[];
  onItemUpdated: (updatedItem: WardrobeItem) => void;
  apiUrl: string;
}

const MissingFieldsButton: React.FC<MissingFieldsButtonProps> = ({ items, onItemUpdated, apiUrl }) => {
  const [showQuiz, setShowQuiz] = useState(false);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [initialQuestionCount, setInitialQuestionCount] = useState(0);
  const [isAnswering, setIsAnswering] = useState(false);
  const itemsRef = useRef(items);
  const isAnsweringRef = useRef(false);
  const targetIndexRef = useRef<number | null>(null);
  
  // Keep ref in sync with items
  useEffect(() => {
    itemsRef.current = items;
  }, [items]);
  
  const missingFields = useMemo(() => checkMissingFields(items), [items]);
  
  // Build quiz questions from missing fields when quiz opens or items change
  useEffect(() => {
    if (!showQuiz) {
      // Reset initial count when modal closes
      setInitialQuestionCount(0);
      return;
    }
    
    // If we're answering, don't rebuild questions yet - wait for the answer to complete
    if (isAnswering || isAnsweringRef.current) return;
    
    const currentMissingFields = checkMissingFields(items);
    if (currentMissingFields.length > 0) {
      const quizQuestions: QuizQuestion[] = [];
      currentMissingFields.forEach(({ item, missingFields: fields }) => {
        fields.forEach(field => {
          quizQuestions.push({
            item,
            field,
            fieldLabel: field === 'neckline' ? 'neckline' : field === 'length' ? 'length' : field === 'rise' ? 'rise' : 'color'
          });
        });
      });
      
      // Set initial count only if it's not set yet (when modal first opens)
      if (initialQuestionCount === 0) {
        setInitialQuestionCount(quizQuestions.length);
      }
      
      // Find the current question in the new questions array to preserve position
      const currentQuestion = questions[currentQuestionIndex];
      let newIndex = currentQuestionIndex;
      
      // If we have a target index from a recent answer, use that
      if (targetIndexRef.current !== null) {
        newIndex = Math.min(targetIndexRef.current, quizQuestions.length - 1);
        targetIndexRef.current = null; // Clear it after using
      } else if (currentQuestion) {
        // Try to find the same question (same item + field) in the new array
        const foundIndex = quizQuestions.findIndex(
          q => q.item.id === currentQuestion.item.id && q.field === currentQuestion.field
        );
        if (foundIndex !== -1) {
          newIndex = foundIndex;
        } else {
          // Current question no longer exists (was answered), keep current index or clamp
          newIndex = Math.min(currentQuestionIndex, quizQuestions.length - 1);
        }
      } else {
        // No current question, clamp to valid range
        newIndex = Math.min(currentQuestionIndex, quizQuestions.length - 1);
      }
      
      // Update questions and index together
      setQuestions(quizQuestions);
      setCurrentQuestionIndex(newIndex);
    }
    // Don't close modal here - only close explicitly when we're done answering
  }, [showQuiz, items, isAnswering]);
  
  if (missingFields.length === 0) {
    return null;
  }
  
  // Ensure we have a valid question index
  const validQuestionIndex = Math.min(currentQuestionIndex, Math.max(0, questions.length - 1));
  const currentQuestion = questions[validQuestionIndex];
  const progress = questions.length > 0 ? ((validQuestionIndex + 1) / questions.length) * 100 : 0;
  
  const getOptions = (): Array<{ value: string; label: string }> => {
    if (!currentQuestion) return [];
    
    const { field, item } = currentQuestion;
    
    if (field === 'color') {
      return COLOR_OPTIONS;
    } else if (field === 'neckline') {
      // Check if this is outerwear
      if (item.category === 'Outerwear') {
        // Simplified neckline options for outerwear
        const outerwearNecklineOptions = [
          'hooded', 'collared', 'lapel', 'v-neck', 'collarless'
        ];
        return SILHOUETTE_OPTIONS.filter(opt => outerwearNecklineOptions.includes(opt.value));
      } else {
        // Standard neckline options for tops
        const necklineOptions = [
          'v-neck', 'boat-neck', 'mock-neck', 'turtleneck', 'crew-neck',
          'scoop-neck', 'scoop', 'square-neck', 'sweetheart', 'off-the-shoulder',
          'halter-neck', 'cowl-neck', 'hooded', 'collared', 'collarless'
        ];
        return SILHOUETTE_OPTIONS.filter(opt => necklineOptions.includes(opt.value));
      }
    } else if (field === 'length') {
      // Filter to length options based on category
      if (item.category === 'Bottoms') {
        const bottomLengths = [
          'cropped', 'ankle-length', 'full-length', 'capri', '7/8-length',
          '3/4-length', 'mini', 'midi', 'maxi', 'tea-length', 'floor-length'
        ];
        return SILHOUETTE_OPTIONS.filter(opt => bottomLengths.includes(opt.value));
      } else {
        // Tops or Outerwear
        const topLengths = ['cropped', 'hip-length', 'mid-thigh', 'waist-length', 'knee-length', 'long'];
        return SILHOUETTE_OPTIONS.filter(opt => topLengths.includes(opt.value));
      }
    } else if (field === 'rise') {
      // Rise options for bottoms only
      const riseOptions = ['high-rise', 'mid-rise', 'low-rise'];
      return SILHOUETTE_OPTIONS.filter(opt => riseOptions.includes(opt.value));
    }
    return [];
  };
  
  const handleAnswer = async (value: string) => {
    if (!currentQuestion) return;
    
    const { item, field } = currentQuestion;
    const currentIndex = validQuestionIndex;
    const totalQuestions = questions.length;
    
    // Mark as answering to prevent modal from closing (use both state and ref)
    isAnsweringRef.current = true;
    setIsAnswering(true);
    
    // Don't move to next question yet - wait for the update to complete
    // This prevents flickering when questions rebuild
    const nextIndex = currentIndex + 1;
    
    // Update item in the background
    try {
      const updateData: any = {};
      
      if (field === 'color') {
        updateData.colors = [value as WardrobeColorOption];
      } else if (field === 'neckline' || field === 'length' || field === 'rise') {
        const currentSilhouettes = item.silhouettes || (item.silhouette ? [item.silhouette] : []);
        // Only add if not already present
        if (!currentSilhouettes.includes(value as WardrobeSilhouetteOption)) {
          const newSilhouettes = [...currentSilhouettes, value as WardrobeSilhouetteOption];
          updateData.silhouettes = newSilhouettes;
        } else {
          // Already has this silhouette, just move to next question
          // No need to update the item since it already has the value
          if (nextIndex < totalQuestions) {
            targetIndexRef.current = nextIndex;
            // Trigger a rebuild by updating items ref (even though items haven't changed)
            // Actually, just set the index directly since no item update is needed
            setTimeout(() => {
              setCurrentQuestionIndex(nextIndex);
              isAnsweringRef.current = false;
              setIsAnswering(false);
            }, 50);
          } else {
            isAnsweringRef.current = false;
            setIsAnswering(false);
          }
          return;
        }
      }
      
      // Update item in background (don't wait for response)
      apiPut(`/api/items/${item.id}`, updateData)
        .then(async response => {
          if (response.ok) {
            // Construct the updated item from the current item + update data
            const updatedItem: WardrobeItem = {
              ...item,
              ...updateData,
              // Ensure arrays are properly set
              colors: updateData.colors || item.colors,
              silhouettes: updateData.silhouettes || item.silhouettes || (item.silhouette ? [item.silhouette] : []),
            };
            
            // Update the item in parent state (this won't cause a full page refresh)
            onItemUpdated(updatedItem);
            
            // Set target index for the useEffect to use when rebuilding questions
            targetIndexRef.current = nextIndex;
            
            // Reset answering flag after a brief delay to allow questions to rebuild
            setTimeout(() => {
              isAnsweringRef.current = false;
              setIsAnswering(false);
              
              // Check if we should close - we were at the end and items have updated
              if (nextIndex >= totalQuestions) {
                // Wait a bit more for questions to rebuild, then check with latest items
                setTimeout(() => {
                  const finalMissingFields = checkMissingFields(itemsRef.current);
                  if (finalMissingFields.length === 0) {
                    setShowQuiz(false);
                  }
                }, 200);
              }
            }, 200);
          } else {
            console.error('Failed to update item');
            // Revert to current question if update failed
            setCurrentQuestionIndex(currentIndex);
            isAnsweringRef.current = false;
            setIsAnswering(false);
          }
        })
        .catch(error => {
          console.error('Error updating item:', error);
          // Revert to current question if update failed
          setCurrentQuestionIndex(currentIndex);
          isAnsweringRef.current = false;
          setIsAnswering(false);
        });
    } catch (error) {
      console.error('Error updating item:', error);
      // Revert to current question if update failed
      setCurrentQuestionIndex(currentIndex);
      isAnsweringRef.current = false;
      setIsAnswering(false);
    }
  };
  
  const handleSkip = () => {
    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
    } else {
      setShowQuiz(false);
    }
  };
  
  const getQuestionText = (): string => {
    if (!currentQuestion) return '';
    const { item, fieldLabel } = currentQuestion;
    return `What's the ${fieldLabel} of ${item.title}?`;
  };
  
  return (
    <>
      <button
        className="missing-fields-button"
        onClick={() => setShowQuiz(true)}
        title="Fill in missing details to help generate better outfits"
      >
        <span className="missing-fields-icon">!</span>
        <span className="missing-fields-text">
          Fill in missing details ({missingFields.reduce((sum, { missingFields: fields }) => sum + fields.length, 0)})
        </span>
      </button>
      
      {showQuiz && (
        <>
          <div className="missing-fields-overlay" onClick={() => setShowQuiz(false)} />
          <div className="missing-fields-quiz">
            <div className="missing-fields-quiz-header">
              <button className="close-button" onClick={() => setShowQuiz(false)}>×</button>
            </div>
            <div className="missing-fields-quiz-content">
              <div className="missing-fields-quiz-description">
                Help us generate better outfits by filling in a few details about your wardrobe items.
              </div>
              {questions.length > 0 && (
                <div className="missing-fields-quiz-progress">
                  <div className="progress-bar">
                    <div className="progress-fill" style={{ width: `${progress}%` }} />
                  </div>
                  <div className="progress-text">
                    {validQuestionIndex + 1} of {initialQuestionCount || questions.length}
                  </div>
                </div>
              )}
              {currentQuestion ? (
                <>
                  <div className="missing-fields-quiz-item-image">
                    <StockPhotoImage item={currentQuestion.item} apiUrl={apiUrl} />
                  </div>
                  <div className="missing-fields-quiz-question">
                    {getQuestionText()}
                  </div>
                  <div className="missing-fields-quiz-options">
                    {getOptions().map(option => (
                      <button
                        key={option.value}
                        className="quiz-option-button"
                        onClick={() => handleAnswer(option.value)}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </>
              ) : questions.length > 0 ? (
                <div className="missing-fields-quiz-question">
                  Loading next question...
                </div>
              ) : (
                <div className="missing-fields-quiz-question">
                  No more questions to answer.
                </div>
              )}
              <div className="missing-fields-quiz-actions">
                <button className="skip-button" onClick={handleSkip}>
                  Skip
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
};

export default MissingFieldsButton;


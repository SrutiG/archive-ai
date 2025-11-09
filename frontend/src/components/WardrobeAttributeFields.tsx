import React, { useMemo } from 'react';
import {
  COLOR_OPTIONS,
  FABRIC_OPTIONS,
  PATTERN_OPTIONS,
  SILHOUETTE_OPTIONS,
  FIT_OPTIONS,
  FORMALITY_OPTIONS,
  STYLE_TAG_OPTIONS,
  SEASON_OPTIONS,
  OCCASION_OPTIONS,
  BRAND_OPTIONS,
} from '../constants/wardrobeAttributes';
import {
  MultiSelectAutocomplete,
  SingleSelectAutocomplete,
} from './AttributeAutocomplete';
import { getVisibleAttributes, WardrobeAttributeId } from '../constants/wardrobeAttributeVisibility';

const CATEGORY_SILHOUETTE_VALUES: Record<string, string[]> = {
  Tops: [
    'fit-and-flare',
    'cocoon',
    'trapeze',
    'bodycon',
    'cropped',
    'column',
    'long-sleeve',
    'short-sleeve',
    'sleeveless',
    'peplum',
    'asymmetrical-hem',
    'v-neck',
    'boat-neck',
    'mock-neck',
    'turtleneck',
    'crew-neck',
    'scoop-neck',
    'square-neck',
    'sweetheart',
    'off-the-shoulder',
    'halter-neck',
    'cowl-neck',
    'hooded',
    'collared',
    'collarless',
  ],
  'Tees': [
    'column',
    'cropped',
    'short-sleeve',
    'long-sleeve',
    'v-neck',
    'boat-neck',
    'mock-neck',
    'turtleneck',
    'crew-neck',
    'scoop-neck',
    'square-neck',
    'sweetheart',
    'off-the-shoulder',
    'cowl-neck',
    'hooded',
  ],
  'T-Shirts': [
    'column',
    'cropped',
    'short-sleeve',
    'long-sleeve',
    'v-neck',
    'boat-neck',
    'mock-neck',
    'turtleneck',
    'crew-neck',
    'scoop-neck',
    'square-neck',
    'sweetheart',
    'off-the-shoulder',
    'cowl-neck',
    'hooded',
  ],
  'Button-Ups': ['column', 'cropped', 'long-sleeve', 'short-sleeve', 'collared', 'collarless'],
  'Sweaters': [
    'column',
    'cropped',
    'long-sleeve',
    'short-sleeve',
    'mock-neck',
    'turtleneck',
    'boat-neck',
    'v-neck',
    'crew-neck',
    'cowl-neck',
    'hooded',
    'scoop-neck',
  ],
  'Tanks & Camis': [
    'column',
    'cropped',
    'bodycon',
    'sleeveless',
    'peplum',
    'v-neck',
    'asymmetrical-hem',
    'halter-neck',
    'scoop-neck',
    'square-neck',
    'sweetheart',
    'mock-neck',
    'turtleneck',
  ],
  Bodysuits: [
    'column',
    'cropped',
    'bodycon',
    'sleeveless',
    'short-sleeve',
    'long-sleeve',
    'v-neck',
    'mock-neck',
    'turtleneck',
    'halter-neck',
    'off-the-shoulder',
    'sweetheart',
  ],
  Bottoms: ['a-line', 'fit-and-flare', 'wide-leg', 'straight-leg', 'cropped', 'column', 'bodycon', 'asymmetrical-hem'],
  Pants: ['wide-leg', 'straight-leg', 'cropped', 'column', 'bodycon', 'asymmetrical-hem'],
  Jeans: ['wide-leg', 'straight-leg', 'cropped', 'column', 'asymmetrical-hem'],
  Skirt: ['a-line', 'fit-and-flare', 'trapeze', 'column', 'bodycon', 'peplum', 'asymmetrical-hem'],
  Shorts: ['cropped', 'column', 'bodycon', 'fit-and-flare', 'asymmetrical-hem'],
  Leggings: ['column', 'bodycon'],
  Joggers: ['cropped', 'column'],
  Dresses: [
    'a-line',
    'fit-and-flare',
    'column',
    'trapeze',
    'bodycon',
    'cocoon',
    'sleeveless',
    'short-sleeve',
    'long-sleeve',
    'peplum',
    'asymmetrical-hem',
    'v-neck',
    'boat-neck',
    'mock-neck',
    'turtleneck',
  ],
  'Dresses & One-Pieces': [
    'a-line',
    'fit-and-flare',
    'column',
    'trapeze',
    'bodycon',
    'cocoon',
    'sleeveless',
    'short-sleeve',
    'long-sleeve',
    'peplum',
    'asymmetrical-hem',
    'v-neck',
    'boat-neck',
    'mock-neck',
    'turtleneck',
  ],
  'Jumpsuits & Rompers': ['column', 'bodycon', 'fit-and-flare', 'cropped', 'long-sleeve', 'short-sleeve', 'sleeveless'],
  Overalls: ['column', 'cropped', 'wide-leg', 'straight-leg'],
  Outerwear: ['cocoon', 'trapeze', 'bodycon', 'column', 'cropped', 'long-sleeve', 'short-sleeve'],
  'Underwear & Sleepwear': ['bodycon', 'fit-and-flare', 'column', 'sleeveless', 'short-sleeve', 'long-sleeve'],
  Swimwear: ['bodycon', 'sleeveless', 'short-sleeve', 'long-sleeve'],
  Activewear: ['bodycon', 'fit-and-flare', 'cropped', 'column', 'sleeveless', 'short-sleeve', 'long-sleeve'],
  default: [
    'a-line',
    'column',
    'fit-and-flare',
    'cocoon',
    'trapeze',
    'bodycon',
    'wide-leg',
    'straight-leg',
    'cropped',
    'long-sleeve',
    'short-sleeve',
    'sleeveless',
    'peplum',
    'asymmetrical-hem',
    'v-neck',
    'boat-neck',
    'mock-neck',
    'turtleneck',
    'crew-neck',
    'scoop-neck',
    'square-neck',
    'sweetheart',
    'off-the-shoulder',
    'halter-neck',
    'cowl-neck',
    'hooded',
    'collared',
    'collarless',
    'other',
  ],
};

interface WardrobeAttributeFieldsProps {
  category?: string;
  subCategory?: string;
  showDetails: boolean;
  onToggleDetails: () => void;
  selectedColors: string[];
  onColorsChange: (values: string[]) => void;
  selectedFabrics: string[];
  onFabricsChange: (values: string[]) => void;
  selectedSilhouettes: string[];
  onSilhouettesChange: (values: string[]) => void;
  selectedFormalities: string[];
  onFormalitiesChange: (values: string[]) => void;
  selectedStyleTags: string[];
  onStyleTagsChange: (values: string[]) => void;
  selectedSeasons: string[];
  onSeasonsChange: (values: string[]) => void;
  selectedOccasions: string[];
  onOccasionsChange: (values: string[]) => void;
  pattern: string;
  onPatternChange: (value: string) => void;
  fit: string;
  onFitChange: (value: string) => void;
  brand: string;
  onBrandChange: (value: string) => void;
  careNotes: string;
  onCareNotesChange: (value: string) => void;
}

const findLabel = (options: { value: string; label: string }[], value: string): string =>
  options.find((option) => option.value === value)?.label || value;

const WardrobeAttributeFields: React.FC<WardrobeAttributeFieldsProps> = ({
  category,
  subCategory,
  showDetails,
  onToggleDetails,
  selectedColors,
  onColorsChange,
  selectedFabrics,
  onFabricsChange,
  selectedSilhouettes,
  onSilhouettesChange,
  selectedFormalities,
  onFormalitiesChange,
  selectedStyleTags,
  onStyleTagsChange,
  selectedSeasons,
  onSeasonsChange,
  selectedOccasions,
  onOccasionsChange,
  pattern,
  onPatternChange,
  fit,
  onFitChange,
  brand,
  onBrandChange,
  careNotes,
  onCareNotesChange,
}) => {
  const visibleAttributes = useMemo(
    () => getVisibleAttributes(category, subCategory),
    [category, subCategory]
  );

  const hasAttribute = useMemo(() => {
    const set = new Set<WardrobeAttributeId>(visibleAttributes);
    return (attribute: WardrobeAttributeId) => set.has(attribute);
  }, [visibleAttributes]);

  const showSilhouettes = hasAttribute('silhouettes');

  const silhouetteOptions = useMemo(() => {
    if (!showSilhouettes) {
      return [];
    }

    const lookupKeys = [
      subCategory ?? '',
      category ?? '',
    ].filter(Boolean);

    let allowedValues: string[] | undefined;
    for (const key of lookupKeys) {
      if (CATEGORY_SILHOUETTE_VALUES[key]) {
        allowedValues = CATEGORY_SILHOUETTE_VALUES[key];
        break;
      }
    }

    if (!allowedValues) {
      allowedValues = CATEGORY_SILHOUETTE_VALUES[category ?? ''] ?? CATEGORY_SILHOUETTE_VALUES['default'];
    }

    if (!allowedValues) {
      allowedValues = CATEGORY_SILHOUETTE_VALUES.default;
    }

    const baseSet = new Set(allowedValues);
    const baseOptions = SILHOUETTE_OPTIONS.filter(option => baseSet.has(option.value));

    const missingSelections = selectedSilhouettes.filter(
      value => !baseOptions.some(option => option.value === value)
    );

    if (missingSelections.length === 0) {
      return baseOptions;
    }

    const supplemental = missingSelections.map(value => ({
      value,
      label: findLabel(SILHOUETTE_OPTIONS, value),
    }));

    return [...baseOptions, ...supplemental];
  }, [showSilhouettes, category, subCategory, selectedSilhouettes]);

  const summaryText = useMemo(() => {
    const parts: string[] = [];

    if (hasAttribute('colors') && selectedColors.length > 0) parts.push(`${selectedColors.length} colors`);
    if (hasAttribute('fabrics') && selectedFabrics.length > 0) parts.push(`${selectedFabrics.length} fabrics`);
    if (hasAttribute('formalities') && selectedFormalities.length > 0) parts.push(`${selectedFormalities.length} formalities`);
    if (hasAttribute('styleTags') && selectedStyleTags.length > 0) parts.push(`${selectedStyleTags.length} style tags`);
    if (hasAttribute('seasons') && selectedSeasons.length > 0) parts.push(`${selectedSeasons.length} seasons`);
    if (hasAttribute('occasions') && selectedOccasions.length > 0) parts.push(`${selectedOccasions.length} occasions`);
    if (hasAttribute('pattern') && pattern) parts.push(`Pattern: ${findLabel(PATTERN_OPTIONS, pattern)}`);
    if (showSilhouettes && selectedSilhouettes.length > 0) {
      const labels = selectedSilhouettes
        .map((value) => findLabel(SILHOUETTE_OPTIONS, value))
        .join(', ');
      parts.push(`Silhouettes: ${labels}`);
    }
    if (hasAttribute('fit') && fit) parts.push(`Fit: ${findLabel(FIT_OPTIONS, fit)}`);
    if (hasAttribute('brand') && brand) parts.push(`Brand: ${brand}`);
    if (hasAttribute('careNotes') && careNotes.trim().length > 0) parts.push('Care notes added');

    if (parts.length === 0) {
      return showSilhouettes
        ? 'Optional: add silhouettes, colors, fabrics, seasons, fit, care notes, and more.'
        : 'Optional: add colors, fabrics, seasons, fit, care notes, and more.';
    }

    const preview = parts.slice(0, 3).join(', ');
    return parts.length > 3 ? `${preview}, …` : preview;
  }, [
    hasAttribute,
    selectedColors,
    selectedFabrics,
    selectedSilhouettes,
    selectedFormalities,
    selectedStyleTags,
    selectedSeasons,
    selectedOccasions,
    pattern,
    fit,
    brand,
    careNotes,
  ]);

  return (
    <div className="attribute-wrapper">
      <div className="attribute-toggle-row">
        <button
          type="button"
          className="attribute-toggle-link"
          onClick={onToggleDetails}
        >
          <span>{showDetails ? 'Hide additional attributes' : 'Add additional attributes'}</span>
          <span
            className={`attribute-arrow ${showDetails ? 'open' : ''}`}
            aria-hidden="true"
          >
            ▾
          </span>
        </button>
        <span className="attribute-toggle-summary">{summaryText}</span>
      </div>

      {showDetails && (
        <div className="attribute-section">
          <p className="attribute-intro">
            The more context you add, the smarter outfit suggestions become. Fill in what you
            know today—refine anytime.
          </p>

          <div className="attribute-groups">
            {hasAttribute('colors') && (
              <MultiSelectAutocomplete
                label="Colors"
                options={COLOR_OPTIONS}
                values={selectedColors}
                onChange={onColorsChange}
              />
            )}
            {hasAttribute('fabrics') && (
              <MultiSelectAutocomplete
                label="Fabrics"
                options={FABRIC_OPTIONS}
                values={selectedFabrics}
                onChange={onFabricsChange}
              />
            )}
            {hasAttribute('pattern') && (
              <SingleSelectAutocomplete
                label="Pattern"
                options={PATTERN_OPTIONS}
                value={pattern}
                onChange={onPatternChange}
              />
            )}
            {showSilhouettes && (
              <MultiSelectAutocomplete
                label="Silhouettes"
                options={silhouetteOptions}
                values={selectedSilhouettes}
                onChange={onSilhouettesChange}
              />
            )}
            {hasAttribute('fit') && (
              <SingleSelectAutocomplete
                label="Fit"
                options={FIT_OPTIONS}
                value={fit}
                onChange={onFitChange}
              />
            )}
            {hasAttribute('formalities') && (
              <MultiSelectAutocomplete
                label="Formalities"
                options={FORMALITY_OPTIONS}
                values={selectedFormalities}
                onChange={onFormalitiesChange}
              />
            )}
            {hasAttribute('styleTags') && (
              <MultiSelectAutocomplete
                label="Style Tags"
                options={STYLE_TAG_OPTIONS}
                values={selectedStyleTags}
                onChange={onStyleTagsChange}
              />
            )}
            {hasAttribute('seasons') && (
              <MultiSelectAutocomplete
                label="Seasons"
                options={SEASON_OPTIONS}
                values={selectedSeasons}
                onChange={onSeasonsChange}
              />
            )}
            {hasAttribute('occasions') && (
              <MultiSelectAutocomplete
                label="Occasions"
                options={OCCASION_OPTIONS}
                values={selectedOccasions}
                onChange={onOccasionsChange}
              />
            )}
            {hasAttribute('brand') && (
              <SingleSelectAutocomplete
                label="Brand"
                options={BRAND_OPTIONS}
                value={brand}
                onChange={onBrandChange}
                allowCustom={false}
                placeholder="Search brands…"
              />
            )}
            {hasAttribute('careNotes') && (
              <div className="attribute-group attribute-group--wide">
                <span className="attribute-group-title">Care Notes</span>
                <textarea
                  value={careNotes}
                  onChange={(event) => onCareNotesChange(event.target.value)}
                  rows={3}
                  placeholder="e.g., Dry clean only, gentle wash, lay flat to dry..."
                  className="attribute-textarea"
                />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default WardrobeAttributeFields;


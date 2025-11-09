export interface Measurements {
  size?: string;
  waist?: number;
  inseam?: number;
  chest?: number;
  length?: number;
  shoeSize?: string;
  [key: string]: string | number | undefined;
}

interface MeasurementFieldsProps {
  category: string;
  measurements: Measurements;
  updateMeasurement: (key: string, value: string | number) => void;
  loading: boolean;
}

export const getMeasurementFields = ({
  category,
  measurements,
  updateMeasurement,
  loading
}: MeasurementFieldsProps): JSX.Element[] => {
  const fields: JSX.Element[] = [];
  
  // Common fields - Size is available for all categories
  fields.push(
    <div key="size" className="measurement-field">
      <label>Size (e.g., S, M, L, XL)</label>
      <input
        type="text"
        value={measurements.size || ''}
        onChange={(e) => updateMeasurement('size', e.target.value)}
        placeholder="S, M, L, XL..."
        disabled={loading}
      />
    </div>
  );

  // Category-specific fields
  if (['Tops', 'Outerwear'].includes(category)) {
    fields.push(
      <div key="chest" className="measurement-field">
        <label>Chest (inches)</label>
        <input
          type="number"
          step="0.5"
          value={measurements.chest || ''}
          onChange={(e) => updateMeasurement('chest', e.target.value)}
          placeholder="38"
          disabled={loading}
        />
      </div>
    );
    fields.push(
      <div key="length" className="measurement-field">
        <label>Length (inches)</label>
        <input
          type="number"
          step="0.5"
          value={measurements.length || ''}
          onChange={(e) => updateMeasurement('length', e.target.value)}
          placeholder="28"
          disabled={loading}
        />
      </div>
    );
    if (category === 'Outerwear') {
      fields.push(
        <div key="shoulder" className="measurement-field">
          <label>Shoulder to Shoulder (inches)</label>
          <input
            type="number"
            step="0.5"
            value={measurements.shoulder || ''}
            onChange={(e) => updateMeasurement('shoulder', e.target.value)}
            placeholder="18"
            disabled={loading}
          />
        </div>
      );
    }
  }

  if (['Bottoms', 'Dresses'].includes(category)) {
    fields.push(
      <div key="waist" className="measurement-field">
        <label>Waist (inches)</label>
        <input
          type="number"
          step="0.5"
          value={measurements.waist || ''}
          onChange={(e) => updateMeasurement('waist', e.target.value)}
          placeholder="32"
          disabled={loading}
        />
      </div>
    );
    if (category === 'Bottoms') {
      fields.push(
        <div key="inseam" className="measurement-field">
          <label>Inseam (inches)</label>
          <input
            type="number"
            step="0.5"
            value={measurements.inseam || ''}
            onChange={(e) => updateMeasurement('inseam', e.target.value)}
            placeholder="32"
            disabled={loading}
          />
        </div>
      );
    }
    fields.push(
      <div key="length" className="measurement-field">
        <label>Length (inches)</label>
        <input
          type="number"
          step="0.5"
          value={measurements.length || ''}
          onChange={(e) => updateMeasurement('length', e.target.value)}
          placeholder="28"
          disabled={loading}
        />
      </div>
    );
  }

  if (category === 'Shoes') {
    fields.push(
      <div key="shoeSize" className="measurement-field">
        <label>Shoe Size (e.g., 9, 10.5, 42 EU)</label>
        <input
          type="text"
          value={measurements.shoeSize || ''}
          onChange={(e) => updateMeasurement('shoeSize', e.target.value)}
          placeholder="9 or 42 EU"
          disabled={loading}
        />
      </div>
    );
  }

  // Additional categories that might benefit from measurements
  if (['Activewear', 'Underwear', 'Underwear & Sleepwear'].includes(category)) {
    // These can use the generic size field already included above
    // Could add specific measurements if needed in the future
  }

  if (['Bags', 'Accessories', 'Jewelry'].includes(category)) {
    // These categories typically don't need measurements beyond size
    // But the size field is already available for all categories
  }

  return fields;
};


import React, { useState, useEffect } from 'react';
import './ProfilePage.css';
import { UserProfile } from '../App';
import BrandAutocomplete from '../components/BrandAutocomplete';
import { PageHeader, SectionHeader, Button } from '../design-system';
import { apiGet, apiPost } from '../utils/api';
import { useUser } from '../contexts/UserContext';

interface ProfilePageProps {
  apiUrl: string;
}

const ProfilePage: React.FC<ProfilePageProps> = ({ apiUrl: _apiUrl }) => {
  const { currentUser } = useUser();
  const [profile, setProfile] = useState<UserProfile>({});
  const [loading, setLoading] = useState(false);
  const [profileLoading, setProfileLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  // Store raw string values for measurement inputs to allow partial decimal input
  const [measurementInputs, setMeasurementInputs] = useState<{
    waist?: string;
    chest?: string;
    hips?: string;
    inseam?: string;
  }>({});

  const fetchProfile = async () => {
    setProfileLoading(true);
    try {
      const response = await apiGet('/api/user/profile');
      const data = await response.json();
      setProfile(data);
    } catch (err) {
      console.error('Error fetching profile:', err);
    } finally {
      setProfileLoading(false);
    }
  };

  useEffect(() => {
    if (currentUser) {
      fetchProfile();
    }
  }, [currentUser?.id]);

  // Sync measurement inputs when profile loads
  useEffect(() => {
    if (profile.waist !== undefined) {
      setMeasurementInputs(prev => ({ ...prev, waist: String(profile.waist) }));
    }
    if (profile.chest !== undefined) {
      setMeasurementInputs(prev => ({ ...prev, chest: String(profile.chest) }));
    }
    if (profile.hips !== undefined) {
      setMeasurementInputs(prev => ({ ...prev, hips: String(profile.hips) }));
    }
    if (profile.inseam !== undefined) {
      setMeasurementInputs(prev => ({ ...prev, inseam: String(profile.inseam) }));
    }
  }, [profile.waist, profile.chest, profile.hips, profile.inseam]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(false);

    try {
      const response = await apiPost('/api/user/profile', profile);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update profile');
      }

      const updatedProfile = await response.json();
      setProfile(updatedProfile);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update profile');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="ProfilePage">
      <PageHeader
        title="Your Profile"
        description="Add your measurements and style preferences to help generate better-fitting and personalized outfit combinations"
      />

      {profileLoading ? (
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <p className="loading-text">Loading your profile...</p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="profile-form">
        <div className="form-section">
          <SectionHeader title="Basic Measurements" />
          <div className="profile-grid">
            <div className="form-group">
              <label htmlFor="height">Height</label>
              <div className="input-with-unit">
                <input
                  type="number"
                  id="height"
                  step="0.1"
                  value={profile.height || ''}
                  onChange={(e) => setProfile({ ...profile, height: e.target.value ? Number(e.target.value) : undefined })}
                  placeholder="68"
                  disabled={loading}
                />
                <select
                  value={profile.heightUnit || 'inches'}
                  onChange={(e) => setProfile({ ...profile, heightUnit: e.target.value as 'inches' | 'cm' })}
                  disabled={loading}
                >
                  <option value="inches">inches</option>
                  <option value="cm">cm</option>
                </select>
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="weight">Weight</label>
              <div className="input-with-unit">
                <input
                  type="number"
                  id="weight"
                  step="0.1"
                  value={profile.weight || ''}
                  onChange={(e) => setProfile({ ...profile, weight: e.target.value ? Number(e.target.value) : undefined })}
                  placeholder="150"
                  disabled={loading}
                />
                <select
                  value={profile.weightUnit || 'lbs'}
                  onChange={(e) => setProfile({ ...profile, weightUnit: e.target.value as 'lbs' | 'kg' })}
                  disabled={loading}
                >
                  <option value="lbs">lbs</option>
                  <option value="kg">kg</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        <div className="form-section">
          <SectionHeader title="Body Measurements" />
          <div className="profile-grid">
            <div className="form-group">
              <label htmlFor="waist">Waist</label>
              <div className="input-with-unit">
                <input
                  type="text"
                  inputMode="decimal"
                  id="waist"
                  value={measurementInputs.waist ?? (profile.waist !== undefined ? String(profile.waist) : '')}
                  onChange={(e) => {
                    const value = e.target.value;
                    // Allow empty, numbers, and partial decimals (e.g., "28.", "28.5")
                    if (value === '' || /^-?\d*\.?\d*$/.test(value)) {
                      setMeasurementInputs(prev => ({ ...prev, waist: value }));
                      if (value === '' || value === '-' || value === '.') {
                        setProfile({ ...profile, waist: undefined });
                      } else {
                        const numValue = parseFloat(value);
                        if (!isNaN(numValue)) {
                          setProfile({ ...profile, waist: numValue });
                        }
                      }
                    }
                  }}
                  onBlur={(e) => {
                    const value = e.target.value.trim();
                    if (value === '' || value === '-' || value === '.') {
                      setMeasurementInputs(prev => ({ ...prev, waist: undefined }));
                      setProfile({ ...profile, waist: undefined });
                    } else {
                      const numValue = parseFloat(value);
                      if (!isNaN(numValue)) {
                        setMeasurementInputs(prev => ({ ...prev, waist: String(numValue) }));
                        setProfile({ ...profile, waist: numValue });
                      }
                    }
                  }}
                  placeholder="28"
                  disabled={loading}
                />
                <select
                  value={profile.measurementsUnit || 'inches'}
                  onChange={(e) => setProfile({ ...profile, measurementsUnit: e.target.value as 'inches' | 'cm' })}
                  disabled={loading}
                >
                  <option value="inches">inches</option>
                  <option value="cm">cm</option>
                </select>
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="chest">Chest</label>
              <div className="input-with-unit">
                <input
                  type="text"
                  inputMode="decimal"
                  id="chest"
                  value={measurementInputs.chest ?? (profile.chest !== undefined ? String(profile.chest) : '')}
                  onChange={(e) => {
                    const value = e.target.value;
                    // Allow empty, numbers, and partial decimals (e.g., "36.", "36.5")
                    if (value === '' || /^-?\d*\.?\d*$/.test(value)) {
                      setMeasurementInputs(prev => ({ ...prev, chest: value }));
                      if (value === '' || value === '-' || value === '.') {
                        setProfile({ ...profile, chest: undefined });
                      } else {
                        const numValue = parseFloat(value);
                        if (!isNaN(numValue)) {
                          setProfile({ ...profile, chest: numValue });
                        }
                      }
                    }
                  }}
                  onBlur={(e) => {
                    const value = e.target.value.trim();
                    if (value === '' || value === '-' || value === '.') {
                      setMeasurementInputs(prev => ({ ...prev, chest: undefined }));
                      setProfile({ ...profile, chest: undefined });
                    } else {
                      const numValue = parseFloat(value);
                      if (!isNaN(numValue)) {
                        setMeasurementInputs(prev => ({ ...prev, chest: String(numValue) }));
                        setProfile({ ...profile, chest: numValue });
                      }
                    }
                  }}
                  placeholder="36"
                  disabled={loading}
                />
                <select
                  value={profile.measurementsUnit || 'inches'}
                  onChange={(e) => setProfile({ ...profile, measurementsUnit: e.target.value as 'inches' | 'cm' })}
                  disabled={loading}
                >
                  <option value="inches">inches</option>
                  <option value="cm">cm</option>
                </select>
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="hips">Hips</label>
              <div className="input-with-unit">
                <input
                  type="text"
                  inputMode="decimal"
                  id="hips"
                  value={measurementInputs.hips ?? (profile.hips !== undefined ? String(profile.hips) : '')}
                  onChange={(e) => {
                    const value = e.target.value;
                    // Allow empty, numbers, and partial decimals (e.g., "36.", "36.5")
                    if (value === '' || /^-?\d*\.?\d*$/.test(value)) {
                      setMeasurementInputs(prev => ({ ...prev, hips: value }));
                      if (value === '' || value === '-' || value === '.') {
                        setProfile({ ...profile, hips: undefined });
                      } else {
                        const numValue = parseFloat(value);
                        if (!isNaN(numValue)) {
                          setProfile({ ...profile, hips: numValue });
                        }
                      }
                    }
                  }}
                  onBlur={(e) => {
                    const value = e.target.value.trim();
                    if (value === '' || value === '-' || value === '.') {
                      setMeasurementInputs(prev => ({ ...prev, hips: undefined }));
                      setProfile({ ...profile, hips: undefined });
                    } else {
                      const numValue = parseFloat(value);
                      if (!isNaN(numValue)) {
                        setMeasurementInputs(prev => ({ ...prev, hips: String(numValue) }));
                        setProfile({ ...profile, hips: numValue });
                      }
                    }
                  }}
                  placeholder="36"
                  disabled={loading}
                />
                <select
                  value={profile.measurementsUnit || 'inches'}
                  onChange={(e) => setProfile({ ...profile, measurementsUnit: e.target.value as 'inches' | 'cm' })}
                  disabled={loading}
                >
                  <option value="inches">inches</option>
                  <option value="cm">cm</option>
                </select>
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="inseam">Inseam</label>
              <div className="input-with-unit">
                <input
                  type="text"
                  inputMode="decimal"
                  id="inseam"
                  value={measurementInputs.inseam ?? (profile.inseam !== undefined ? String(profile.inseam) : '')}
                  onChange={(e) => {
                    const value = e.target.value;
                    // Allow empty, numbers, and partial decimals (e.g., "29.", "29.5")
                    if (value === '' || /^-?\d*\.?\d*$/.test(value)) {
                      setMeasurementInputs(prev => ({ ...prev, inseam: value }));
                      if (value === '' || value === '-' || value === '.') {
                        setProfile({ ...profile, inseam: undefined });
                      } else {
                        const numValue = parseFloat(value);
                        if (!isNaN(numValue)) {
                          setProfile({ ...profile, inseam: numValue });
                        }
                      }
                    }
                  }}
                  onBlur={(e) => {
                    const value = e.target.value.trim();
                    if (value === '' || value === '-' || value === '.') {
                      setMeasurementInputs(prev => ({ ...prev, inseam: undefined }));
                      setProfile({ ...profile, inseam: undefined });
                    } else {
                      const numValue = parseFloat(value);
                      if (!isNaN(numValue)) {
                        setMeasurementInputs(prev => ({ ...prev, inseam: String(numValue) }));
                        setProfile({ ...profile, inseam: numValue });
                      }
                    }
                  }}
                  placeholder="29"
                  disabled={loading}
                />
                <select
                  value={profile.measurementsUnit || 'inches'}
                  onChange={(e) => setProfile({ ...profile, measurementsUnit: e.target.value as 'inches' | 'cm' })}
                  disabled={loading}
                >
                  <option value="inches">inches</option>
                  <option value="cm">cm</option>
                </select>
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="shoeSize">Shoe Size</label>
              <input
                type="text"
                id="shoeSize"
                value={profile.shoeSize || ''}
                onChange={(e) => setProfile({ ...profile, shoeSize: e.target.value })}
                placeholder="7 or 42 EU"
                disabled={loading}
              />
            </div>
          </div>
        </div>

        <div className="form-section">
          <SectionHeader title="Style Preferences" />
          
          <div className="form-group">
            <label htmlFor="brands">Favorite Brands</label>
            <BrandAutocomplete
              selectedBrands={profile.brands || []}
              onBrandsChange={(brands) => setProfile({ ...profile, brands })}
              disabled={loading}
            />
            <small>
              Add brands you love to help generate outfit suggestions that match your style
            </small>
          </div>

          <div className="form-group">
            <label htmlFor="stylePreferences">Personal Style Description</label>
            <textarea
              id="stylePreferences"
              value={profile.stylePreferences || ''}
              onChange={(e) => setProfile({ ...profile, stylePreferences: e.target.value })}
              placeholder="Describe your personal style (e.g., 'Minimalist, monochrome, oversized fits, avant-garde pieces. Prefer structured silhouettes and architectural details.')"
              rows={5}
              disabled={loading}
              className="style-preferences-textarea"
            />
            <small>
              This helps the AI generate outfits that match your personal style preferences
            </small>
          </div>
        </div>

        <div className="form-section">
          <SectionHeader title="Appearance Details (Optional)" />
          <p className="section-description">
            These optional fields help the AI generate outfit combinations with colors and styles that complement your appearance
          </p>
          <div className="profile-grid">
            <div className="form-group">
              <label htmlFor="hairColor">Hair Color (Optional)</label>
              <input
                type="text"
                id="hairColor"
                value={profile.hairColor || ''}
                onChange={(e) => setProfile({ ...profile, hairColor: e.target.value || undefined })}
                placeholder="e.g., Black, Brown, Blonde, Red"
                disabled={loading}
              />
              <small>
                Helps suggest colors that complement your hair
              </small>
            </div>

            <div className="form-group">
              <label htmlFor="hairTexture">Hair Texture (Optional)</label>
              <input
                type="text"
                id="hairTexture"
                value={profile.hairTexture || ''}
                onChange={(e) => setProfile({ ...profile, hairTexture: e.target.value || undefined })}
                placeholder="e.g., Straight, Wavy, Curly, Coily"
                disabled={loading}
              />
              <small>
                Helps with styling suggestions for your hair
              </small>
            </div>

            <div className="form-group">
              <label htmlFor="skinColor">Skin Color (Optional)</label>
              <input
                type="text"
                id="skinColor"
                value={profile.skinColor || ''}
                onChange={(e) => setProfile({ ...profile, skinColor: e.target.value || undefined })}
                placeholder="e.g., Fair, Light, Medium, Tan, Deep"
                disabled={loading}
              />
              <small>
                Helps suggest colors that complement your skin tone
              </small>
            </div>
          </div>
        </div>

        {error && <div className="error-message">{error}</div>}
        {success && <div className="success-message">Profile updated successfully!</div>}

        <Button
          type="submit"
          variant="primary"
          size="large"
          disabled={loading}
          className="save-btn"
        >
          {loading ? 'Saving...' : 'Save Profile'}
        </Button>
      </form>
      )}
    </div>
  );
};

export default ProfilePage;


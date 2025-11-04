import React, { useState, useEffect } from 'react';
import './ProfilePage.css';
import { UserProfile } from '../App';
import BrandAutocomplete from '../components/BrandAutocomplete';

interface ProfilePageProps {
  apiUrl: string;
}

const ProfilePage: React.FC<ProfilePageProps> = ({ apiUrl }) => {
  const [profile, setProfile] = useState<UserProfile>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      const response = await fetch(`${apiUrl}/api/user/profile`);
      const data = await response.json();
      setProfile(data);
    } catch (err) {
      console.error('Error fetching profile:', err);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(false);

    try {
      const response = await fetch(`${apiUrl}/api/user/profile`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(profile),
      });

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
      <div className="page-header">
        <h1>Your Profile</h1>
        <p className="page-description">
          Add your measurements and style preferences to help generate better-fitting and personalized outfit combinations
        </p>
      </div>

      <form onSubmit={handleSubmit} className="profile-form">
        <div className="form-section">
          <h2>Basic Measurements</h2>
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
          <h2>Body Measurements</h2>
          <div className="profile-grid">
            <div className="form-group">
              <label htmlFor="waist">Waist</label>
              <div className="input-with-unit">
                <input
                  type="number"
                  id="waist"
                  step="0.5"
                  value={profile.waist || ''}
                  onChange={(e) => setProfile({ ...profile, waist: e.target.value ? Number(e.target.value) : undefined })}
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
                  type="number"
                  id="chest"
                  step="0.5"
                  value={profile.chest || ''}
                  onChange={(e) => setProfile({ ...profile, chest: e.target.value ? Number(e.target.value) : undefined })}
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
                  type="number"
                  id="hips"
                  step="0.5"
                  value={profile.hips || ''}
                  onChange={(e) => setProfile({ ...profile, hips: e.target.value ? Number(e.target.value) : undefined })}
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
                  type="number"
                  id="inseam"
                  step="0.5"
                  value={profile.inseam || ''}
                  onChange={(e) => setProfile({ ...profile, inseam: e.target.value ? Number(e.target.value) : undefined })}
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
          <h2>Style Preferences</h2>
          
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

        {error && <div className="error-message">{error}</div>}
        {success && <div className="success-message">Profile updated successfully!</div>}

        <button
          type="submit"
          className="btn btn-primary save-btn"
          disabled={loading}
        >
          {loading ? 'Saving...' : 'Save Profile'}
        </button>
      </form>
    </div>
  );
};

export default ProfilePage;


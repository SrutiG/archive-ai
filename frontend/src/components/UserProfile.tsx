import React, { useState, useEffect } from 'react';
import './UserProfile.css';
import { UserProfile } from '../App';

interface UserProfileProps {
  apiUrl: string;
}

const UserProfileComponent: React.FC<UserProfileProps> = ({ apiUrl }) => {
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
    <div className="UserProfile">
      <h2>Your Profile</h2>
      <p className="profile-description">
        Add your measurements and style preferences to help generate better-fitting and personalized outfit combinations
      </p>
      <form onSubmit={handleSubmit}>
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

        <div className="form-group" style={{ marginTop: '1.5rem' }}>
          <label htmlFor="stylePreferences">Style Preferences</label>
          <textarea
            id="stylePreferences"
            value={profile.stylePreferences || ''}
            onChange={(e) => setProfile({ ...profile, stylePreferences: e.target.value })}
            placeholder="Describe your personal style (e.g., 'Minimalist, monochrome, oversized fits, avant-garde pieces. Prefer structured silhouettes and architectural details.')"
            rows={4}
            disabled={loading}
            className="style-preferences-textarea"
          />
          <small style={{ color: '#666', fontSize: '0.85rem', marginTop: '0.25rem', display: 'block' }}>
            This helps the AI generate outfits that match your personal style preferences
          </small>
        </div>

        {error && <div className="error-message">{error}</div>}
        {success && <div className="success-message">Profile updated successfully!</div>}

        <button
          type="submit"
          className="btn btn-primary"
          disabled={loading}
        >
          {loading ? 'Saving...' : 'Save Profile'}
        </button>
      </form>
    </div>
  );
};

export default UserProfileComponent;

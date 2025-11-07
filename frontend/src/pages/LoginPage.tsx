import React, { useState } from 'react';
import { useUser } from '../contexts/UserContext';
import '../pages/LoginPage.css';

const LoginPage: React.FC = () => {
  const { users, createUser, setCurrentUser, usersLoading } = useUser();
  const [newUserName, setNewUserName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Note: loadUsers is already called in UserContext on mount (line 116-118)
  // No need to call it again here - that was causing the infinite loop

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUserName.trim()) {
      setError('Please enter a name');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const user = await createUser(newUserName.trim());
      setCurrentUser(user);
      setNewUserName('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create user');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectUser = (user: any) => {
    setCurrentUser(user);
  };

  return (
    <div className="LoginPage">
      <div className="login-container">
        <h1 className="login-title">ARCHIVE</h1>
        <p className="login-subtitle">Select or create a user to continue</p>

        {error && <div className="login-error">{error}</div>}

        <div className="login-section">
          <h2 className="login-section-title">Existing Users</h2>
          {usersLoading ? (
            <div className="login-loading">
              <div className="loading-spinner"></div>
              <p className="loading-text">Loading users...</p>
            </div>
          ) : users.length === 0 ? (
            <p className="login-empty">No users yet. Create one below.</p>
          ) : (
            <div className="user-list">
              {users.map((user) => (
                <button
                  key={user.id}
                  className="user-button"
                  onClick={() => handleSelectUser(user)}
                >
                  {user.name}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="login-divider"></div>

        <div className="login-section">
          <h2 className="login-section-title">Create New User</h2>
          <form onSubmit={handleCreateUser} className="login-form">
            <input
              type="text"
              value={newUserName}
              onChange={(e) => setNewUserName(e.target.value)}
              placeholder="Enter your name"
              className="login-input"
              disabled={loading}
              autoFocus
            />
            <button
              type="submit"
              className="login-submit"
              disabled={loading || !newUserName.trim()}
            >
              {loading ? 'Creating...' : 'Create User'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;


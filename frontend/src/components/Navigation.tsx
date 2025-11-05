import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useUser } from '../contexts/UserContext';
import './Navigation.css';

const Navigation: React.FC = () => {
  const location = useLocation();
  const { currentUser, setCurrentUser, users, loadUsers } = useUser();
  const [showUserMenu, setShowUserMenu] = useState(false);

  const handleSwitchUser = () => {
    setShowUserMenu(!showUserMenu);
    if (!showUserMenu) {
      loadUsers();
    }
  };

  const handleSelectUser = (user: any) => {
    setCurrentUser(user);
    setShowUserMenu(false);
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setShowUserMenu(false);
  };

  return (
    <nav className="Navigation">
      <div className="nav-brand">
        <h1>ARCHIVE</h1>
      </div>
      <div className="nav-links">
        <Link 
          to="/profile" 
          className={location.pathname === '/profile' ? 'active' : ''}
        >
          Profile
        </Link>
        <Link 
          to="/wardrobe" 
          className={location.pathname === '/wardrobe' || location.pathname === '/' ? 'active' : ''}
        >
          Wardrobe
        </Link>
        <Link 
          to="/outfits" 
          className={location.pathname === '/outfits' ? 'active' : ''}
        >
          Outfits
        </Link>
        <Link 
          to="/explore" 
          className={location.pathname === '/explore' ? 'active' : ''}
        >
          Explore
        </Link>
      </div>
      <div className="nav-user">
        <div className="nav-user-info">
          <span className="nav-user-name">{currentUser?.name}</span>
          <button 
            className="nav-user-toggle"
            onClick={handleSwitchUser}
            aria-label="Switch user"
          >
            Switch
          </button>
        </div>
        {showUserMenu && (
          <div className="nav-user-menu">
            {users.map((user) => (
              <button
                key={user.id}
                className={`nav-user-option ${user.id === currentUser?.id ? 'active' : ''}`}
                onClick={() => handleSelectUser(user)}
              >
                {user.name}
              </button>
            ))}
            <div className="nav-user-divider"></div>
            <button
              className="nav-user-option nav-user-logout"
              onClick={handleLogout}
            >
              Sign Out
            </button>
          </div>
        )}
      </div>
    </nav>
  );
};

export default Navigation;


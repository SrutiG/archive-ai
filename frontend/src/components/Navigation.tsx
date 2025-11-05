import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useUser } from '../contexts/UserContext';
import './Navigation.css';

const Navigation: React.FC = () => {
  const location = useLocation();
  const { currentUser, setCurrentUser, users, loadUsers } = useUser();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);

  const handleSwitchUser = () => {
    setShowUserMenu(!showUserMenu);
    if (!showUserMenu) {
      loadUsers();
    }
  };

  const handleMobileMenuToggle = () => {
    setShowMobileMenu(!showMobileMenu);
  };

  const handleLinkClick = () => {
    setShowMobileMenu(false);
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
    <>
      <nav className="Navigation">
        <div className="nav-brand">
          <h1>ARCHIVE</h1>
        </div>
        <button 
          className="mobile-menu-toggle"
          onClick={handleMobileMenuToggle}
          aria-label="Toggle menu"
        >
          <span></span>
          <span></span>
          <span></span>
        </button>
        <div className={`nav-links ${showMobileMenu ? 'mobile-open' : ''}`}>
          <Link 
            to="/profile" 
            className={location.pathname === '/profile' ? 'active' : ''}
            onClick={handleLinkClick}
          >
            Profile
          </Link>
          <Link 
            to="/wardrobe" 
            className={location.pathname === '/wardrobe' || location.pathname === '/' ? 'active' : ''}
            onClick={handleLinkClick}
          >
            Wardrobe
          </Link>
          <Link 
            to="/outfits" 
            className={location.pathname === '/outfits' ? 'active' : ''}
            onClick={handleLinkClick}
          >
            Outfits
          </Link>
          <Link 
            to="/explore" 
            className={location.pathname === '/explore' ? 'active' : ''}
            onClick={handleLinkClick}
          >
            Explore
          </Link>
          <div className="nav-user-mobile">
            <div className="nav-user-info-mobile">
              <span className="nav-user-name-mobile">{currentUser?.name}</span>
              <button 
                className="nav-user-toggle-mobile"
                onClick={handleSwitchUser}
                aria-label="Switch user"
              >
                Switch
              </button>
            </div>
            {showUserMenu && (
              <div className="nav-user-menu-mobile">
                {users.map((user) => (
                  <button
                    key={user.id}
                    className={`nav-user-option ${user.id === currentUser?.id ? 'active' : ''}`}
                    onClick={() => {
                      handleSelectUser(user);
                      handleLinkClick();
                    }}
                  >
                    {user.name}
                  </button>
                ))}
                <div className="nav-user-divider"></div>
                <button
                  className="nav-user-option nav-user-logout"
                  onClick={() => {
                    handleLogout();
                    handleLinkClick();
                  }}
                >
                  Sign Out
                </button>
              </div>
            )}
          </div>
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
      {showMobileMenu && (
        <div className="mobile-menu-overlay" onClick={handleMobileMenuToggle}></div>
      )}
    </>
  );
};

export default Navigation;


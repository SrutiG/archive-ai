import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import './Navigation.css';

const Navigation: React.FC = () => {
  const location = useLocation();

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
    </nav>
  );
};

export default Navigation;


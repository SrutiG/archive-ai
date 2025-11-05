import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import './App.css';
import { UserProvider, useUser } from './contexts/UserContext';
import Navigation from './components/Navigation';
import LoginPage from './pages/LoginPage';
import ProfilePage from './pages/ProfilePage';
import WardrobePage from './pages/WardrobePage';
import OutfitsPage from './pages/OutfitsPage';
import ExplorePage from './pages/ExplorePage';

export interface WardrobeItem {
  id: string;
  title: string;
  imageUrl: string;
  category: string;
  description?: string;
  measurements?: {
    size?: string;
    waist?: number;
    inseam?: number;
    chest?: number;
    length?: number;
    shoeSize?: string;
    [key: string]: string | number | undefined;
  };
  createdAt: string;
}

export interface UserProfile {
  height?: number;
  weight?: number;
  heightUnit?: 'inches' | 'cm';
  weightUnit?: 'lbs' | 'kg';
  stylePreferences?: string;
  brands?: string[]; // Array of favorite brands
  waist?: number;
  chest?: number;
  hips?: number;
  inseam?: number;
  shoeSize?: string;
  measurementsUnit?: 'inches' | 'cm';
  // Appearance details (optional, helps with outfit generation)
  hairColor?: string;
  hairTexture?: string;
  skinColor?: string;
}

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

const AppContent: React.FC = () => {
  const { currentUser, isLoading } = useUser();

  // Show loading state while checking for user
  if (isLoading) {
    return (
      <div className="App-loading">
        <div className="loading-spinner"></div>
      </div>
    );
  }

  // Show login page if no user is selected
  if (!currentUser) {
    return <LoginPage />;
  }

  return (
    <Router>
      <div className="App">
        <Navigation />
        
        <main className="App-main">
          <Routes>
            <Route path="/" element={<WardrobePage apiUrl={API_BASE_URL} />} />
            <Route path="/profile" element={<ProfilePage apiUrl={API_BASE_URL} />} />
            <Route path="/wardrobe" element={<WardrobePage apiUrl={API_BASE_URL} />} />
            <Route path="/outfits" element={<OutfitsPage apiUrl={API_BASE_URL} />} />
            <Route path="/explore" element={<ExplorePage apiUrl={API_BASE_URL} />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
};

function App() {
  return (
    <UserProvider>
      <AppContent />
    </UserProvider>
  );
}

export default App;

import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import './App.css';
import Navigation from './components/Navigation';
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
}

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001';

function App() {
  useEffect(() => {
    // Reload data from storage on mount to ensure fresh data (useful after seeding)
    const reloadData = async () => {
      try {
        console.log('Reloading data from storage...');
        await fetch(`${API_BASE_URL}/api/reload`, { method: 'POST' });
      } catch (error) {
        console.error('Error reloading on mount:', error);
      }
    };
    reloadData();
  }, []);

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
}

export default App;

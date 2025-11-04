import React, { useState, useEffect } from 'react';
import './App.css';
import ItemInput from './components/ItemInput';
import ItemList from './components/ItemList';
import OutfitGenerator from './components/OutfitGenerator';
import UserProfile from './components/UserProfile';

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
}

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001';

function App() {
  const [items, setItems] = useState<WardrobeItem[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchItems = async () => {
    try {
      console.log('Fetching items from API...');
      const response = await fetch(`${API_BASE_URL}/api/items`);
      const data = await response.json();
      console.log(`Fetched ${data.length} items:`, data.map((item: WardrobeItem) => `${item.title} (${item.id})`));
      setItems(data);
    } catch (error) {
      console.error('Error fetching items:', error);
    }
  };

  useEffect(() => {
    // Reload data from storage on mount to ensure fresh data (useful after seeding)
    const reloadAndFetch = async () => {
      try {
        console.log('Reloading data from storage...');
        await fetch(`${API_BASE_URL}/api/reload`, { method: 'POST' });
        fetchItems();
      } catch (error) {
        console.error('Error reloading on mount:', error);
        // If reload fails, just fetch items normally
        fetchItems();
      }
    };
    reloadAndFetch();
  }, []);

  const handleItemAdded = () => {
    fetchItems();
  };

  const handleItemDeleted = () => {
    fetchItems();
  };

  const handleReload = async () => {
    try {
      // Reload data on backend first
      await fetch(`${API_BASE_URL}/api/reload`, { method: 'POST' });
      // Then refresh items
      fetchItems();
    } catch (error) {
      console.error('Error reloading data:', error);
    }
  };

  return (
    <div className="App">
      <header className="App-header">
        <h1>Wardrobe App</h1>
        <p>Organize your wardrobe with AI-powered categorization</p>
      </header>
      
      <main className="App-main">
        <UserProfile apiUrl={API_BASE_URL} />
        
        <ItemInput 
          onItemAdded={handleItemAdded} 
          loading={loading}
          setLoading={setLoading}
          apiUrl={API_BASE_URL}
        />
        
        <ItemList 
          items={items} 
          onItemDeleted={handleItemDeleted}
          onItemUpdated={handleItemAdded}
          apiUrl={API_BASE_URL}
        />
        
        <OutfitGenerator 
          items={items}
          apiUrl={API_BASE_URL}
        />
      </main>
    </div>
  );
}

export default App;

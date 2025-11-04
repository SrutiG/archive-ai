import React, { useState, useEffect } from 'react';
import './App.css';
import ItemInput from './components/ItemInput';
import ItemList from './components/ItemList';
import OutfitGenerator from './components/OutfitGenerator';

export interface WardrobeItem {
  id: string;
  title: string;
  imageUrl: string;
  category: string;
  createdAt: string;
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
    fetchItems();
  }, []);

  const handleItemAdded = () => {
    fetchItems();
  };

  const handleItemDeleted = () => {
    fetchItems();
  };

  return (
    <div className="App">
      <header className="App-header">
        <h1>Wardrobe App</h1>
        <p>Organize your wardrobe with AI-powered categorization</p>
      </header>
      
      <main className="App-main">
        <ItemInput 
          onItemAdded={handleItemAdded} 
          loading={loading}
          setLoading={setLoading}
          apiUrl={API_BASE_URL}
        />
        
        <ItemList 
          items={items} 
          onItemDeleted={handleItemDeleted}
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

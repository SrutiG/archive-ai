import React, { useState, useEffect } from 'react';
import './WardrobePage.css';
import { WardrobeItem } from '../App';
import ItemInput from '../components/ItemInput';
import ItemList from '../components/ItemList';
import { PageHeader } from '../design-system';

interface WardrobePageProps {
  apiUrl: string;
}

const WardrobePage: React.FC<WardrobePageProps> = ({ apiUrl }) => {
  const [items, setItems] = useState<WardrobeItem[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchItems = async () => {
    try {
      console.log('Fetching items from API...');
      const response = await fetch(`${apiUrl}/api/items`);
      const data = await response.json();
      console.log(`Fetched ${data.length} items:`, data.map((item: WardrobeItem) => `${item.title} (${item.id})`));
      setItems(data);
    } catch (error) {
      console.error('Error fetching items:', error);
    }
  };

  useEffect(() => {
    // Reload data from storage on mount
    const reloadAndFetch = async () => {
      try {
        console.log('Reloading data from storage...');
        await fetch(`${apiUrl}/api/reload`, { method: 'POST' });
        fetchItems();
      } catch (error) {
        console.error('Error reloading on mount:', error);
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

  return (
    <div className="WardrobePage">
      <PageHeader
        title="Your Wardrobe"
        description="Manage your wardrobe items. Add, edit, or delete items organized by category."
      />

      <ItemInput 
        onItemAdded={handleItemAdded} 
        loading={loading}
        setLoading={setLoading}
        apiUrl={apiUrl}
      />
      
      <ItemList 
        items={items} 
        onItemDeleted={handleItemDeleted}
        onItemUpdated={handleItemAdded}
        apiUrl={apiUrl}
      />
    </div>
  );
};

export default WardrobePage;


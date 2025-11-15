import React, { useState, useEffect } from 'react';
import './WardrobePage.css';
import { WardrobeItem } from '../App';
import ItemList from '../components/ItemList';
import { Button, PageHeader } from '../design-system';
import { apiGet, apiPost } from '../utils/api';
import { useUser } from '../contexts/UserContext';
import AddItemModal from '../components/AddItemModal';

interface WardrobePageProps {
  apiUrl: string;
}

const WardrobePage: React.FC<WardrobePageProps> = ({ apiUrl }) => {
  const { currentUser } = useUser();
  const [items, setItems] = useState<WardrobeItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [itemsLoading, setItemsLoading] = useState(false);
  const [showAddItemModal, setShowAddItemModal] = useState(false);

  const fetchItems = async () => {
    setItemsLoading(true);
    try {
      console.log('Fetching items from API...');
      const response = await apiGet('/api/items');
      const data = await response.json();
      console.log(`Fetched ${data.length} items:`, data.map((item: WardrobeItem) => `${item.title} (${item.id})`));
      setItems(data);
    } catch (error) {
      console.error('Error fetching items:', error);
    } finally {
      setItemsLoading(false);
    }
  };

  useEffect(() => {
    // Reload data from storage on mount or when user changes
    const reloadAndFetch = async () => {
      setItemsLoading(true);
      try {
        console.log('Reloading data from storage...');
        await apiPost('/api/reload');
        await fetchItems();
      } catch (error) {
        console.error('Error reloading on mount:', error);
        await fetchItems();
      }
    };
    if (currentUser) {
      reloadAndFetch();
    }
  }, [currentUser?.id]);

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

      <div className="WardrobePage__actions">
        <Button variant="primary" size="medium" onClick={() => setShowAddItemModal(true)}>
          + Add Item
        </Button>
      </div>
      
      {itemsLoading ? (
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <p className="loading-text">Loading your wardrobe...</p>
        </div>
      ) : (
        <ItemList 
          items={items} 
          onItemDeleted={handleItemDeleted}
          onItemUpdated={handleItemAdded}
          apiUrl={apiUrl}
        />
      )}

      <AddItemModal
        isOpen={showAddItemModal}
        onClose={() => setShowAddItemModal(false)}
        onItemAdded={handleItemAdded}
        apiUrl={apiUrl}
        loading={loading}
        setLoading={setLoading}
      />
    </div>
  );
};

export default WardrobePage;


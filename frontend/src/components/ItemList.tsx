import React, { useState } from 'react';
import './ItemList.css';
import { WardrobeItem } from '../App';
import ItemEdit from './ItemEdit';

interface ItemListProps {
  items: WardrobeItem[];
  onItemDeleted: () => void;
  onItemUpdated: () => void;
  apiUrl: string;
}

const ItemList: React.FC<ItemListProps> = ({ items, onItemDeleted, onItemUpdated, apiUrl }) => {
  const [viewMode, setViewMode] = useState<'all' | 'category'>('all');
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this item?')) {
      return;
    }

    setDeletingId(id);
    try {
      const response = await fetch(`${apiUrl}/api/items/${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete item');
      }

      onItemDeleted();
    } catch (error) {
      console.error('Error deleting item:', error);
      alert('Failed to delete item');
    } finally {
      setDeletingId(null);
    }
  };

  const itemsByCategory = items.reduce((acc, item) => {
    if (!acc[item.category]) {
      acc[item.category] = [];
    }
    acc[item.category].push(item);
    return acc;
  }, {} as Record<string, WardrobeItem[]>);

  if (items.length === 0) {
    return (
      <div className="ItemList">
        <h2>Your Wardrobe</h2>
        <div className="empty-state">
          <p>No items yet. Add your first item to get started!</p>
        </div>
      </div>
    );
  }

  const editingItem = editingId ? items.find(item => item.id === editingId) : null;

  if (editingItem) {
    return (
      <div className="ItemList">
        <ItemEdit
          item={editingItem}
          onItemUpdated={() => {
            setEditingId(null);
            onItemUpdated();
          }}
          onCancel={() => setEditingId(null)}
          apiUrl={apiUrl}
        />
      </div>
    );
  }

  return (
    <div className="ItemList">
      <div className="ItemList-header">
        <h2>Your Wardrobe ({items.length} items)</h2>
        <div className="view-toggle">
          <button
            className={viewMode === 'all' ? 'active' : ''}
            onClick={() => setViewMode('all')}
          >
            All Items
          </button>
          <button
            className={viewMode === 'category' ? 'active' : ''}
            onClick={() => setViewMode('category')}
          >
            By Category
          </button>
        </div>
      </div>

      {viewMode === 'all' ? (
        <div className="items-grid">
          {items.map((item) => (
            <div key={item.id} className="item-card">
              <div className="item-image-container">
                <img
                  src={`${apiUrl}${item.imageUrl}`}
                  alt={item.title}
                  className="item-image"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = 'https://via.placeholder.com/200';
                  }}
                />
                <span className="item-category">{item.category}</span>
              </div>
              <div className="item-info">
                <h3>{item.title}</h3>
                {item.description && <p className="item-description">{item.description.substring(0, 60)}...</p>}
                <div className="item-actions">
                  <button
                    className="edit-btn"
                    onClick={() => setEditingId(item.id)}
                    disabled={deletingId === item.id || editingId !== null}
                  >
                    ✏️ Edit
                  </button>
                  <button
                    className="delete-btn"
                    onClick={() => handleDelete(item.id)}
                    disabled={deletingId === item.id || editingId !== null}
                  >
                    {deletingId === item.id ? 'Deleting...' : '🗑️ Delete'}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="items-by-category">
          {Object.entries(itemsByCategory).map(([category, categoryItems]) => (
            <div key={category} className="category-section">
              <h3 className="category-title">
                {category} ({categoryItems.length})
              </h3>
              <div className="items-grid">
                {categoryItems.map((item) => (
                  <div key={item.id} className="item-card">
                    <div className="item-image-container">
                      <img
                        src={`${apiUrl}${item.imageUrl}`}
                        alt={item.title}
                        className="item-image"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = 'https://via.placeholder.com/200';
                        }}
                      />
                    </div>
                    <div className="item-info">
                      <h3>{item.title}</h3>
                      {item.description && <p className="item-description">{item.description.substring(0, 60)}...</p>}
                      <div className="item-actions">
                        <button
                          className="edit-btn"
                          onClick={() => setEditingId(item.id)}
                          disabled={deletingId === item.id || editingId !== null}
                        >
                          ✏️ Edit
                        </button>
                        <button
                          className="delete-btn"
                          onClick={() => handleDelete(item.id)}
                          disabled={deletingId === item.id || editingId !== null}
                        >
                          {deletingId === item.id ? 'Deleting...' : '🗑️ Delete'}
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ItemList;

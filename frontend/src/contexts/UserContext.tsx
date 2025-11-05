import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { getUserCookie, setUserCookie, removeUserCookie } from '../utils/cookies';

export interface User {
  id: string;
  name: string;
  createdAt: string;
}

interface UserContextType {
  currentUser: User | null;
  setCurrentUser: (user: User | null) => void;
  users: User[];
  loadUsers: () => Promise<void>;
  createUser: (name: string) => Promise<User>;
  switchUser: (user: User) => void;
  isLoading: boolean;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

const USER_STORAGE_KEY = 'archive_current_user';
const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001';

export const UserProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUserState] = useState<User | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Load current user from cookie or localStorage on mount
  useEffect(() => {
    // Try cookie first (faster, no flash)
    let user: User | null = getUserCookie();
    
    // Fallback to localStorage if cookie not found
    if (!user) {
      const storedUser = localStorage.getItem(USER_STORAGE_KEY);
      if (storedUser) {
        try {
          user = JSON.parse(storedUser);
          // Sync to cookie for future use
          if (user) {
            setUserCookie(user);
          }
        } catch (error) {
          console.error('Error parsing stored user:', error);
          localStorage.removeItem(USER_STORAGE_KEY);
        }
      }
    } else {
      // Sync to localStorage for backward compatibility
      localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user));
    }
    
    setCurrentUserState(user);
    setIsLoading(false);
  }, []);

  // Load users list
  const loadUsers = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/users`);
      if (!response.ok) {
        throw new Error('Failed to fetch users');
      }
      const data = await response.json();
      setUsers(data);
    } catch (error) {
      console.error('Error loading users:', error);
    }
  };

  // Create a new user
  const createUser = async (name: string): Promise<User> => {
    const response = await fetch(`${API_BASE_URL}/api/users`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ name }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to create user');
    }

    const newUser = await response.json();
    setUsers((prev) => [...prev, newUser]);
    return newUser;
  };

  // Set current user and save to cookie and localStorage
  const setCurrentUser = (user: User | null) => {
    setCurrentUserState(user);
    if (user) {
      setUserCookie(user);
      localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user));
    } else {
      removeUserCookie();
      localStorage.removeItem(USER_STORAGE_KEY);
    }
  };

  // Switch to a different user
  const switchUser = (user: User) => {
    setCurrentUser(user);
  };

  // Load users on mount
  useEffect(() => {
    loadUsers();
  }, []);

  return (
    <UserContext.Provider
      value={{
        currentUser,
        setCurrentUser,
        users,
        loadUsers,
        createUser,
        switchUser,
        isLoading,
      }}
    >
      {children}
    </UserContext.Provider>
  );
};

export const useUser = () => {
  const context = useContext(UserContext);
  if (context === undefined) {
    throw new Error('useUser must be used within a UserProvider');
  }
  return context;
};


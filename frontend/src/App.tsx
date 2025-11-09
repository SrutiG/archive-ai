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

export type WardrobeColorOption =
  | 'black'
  | 'white'
  | 'gray'
  | 'navy'
  | 'blue'
  | 'green'
  | 'olive'
  | 'red'
  | 'burgundy'
  | 'pink'
  | 'purple'
  | 'yellow'
  | 'orange'
  | 'brown'
  | 'tan'
  | 'beige'
  | 'cream'
  | 'metallic'
  | 'multicolor'
  | 'other';

export type WardrobeFabricOption =
  | 'cotton'
  | 'linen'
  | 'silk'
  | 'wool'
  | 'cashmere'
  | 'denim'
  | 'leather'
  | 'suede'
  | 'knit'
  | 'synthetic'
  | 'chiffon'
  | 'satin'
  | 'velvet'
  | 'lace'
  | 'other';

export type WardrobePatternOption =
  | 'solid'
  | 'striped'
  | 'plaid'
  | 'check'
  | 'floral'
  | 'animal'
  | 'polka-dot'
  | 'geometric'
  | 'graphic'
  | 'abstract'
  | 'textured'
  | 'other';

export type WardrobeSilhouetteOption =
  | 'a-line'
  | 'column'
  | 'fit-and-flare'
  | 'cocoon'
  | 'trapeze'
  | 'bodycon'
  | 'wide-leg'
  | 'straight-leg'
  | 'cropped'
  | 'long-sleeve'
  | 'short-sleeve'
  | 'sleeveless'
  | 'peplum'
  | 'asymmetrical-hem'
  | 'v-neck'
  | 'boat-neck'
  | 'mock-neck'
  | 'turtleneck'
  | 'other';

export type WardrobeFitOption =
  | 'second-skin'
  | 'slim'
  | 'regular'
  | 'relaxed'
  | 'oversized'
  | 'tailored'
  | 'other';

export type WardrobeFormalityOption =
  | 'casual'
  | 'smart-casual'
  | 'business-casual'
  | 'business-formal'
  | 'evening'
  | 'formal'
  | 'athleisure'
  | 'other';

export type WardrobeStyleTagOption =
  | 'minimalist'
  | 'classic'
  | 'modern'
  | 'trendy'
  | 'edgy'
  | 'boho'
  | 'preppy'
  | 'athleisure'
  | 'streetwear'
  | 'romantic'
  | 'feminine'
  | 'androgynous'
  | 'workwear'
  | 'vintage'
  | 'sporty'
  | 'heritage'
  | 'other';

export type WardrobeSeasonOption = 'spring' | 'summer' | 'fall' | 'winter' | 'all-season';

export type WardrobeOccasionOption =
  | 'work'
  | 'weekend'
  | 'date'
  | 'family'
  | 'travel'
  | 'party'
  | 'formal-event'
  | 'outdoor'
  | 'athletic'
  | 'lounging'
  | 'wedding'
  | 'other';

export interface WardrobeItem {
  id: string;
  title: string;
  imageUrl: string;
  category: string;
  subCategory?: string;
  description?: string;
  silhouettes?: WardrobeSilhouetteOption[];
  colors?: WardrobeColorOption[];
  fabrics?: WardrobeFabricOption[];
  pattern?: WardrobePatternOption;
  silhouette?: WardrobeSilhouetteOption;
  fit?: WardrobeFitOption;
  formalities?: WardrobeFormalityOption[];
  styleTags?: WardrobeStyleTagOption[];
  seasons?: WardrobeSeasonOption[];
  occasions?: WardrobeOccasionOption[];
  careNotes?: string;
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

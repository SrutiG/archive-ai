import React from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import './App.css';
import { UserProvider, useUser } from './contexts/UserContext';
import Navigation from './components/Navigation';
import LoginPage from './pages/LoginPage';
import ProfilePage from './pages/ProfilePage';
import WardrobePage from './pages/WardrobePage';
import OutfitsPage from './pages/OutfitsPage';
import ExplorePage from './pages/ExplorePage';
import AdminPortal from './pages/AdminPortal';

export type WardrobeColorOption =
  | 'black'
  | 'white'
  | 'gray'
  | 'charcoal'
  | 'slate'
  | 'silver'
  | 'navy'
  | 'blue'
  | 'teal'
  | 'turquoise'
  | 'cyan'
  | 'sky-blue'
  | 'indigo'
  | 'green'
  | 'emerald'
  | 'mint'
  | 'sage'
  | 'forest'
  | 'lime'
  | 'olive'
  | 'red'
  | 'crimson'
  | 'maroon'
  | 'rust'
  | 'terracotta'
  | 'burgundy'
  | 'pink'
  | 'magenta'
  | 'fuchsia'
  | 'rose'
  | 'coral'
  | 'salmon'
  | 'purple'
  | 'violet'
  | 'eggplant'
  | 'lilac'
  | 'lavender'
  | 'plum'
  | 'yellow'
  | 'gold'
  | 'mustard'
  | 'amber'
  | 'orange'
  | 'peach'
  | 'apricot'
  | 'brown'
  | 'chocolate'
  | 'caramel'
  | 'coffee'
  | 'taupe'
  | 'tan'
  | 'beige'
  | 'cream'
  | 'ivory'
  | 'ecru'
  | 'camel'
  | 'khaki'
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
  | 'modal'
  | 'rayon'
  | 'tencel'
  | 'nylon'
  | 'polyester'
  | 'cupro'
  | 'acetate'
  | 'acrylic'
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
  | 'high-rise'
  | 'mid-rise'
  | 'low-rise'
  | 'cropped'
  | 'hip-length'
  | 'mid-thigh'
  | 'waist-length'
  | 'knee-length'
  | 'long'
  | 'ankle-length'
  | 'full-length'
  | 'capri'
  | '7/8-length'
  | '3/4-length'
  | 'mini'
  | 'midi'
  | 'maxi'
  | 'tea-length'
  | 'floor-length'
  | 'long-sleeve'
  | 'short-sleeve'
  | 'sleeveless'
  | 'peplum'
  | 'asymmetrical-hem'
  | 'v-neck'
  | 'boat-neck'
  | 'mock-neck'
  | 'turtleneck'
  | 'crew-neck'
  | 'scoop-neck'
  | 'scoop'
  | 'square-neck'
  | 'sweetheart'
  | 'off-the-shoulder'
  | 'halter-neck'
  | 'cowl-neck'
  | 'hooded'
  | 'collared'
  | 'collarless'
  | 'lapel'
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
  brand?: string;
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

const ProtectedRoutes: React.FC<{ currentUser: ReturnType<typeof useUser>['currentUser'] }> = ({ currentUser }) => {
  const location = useLocation();
  const isAdminRoute = location.pathname.startsWith('/admin');
  const isAuthenticated = Boolean(currentUser);

  return (
    <div className={`App${isAdminRoute ? ' App--admin' : ''}`}>
      {isAuthenticated && !isAdminRoute && <Navigation />}

      <main className={isAdminRoute ? 'Admin-main' : 'App-main'}>
        <Routes>
          <Route path="/admin" element={<AdminPortal />} />
          <Route
            path="/"
            element={
              isAuthenticated ? <WardrobePage apiUrl={API_BASE_URL} /> : <LoginPage />
            }
          />
          <Route
            path="/profile"
            element={
              isAuthenticated ? <ProfilePage apiUrl={API_BASE_URL} /> : <LoginPage />
            }
          />
          <Route
            path="/wardrobe"
            element={
              isAuthenticated ? <WardrobePage apiUrl={API_BASE_URL} /> : <LoginPage />
            }
          />
          <Route
            path="/outfits"
            element={
              isAuthenticated ? <OutfitsPage apiUrl={API_BASE_URL} /> : <LoginPage />
            }
          />
          <Route
            path="/explore"
            element={
              isAuthenticated ? <ExplorePage apiUrl={API_BASE_URL} /> : <LoginPage />
            }
          />
          <Route
            path="*"
            element={
              isAuthenticated ? <WardrobePage apiUrl={API_BASE_URL} /> : <LoginPage />
            }
          />
        </Routes>
      </main>
    </div>
  );
};

const AppContent: React.FC = () => {
  const { currentUser, isLoading } = useUser();

  if (isLoading) {
    return (
      <div className="App-loading">
        <div className="loading-spinner"></div>
      </div>
    );
  }

  return (
    <Router>
      <ProtectedRoutes currentUser={currentUser} />
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

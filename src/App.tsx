import { HashRouter, Route, Routes, useLocation } from 'react-router-dom';
import { BottomTabs } from './components/BottomTabs';
import { ToastProvider } from './components/Toast';
import { AddEditPage } from './pages/AddEditPage';
import { LibraryPage } from './pages/LibraryPage';
import { NoteDetailPage } from './pages/NoteDetailPage';
import { ReviewPage } from './pages/ReviewPage';
import { SettingsPage } from './pages/SettingsPage';
import { SplitCardsPage } from './pages/SplitCardsPage';
import { StatsPage } from './pages/StatsPage';
import { TodayPage } from './pages/TodayPage';

function Layout() {
  const loc = useLocation();
  const hideTabs = loc.pathname.startsWith('/review');
  return (
    <>
      <Routes>
        <Route path="/" element={<TodayPage />} />
        <Route path="/review" element={<ReviewPage />} />
        <Route path="/add" element={<AddEditPage />} />
        <Route path="/edit/:type/:id" element={<AddEditPage />} />
        <Route path="/library" element={<LibraryPage />} />
        <Route path="/notes/:id" element={<NoteDetailPage />} />
        <Route path="/notes/:id/split" element={<SplitCardsPage />} />
        <Route path="/stats" element={<StatsPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="*" element={<TodayPage />} />
      </Routes>
      {!hideTabs && <BottomTabs />}
    </>
  );
}

export default function App() {
  return (
    <HashRouter>
      <ToastProvider>
        <Layout />
      </ToastProvider>
    </HashRouter>
  );
}

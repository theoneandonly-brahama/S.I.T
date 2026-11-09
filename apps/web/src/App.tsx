import { Link, Route, Routes } from 'react-router';
import HomePage from './pages/HomePage.tsx';
import Layout from './components/Layout.tsx';
import LoginPage from './pages/LoginPage.tsx';
import ProfilePage from './pages/ProfilePage.tsx';
import RegisterPage from './pages/RegisterPage.tsx';
import SettingsPage from './pages/SettingsPage.tsx';
import UploadPage from './pages/UploadPage.tsx';
import { buttonClass } from './components/ui/buttonClass.ts';

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<HomePage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/profile" element={<ProfilePage />} />
        <Route path="/uploads" element={<UploadPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route
          path="*"
          element={
            <section className="mx-auto flex max-w-6xl flex-col items-center px-4 py-24 text-center sm:px-6">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-600 dark:text-brand-300">
                404
              </p>
              <h1 className="mt-3 font-display text-3xl font-semibold tracking-tight text-ink-900 dark:text-white">
                Page not found
              </h1>
              <p className="mt-2 text-sm text-ink-500 dark:text-ink-300">
                This address does not exist.
              </p>
              <Link to="/" className={buttonClass('primary', 'md', 'mt-6')}>
                Go home
              </Link>
            </section>
          }
        />
      </Route>
    </Routes>
  );
}

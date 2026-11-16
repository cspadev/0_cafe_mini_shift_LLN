import { createRoot } from 'react-dom/client';
import '@fontsource/baloo-2/latin-700.css';
import '@fontsource/baloo-2/latin-ext-700.css';
import '@fontsource/baloo-2/latin-800.css';
import '@fontsource/baloo-2/latin-ext-800.css';
import '@fontsource/nunito/latin-400.css';
import '@fontsource/nunito/latin-ext-400.css';
import '@fontsource/nunito/latin-700.css';
import '@fontsource/nunito/latin-ext-700.css';
import './styles.css';
// Výslovně .tsx: kdyby v repozitáři zůstal App.jsx ze šablony, Vite by ho jinak načetl přednostně.
import App from './App.tsx';

createRoot(document.getElementById('root')!).render(<App />);

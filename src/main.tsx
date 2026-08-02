import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// Global contextmenu prevention is now handled per-component via onContextMenu handlers
// to allow custom right-click menus in MusicPlayer

createRoot(document.getElementById('root')!).render(
  <App />,
)

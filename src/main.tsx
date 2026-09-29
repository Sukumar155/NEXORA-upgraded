import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import 'leaflet/dist/leaflet.css'
import './index.css'
import App from './App.tsx'
import { useNexoraStore } from './store/useNexoraStore'

if (typeof window !== 'undefined') {
  (window as any).useNexoraStore = useNexoraStore;
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)


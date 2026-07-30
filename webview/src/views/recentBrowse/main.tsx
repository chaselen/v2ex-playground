import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { ToastViewport } from '@/components/ui'
import 'simplebar-react/dist/simplebar.min.css'
import '@/styles/index.scss'
import './recentBrowse.scss'
import App from './RecentBrowseApp'

createRoot(document.getElementById('app')!).render(
  <StrictMode>
    <App />
    <ToastViewport />
  </StrictMode>
)

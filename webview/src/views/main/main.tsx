import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { ToastViewport } from '@/components/ui'
import App from './MainApp'
import '@/styles/index.scss'
import './main.scss'

createRoot(document.getElementById('app')!).render(
  <StrictMode>
    <App />
    <ToastViewport />
  </StrictMode>
)

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { ToastViewport } from '@/components/ui'
import '@/styles/index.scss'
import './theme.scss'
import ThemePreviewApp from './ThemePreviewApp'

createRoot(document.getElementById('app')!).render(
  <StrictMode>
    <ThemePreviewApp />
    <ToastViewport />
  </StrictMode>
)

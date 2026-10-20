import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { ToastViewport } from '@/components/ui'
import '@/styles/index.scss'
import './node.scss'
import App from './NodeApp'

createRoot(document.getElementById('app')!).render(
  <StrictMode>
    <App />
    <ToastViewport />
  </StrictMode>
)

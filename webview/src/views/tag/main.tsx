import { ToastViewport } from '@/components/ui'
import { StrictMode } from 'react'
import PanelAddressBar from '@/components/PanelAddressBar'
import { createRoot } from 'react-dom/client'
import '@/styles/index.scss'
import './tag.scss'
import App from './TagApp'

createRoot(document.getElementById('app')!).render(
  <StrictMode>
    <PanelAddressBar>
      <App />
    </PanelAddressBar>
    <ToastViewport />
  </StrictMode>
)

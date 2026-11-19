import { ToastViewport } from '@/components/ui'
import { StrictMode } from 'react'
import PanelAddressBar from '@/components/PanelAddressBar'
import { createRoot } from 'react-dom/client'
import App from './MemberApp'
import ImagePreviewProvider from '@/components/ImagePreviewProvider'
import '@/styles/index.scss'
import './member.scss'

createRoot(document.getElementById('app')!).render(
  <StrictMode>
    <PanelAddressBar>
      <ImagePreviewProvider>
        <App />
      </ImagePreviewProvider>
    </PanelAddressBar>
    <ToastViewport />
  </StrictMode>
)

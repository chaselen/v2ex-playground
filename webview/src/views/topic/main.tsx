import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './TopicApp'
import PanelAddressBar from '@/components/PanelAddressBar'
import ImagePreviewProvider from '@/components/ImagePreviewProvider'
import { ToastViewport } from '@/components/ui'
import '@/styles/index.scss'
import './topic.scss'

createRoot(document.getElementById('app')!).render(
  <StrictMode>
    <PanelAddressBar>
      <ImagePreviewProvider showEmoticonFilter>
        <App />
      </ImagePreviewProvider>
    </PanelAddressBar>
    <ToastViewport />
  </StrictMode>
)

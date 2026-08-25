import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import 'simplebar-react/dist/simplebar.min.css'
import '@/styles/index.scss'
import './createTopic.scss'
import ImagePreviewProvider from '@/components/ImagePreviewProvider'
import { ToastViewport } from '@/components/ui'
import CreateTopicApp from './CreateTopicApp'

createRoot(document.getElementById('app')!).render(
  <StrictMode>
    <ImagePreviewProvider>
      <CreateTopicApp />
    </ImagePreviewProvider>
    <ToastViewport />
  </StrictMode>
)

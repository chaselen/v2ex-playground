import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './TopicApp'
import ImagePreviewProvider from '@/components/ImagePreviewProvider'
import { ToastViewport } from '@/components/ui'
import 'simplebar-react/dist/simplebar.min.css'
import '../../styles/index.scss'
import './topic.scss'

createRoot(document.getElementById('app')!).render(
  <StrictMode>
    <ImagePreviewProvider>
      <App />
    </ImagePreviewProvider>
    <ToastViewport />
  </StrictMode>
)

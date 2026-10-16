import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './HelpApp'
import ImagePreviewProvider from '@/components/ImagePreviewProvider'
import '@/styles/index.scss'
import './help.scss'

createRoot(document.getElementById('app')!).render(
  <StrictMode>
    <ImagePreviewProvider>
      <App />
    </ImagePreviewProvider>
  </StrictMode>
)

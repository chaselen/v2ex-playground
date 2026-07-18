import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './MemberApp'
import ImagePreviewProvider from '@/components/ImagePreviewProvider'
import 'simplebar-react/dist/simplebar.min.css'
import '../../styles/index.scss'
import './member.scss'

createRoot(document.getElementById('app')!).render(
  <StrictMode>
    <ImagePreviewProvider>
      <App />
    </ImagePreviewProvider>
  </StrictMode>
)

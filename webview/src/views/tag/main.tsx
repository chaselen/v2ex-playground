import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@/styles/index.scss'
import './tag.scss'
import App from './TagApp'

createRoot(document.getElementById('app')!).render(
  <StrictMode>
    <App />
  </StrictMode>
)

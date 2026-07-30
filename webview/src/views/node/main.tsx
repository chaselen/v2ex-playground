import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import 'simplebar-react/dist/simplebar.min.css'
import '@/styles/index.scss'
import './node.scss'
import App from './NodeApp'

createRoot(document.getElementById('app')!).render(
  <StrictMode>
    <App />
  </StrictMode>
)

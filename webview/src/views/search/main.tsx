import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './SearchApp'
import 'simplebar-react/dist/simplebar.min.css'
import '@/styles/index.scss'
import './search.scss'

createRoot(document.getElementById('app')!).render(
  <StrictMode>
    <App />
  </StrictMode>
)

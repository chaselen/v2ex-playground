import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './BalanceApp'
import '@/styles/index.scss'
import './balance.scss'

createRoot(document.getElementById('app')!).render(
  <StrictMode>
    <App />
  </StrictMode>
)

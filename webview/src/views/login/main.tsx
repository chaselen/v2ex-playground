import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import LoginApp from './LoginApp'
import '@/styles/index.scss'
import './login.scss'

createRoot(document.getElementById('app')!).render(
  <StrictMode>
    <LoginApp />
  </StrictMode>
)

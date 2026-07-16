import '@douyinfe/semi-ui/react19-adapter'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './TwoFactorApp'
import '../../styles/index.scss'
import './twoFactor.scss'

createRoot(document.getElementById('app')!).render(
  <StrictMode>
    <App />
  </StrictMode>
)

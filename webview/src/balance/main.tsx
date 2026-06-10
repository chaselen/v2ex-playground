import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './BalanceApp'
import '@douyinfe/semi-ui/react19-adapter'
import 'simplebar-react/dist/simplebar.min.css'
import '../shared/styles.scss'
import './balance.scss'

createRoot(document.getElementById('app')!).render(
  <StrictMode>
    <App />
  </StrictMode>
)

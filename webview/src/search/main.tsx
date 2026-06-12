import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './SearchApp'
import '@douyinfe/semi-ui/react19-adapter'
import 'simplebar-react/dist/simplebar.min.css'
import '../shared/styles.scss'
import './search.scss'

createRoot(document.getElementById('app')!).render(
  <StrictMode>
    <App />
  </StrictMode>
)

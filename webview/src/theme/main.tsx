import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@douyinfe/semi-ui/react19-adapter'
import '../shared/styles.scss'
import './theme.scss'
import ThemePreviewApp from './ThemePreviewApp'

createRoot(document.getElementById('app')!).render(
  <StrictMode>
    <ThemePreviewApp />
  </StrictMode>
)

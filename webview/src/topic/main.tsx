import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './TopicApp'
import '@douyinfe/semi-ui/dist/css/semi.min.css'
import '../shared/styles.scss'
import './topic.scss'

createRoot(document.getElementById('app')!).render(
  <StrictMode>
    <App />
  </StrictMode>
)

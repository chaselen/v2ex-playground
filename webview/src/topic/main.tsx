import '@douyinfe/semi-ui/react19-adapter'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './TopicApp'
import ImagePreviewProvider from '../shared/ImagePreviewProvider'
import 'simplebar-react/dist/simplebar.min.css'
import '../shared/styles.scss'
import './topic.scss'

createRoot(document.getElementById('app')!).render(
  <StrictMode>
    <ImagePreviewProvider>
      <App />
    </ImagePreviewProvider>
  </StrictMode>
)

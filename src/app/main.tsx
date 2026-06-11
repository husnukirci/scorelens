import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import { App } from '@/app/App'

import '@/styles/index.css'

const rootElement = document.getElementById('root')
if (rootElement === null) {
  throw new Error('scorelens: #root element missing from index.html')
}

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './index.css'
import { TenantConfigurationProvider } from './tenant'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <TenantConfigurationProvider><App /></TenantConfigurationProvider>
  </StrictMode>,
)

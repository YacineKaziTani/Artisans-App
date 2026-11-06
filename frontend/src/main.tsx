import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { initMonitoring, reportReactError } from '@/lib/monitoring'
import { initAnalytics } from '@/lib/analytics'

initMonitoring()
initAnalytics()

createRoot(document.getElementById('root')!, {
  // Errors caught by an error boundary (incl. React Router's error page)
  // and ones nothing caught both get reported, then logged as React would.
  onCaughtError: (error, info) => reportReactError(error, info.componentStack),
  onUncaughtError: (error, info) => reportReactError(error, info.componentStack),
}).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

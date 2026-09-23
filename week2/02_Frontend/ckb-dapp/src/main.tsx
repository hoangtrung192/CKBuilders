import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { ccc } from '@ckb-ccc/connector-react'
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ccc.Provider>
      <App />
    </ccc.Provider>
  </StrictMode>,
)
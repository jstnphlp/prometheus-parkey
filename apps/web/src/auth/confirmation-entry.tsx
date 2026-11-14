import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import './confirmation.css'
import { EmailConfirmation } from './confirmation-page'

const root = document.getElementById('confirmation-root')
if (!root) throw new Error('Confirmation page root is missing.')
createRoot(root).render(
  <StrictMode>
    <EmailConfirmation />
  </StrictMode>,
)

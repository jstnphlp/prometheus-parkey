import { createFileRoute } from '@tanstack/react-router'

import { EmailConfirmation } from '../auth/confirmation-page'
import confirmationCss from '../auth/confirmation.css?url'

export const Route = createFileRoute('/auth/confirm')({
  head: () => ({
    meta: [
      { title: 'Confirm your email | Parkey' },
      { name: 'robots', content: 'noindex, nofollow' },
      { name: 'referrer', content: 'no-referrer' },
    ],
    links: [{ rel: 'stylesheet', href: confirmationCss }],
  }),
  component: EmailConfirmation,
})

export const passwordGuidance =
  'Use at least 8 characters, an uppercase letter, a lowercase letter and a special character.'

export function emailProblem(email: string): string | null {
  return email.trim().length <= 254 &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
    ? null
    : 'Enter a valid email address.'
}

export function passwordProblem(password: string): string | null {
  return password.length >= 8 &&
    /[A-Z]/.test(password) &&
    /[a-z]/.test(password) &&
    /[\p{P}\p{S}]/u.test(password)
    ? null
    : passwordGuidance
}

export function registrationProblems(fields: {
  name: string
  email: string
  password: string
  confirmation: string
}) {
  return {
    name:
      fields.name.trim().length >= 2 && fields.name.trim().length <= 100
        ? null
        : 'Enter your full name (2–100 characters).',
    email: emailProblem(fields.email),
    password: passwordProblem(fields.password),
    confirmation:
      fields.confirmation === fields.password && fields.confirmation.length > 0
        ? null
        : 'Passwords must match.',
  }
}

export function authErrorMessage(error: unknown): string {
  const code =
    error && typeof error === 'object' && 'code' in error ? error.code : null
  switch (code) {
    case 'invalid_credentials':
      return 'Email or password is incorrect. Please try again.'
    case 'email_not_confirmed':
      return 'Confirm your email before logging in. You can request another confirmation email below.'
    case 'weak_password':
      return `This password was not accepted. ${passwordGuidance} Avoid common or compromised passwords.`
    case 'same_password':
      return 'Choose a password you have not used for this account.'
    case 'over_request_rate_limit':
    case 'over_email_send_rate_limit':
      return 'Too many attempts. Wait a few minutes and try again.'
    case 'otp_expired':
    case 'flow_state_expired':
    case 'flow_state_not_found':
    case 'bad_code_verifier':
    case 'pkce_code_verifier_not_found':
      return 'This link is expired or cannot be verified on this device. Request a new email from this app.'
    case 'user_banned':
      return 'This account cannot sign in. Contact Parkey support.'
    case 'signup_disabled':
      return 'New accounts are currently unavailable. You can still explore parking.'
    case 'reauthentication_needed':
      return 'Request a new password reset email to verify your identity again.'
    default:
      return 'Could not complete the request. Check your connection and try again.'
  }
}

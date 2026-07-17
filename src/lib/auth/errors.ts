export type AuthErrorContext =
  | "login"
  | "signup"
  | "password-recovery"
  | "password-update";

const RATE_LIMIT_CODES = new Set([
  "over_email_send_rate_limit",
  "over_request_rate_limit",
  "request_timeout",
]);

export function getFriendlyAuthError(
  context: AuthErrorContext,
  code: string | undefined,
) {
  if (RATE_LIMIT_CODES.has(code ?? "")) {
    return "Too many attempts. Please wait a few minutes and try again.";
  }

  if (context === "login") {
    if (code === "email_not_confirmed") {
      return "Verify your email before logging in. Check your inbox for the confirmation link.";
    }

    return "Email or password is incorrect.";
  }

  if (context === "signup") {
    if (code === "weak_password") {
      return "Choose a stronger password and try again.";
    }

    return "We could not create an account with those details. Try logging in or resetting your password.";
  }

  if (context === "password-update") {
    if (code === "same_password") {
      return "Choose a password you have not used for this account.";
    }

    return "We could not update your password. Request a new reset link and try again.";
  }

  return "We could not send a reset email right now. Please try again in a few minutes.";
}

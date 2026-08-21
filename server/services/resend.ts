import { Resend } from 'resend';

// Resend credentials come from the environment.
// RESEND_FROM_EMAIL must be a sender on a domain verified in Resend
// (falls back to Resend's shared onboarding sender for dev).
function getCredentials() {
  const apiKey = process.env.RESEND_API_KEY;
  const fromEmail = process.env.RESEND_FROM_EMAIL || 'Revely Feedback <onboarding@resend.dev>';

  if (!apiKey) {
    throw new Error('RESEND_API_KEY is not set — email sending is not configured');
  }

  return { apiKey, fromEmail };
}

export async function getResendClient() {
  const { apiKey, fromEmail } = getCredentials();
  return {
    client: new Resend(apiKey),
    fromEmail
  };
}

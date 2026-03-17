"""
Email service for LeanPilot.
Supports multiple providers: SMTP, Resend, or console fallback for development.
"""
import structlog
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

from app.core.config import get_settings

logger = structlog.get_logger(__name__)
settings = get_settings()


class EmailService:
    """Send transactional emails. Falls back to console logging in dev."""

    @staticmethod
    async def send_welcome_email(
        to_email: str,
        full_name: str,
        temp_password: str,
        factory_name: str,
        lang: str = "en",
    ) -> bool:
        """Send welcome email with login credentials after registration."""

        if lang == "it":
            subject = f"Benvenuto su LeanPilot — Le tue credenziali di accesso"
            html = _welcome_template_it(full_name, to_email, temp_password, factory_name)
        else:
            subject = f"Welcome to LeanPilot — Your Login Credentials"
            html = _welcome_template_en(full_name, to_email, temp_password, factory_name)

        return await EmailService._send(to_email, subject, html)

    @staticmethod
    async def _send(to: str, subject: str, html_body: str) -> bool:
        """Send email via configured provider."""

        # If no SMTP configured, log to console (development mode)
        if not settings.smtp_host:
            logger.info(f"[EMAIL DEV] To: {to}")
            logger.info(f"[EMAIL DEV] Subject: {subject}")
            logger.info(f"[EMAIL DEV] Body preview: {html_body[:200]}...")
            return True

        try:
            msg = MIMEMultipart("alternative")
            msg["Subject"] = subject
            msg["From"] = f"LeanPilot <{settings.smtp_from_email}>"
            msg["To"] = to
            msg.attach(MIMEText(html_body, "html"))

            if settings.smtp_port == 465:
                server = smtplib.SMTP_SSL(settings.smtp_host, settings.smtp_port)
            else:
                server = smtplib.SMTP(settings.smtp_host, settings.smtp_port)
                server.starttls()

            if settings.smtp_user and settings.smtp_password:
                server.login(settings.smtp_user, settings.smtp_password)

            server.sendmail(settings.smtp_from_email, to, msg.as_string())
            server.quit()
            logger.info(f"Email sent to {to}: {subject}")
            return True

        except Exception as e:
            logger.error(f"Failed to send email to {to}: {e}")
            return False


def _welcome_template_en(name: str, email: str, password: str, factory: str) -> str:
    return f"""
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f9fafb; padding: 40px 20px;">
  <div style="max-width: 560px; margin: 0 auto; background: white; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,0.08);">
    <!-- Header -->
    <div style="background: linear-gradient(135deg, #4f46e5, #7c3aed); padding: 32px; text-align: center;">
      <h1 style="color: white; margin: 0; font-size: 24px;">Welcome to LeanPilot</h1>
      <p style="color: rgba(255,255,255,0.8); margin: 8px 0 0; font-size: 14px;">Your lean manufacturing journey starts now</p>
    </div>

    <!-- Body -->
    <div style="padding: 32px;">
      <p style="color: #374151; font-size: 16px; line-height: 1.6;">
        Hi <strong>{name}</strong>,
      </p>
      <p style="color: #6b7280; font-size: 14px; line-height: 1.6;">
        Your LeanPilot account for <strong>{factory}</strong> has been created. Here are your login credentials:
      </p>

      <!-- Credentials box -->
      <div style="background: #f3f4f6; border-radius: 12px; padding: 20px; margin: 24px 0;">
        <table style="width: 100%;">
          <tr>
            <td style="color: #6b7280; font-size: 13px; padding: 4px 0;">Email:</td>
            <td style="color: #111827; font-size: 14px; font-weight: 600; text-align: right;">{email}</td>
          </tr>
          <tr>
            <td style="color: #6b7280; font-size: 13px; padding: 4px 0;">Temporary Password:</td>
            <td style="color: #111827; font-size: 14px; font-weight: 600; text-align: right; font-family: monospace; letter-spacing: 1px;">{password}</td>
          </tr>
        </table>
      </div>

      <p style="color: #ef4444; font-size: 13px;">⚠️ Please change your password after first login.</p>

      <!-- CTA Button -->
      <div style="text-align: center; margin: 28px 0;">
        <a href="https://lean.autopilot.rs"
           style="display: inline-block; background: linear-gradient(135deg, #4f46e5, #7c3aed); color: white; text-decoration: none; padding: 14px 32px; border-radius: 10px; font-weight: 600; font-size: 15px;">
          Log In to LeanPilot →
        </a>
      </div>

      <p style="color: #6b7280; font-size: 14px; line-height: 1.6;">
        Your 14-day free trial includes full access to all 17 lean tools. No credit card required.
      </p>
    </div>

    <!-- Footer -->
    <div style="background: #f9fafb; padding: 20px 32px; border-top: 1px solid #e5e7eb;">
      <p style="color: #9ca3af; font-size: 12px; text-align: center; margin: 0;">
        LeanPilot — Digital Lean Manufacturing for Smart Factories<br/>
        This email was sent because you registered at lean.autopilot.rs<br/>
        <a href="https://lean.autopilot.rs/privacy" style="color: #6366f1;">Privacy Policy</a> &bull;
        <a href="https://lean.autopilot.rs/unsubscribe" style="color: #6366f1;">Unsubscribe</a>
      </p>
    </div>
  </div>
</body>
</html>"""


def _welcome_template_it(name: str, email: str, password: str, factory: str) -> str:
    return f"""
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f9fafb; padding: 40px 20px;">
  <div style="max-width: 560px; margin: 0 auto; background: white; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,0.08);">
    <!-- Header -->
    <div style="background: linear-gradient(135deg, #4f46e5, #7c3aed); padding: 32px; text-align: center;">
      <h1 style="color: white; margin: 0; font-size: 24px;">Benvenuto su LeanPilot</h1>
      <p style="color: rgba(255,255,255,0.8); margin: 8px 0 0; font-size: 14px;">Il tuo percorso lean manufacturing inizia ora</p>
    </div>

    <!-- Body -->
    <div style="padding: 32px;">
      <p style="color: #374151; font-size: 16px; line-height: 1.6;">
        Ciao <strong>{name}</strong>,
      </p>
      <p style="color: #6b7280; font-size: 14px; line-height: 1.6;">
        Il tuo account LeanPilot per <strong>{factory}</strong> è stato creato. Ecco le tue credenziali di accesso:
      </p>

      <!-- Credentials box -->
      <div style="background: #f3f4f6; border-radius: 12px; padding: 20px; margin: 24px 0;">
        <table style="width: 100%;">
          <tr>
            <td style="color: #6b7280; font-size: 13px; padding: 4px 0;">Email:</td>
            <td style="color: #111827; font-size: 14px; font-weight: 600; text-align: right;">{email}</td>
          </tr>
          <tr>
            <td style="color: #6b7280; font-size: 13px; padding: 4px 0;">Password temporanea:</td>
            <td style="color: #111827; font-size: 14px; font-weight: 600; text-align: right; font-family: monospace; letter-spacing: 1px;">{password}</td>
          </tr>
        </table>
      </div>

      <p style="color: #ef4444; font-size: 13px;">⚠️ Ti preghiamo di cambiare la password dopo il primo accesso.</p>

      <!-- CTA Button -->
      <div style="text-align: center; margin: 28px 0;">
        <a href="https://lean.autopilot.rs"
           style="display: inline-block; background: linear-gradient(135deg, #4f46e5, #7c3aed); color: white; text-decoration: none; padding: 14px 32px; border-radius: 10px; font-weight: 600; font-size: 15px;">
          Accedi a LeanPilot →
        </a>
      </div>

      <p style="color: #6b7280; font-size: 14px; line-height: 1.6;">
        La tua prova gratuita di 14 giorni include accesso completo a tutti i 17 strumenti lean. Nessuna carta di credito richiesta.
      </p>
    </div>

    <!-- Footer -->
    <div style="background: #f9fafb; padding: 20px 32px; border-top: 1px solid #e5e7eb;">
      <p style="color: #9ca3af; font-size: 12px; text-align: center; margin: 0;">
        LeanPilot — Lean Manufacturing Digitale per Fabbriche Intelligenti<br/>
        Questa email è stata inviata perché ti sei registrato su lean.autopilot.rs<br/>
        <a href="https://lean.autopilot.rs/privacy" style="color: #6366f1;">Informativa Privacy</a> &bull;
        <a href="https://lean.autopilot.rs/unsubscribe" style="color: #6366f1;">Disiscriviti</a>
      </p>
    </div>
  </div>
</body>
</html>"""

import os
import time
from datetime import datetime, timezone
from email.mime.application import MIMEApplication
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from typing import List, Dict, Any, Optional

from fastapi.concurrency import run_in_threadpool

from services.email import config
from services.email.smtp_client import (
    SMTPClient,
    SMTPClientError,
    SMTPAuthError,
    SMTPConnectionError,
    SMTPTimeoutError,
    SMTPSSLError,
    SMTPInvalidRecipientError
)
from services.email.template_renderer import TemplateRenderer, EmailTemplateError
from utils.email_logger import (
    log_email_sent,
    log_email_failed,
    log_smtp_error
)

class EmailService:
    """
    Unified, reusable Email Service for the application.
    Integrates template rendering, logging, SMTP lifecycle, retries, and health checks.
    """
    def __init__(self):
        # Initialize smtp client using config parameters
        self.smtp_client = SMTPClient(
            host=config.SMTP_HOST or "",
            port=int(config.SMTP_PORT) if config.SMTP_PORT else 587,
            username=config.SMTP_EMAIL,
            password=config.SMTP_PASSWORD,
            use_ssl=config.SMTP_USE_SSL,
            timeout=config.SMTP_TIMEOUT
        )
        self.renderer = TemplateRenderer()

    def validate_configuration(self) -> None:
        """
        Validates the configuration variables loaded from the environment.
        Raises:
            EmailConfigError: If configuration is invalid or keys are missing.
        """
        config.validate_config()

    def _create_response(self, status: str, message: str, error_code: Optional[str] = None) -> Dict[str, Any]:
        """
        Helper method to build consistent response payloads.
        """
        response = {
            "status": status,
            "message": message,
            "timestamp": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
        }
        if error_code:
            response["error_code"] = error_code
        return response

    async def _send_mime_message(
        self, 
        recipient: str, 
        subject: str, 
        msg: MIMEMultipart, 
        max_retries: int = 3
    ) -> Dict[str, Any]:
        """
        Internal helper to send a MIME message with automatic retry logic.
        """
        last_error = ""
        error_code = "SEND_ERROR"
        
        for attempt in range(1, max_retries + 1):
            try:
                # Compile MIME message header
                msg["Subject"] = subject
                msg["From"] = f"{config.SMTP_FROM_NAME} <{config.SMTP_EMAIL}>"
                msg["To"] = recipient
                
                # Send the email via thread pool to prevent blocking the event loop
                await run_in_threadpool(
                    self.smtp_client.send_email,
                    config.SMTP_EMAIL,
                    [recipient],
                    msg.as_string()
                )
                
                log_email_sent(recipient, subject)
                return self._create_response("success", "Email sent successfully")

            except SMTPAuthError as e:
                error_code = "AUTHENTICATION_ERROR"
                last_error = str(e)
                log_email_failed(recipient, subject, last_error)
                # Authentication errors shouldn't be retried
                break
            except SMTPInvalidRecipientError as e:
                error_code = "INVALID_RECIPIENT"
                last_error = str(e)
                log_email_failed(recipient, subject, last_error)
                # Invalid recipient shouldn't be retried
                break
            except SMTPTimeoutError as e:
                error_code = "TIMEOUT_ERROR"
                last_error = str(e)
                log_email_failed(recipient, subject, f"Attempt {attempt}/{max_retries} failed: {last_error}")
            except SMTPSSLError as e:
                error_code = "SSL_ERROR"
                last_error = str(e)
                log_email_failed(recipient, subject, f"Attempt {attempt}/{max_retries} failed: {last_error}")
            except SMTPConnectionError as e:
                error_code = "CONNECTION_ERROR"
                last_error = str(e)
                log_email_failed(recipient, subject, f"Attempt {attempt}/{max_retries} failed: {last_error}")
            except SMTPClientError as e:
                error_code = "SMTP_ERROR"
                last_error = str(e)
                log_email_failed(recipient, subject, f"Attempt {attempt}/{max_retries} failed: {last_error}")
            except Exception as e:
                error_code = "INTERNAL_ERROR"
                last_error = str(e)
                log_email_failed(recipient, subject, f"Attempt {attempt}/{max_retries} failed: {last_error}")
            
            # Brief backoff before retry
            if attempt < max_retries:
                time.sleep(1)

        return self._create_response("failure", f"Failed to send email after {max_retries} attempts. Last error: {last_error}", error_code)

    async def send_html_email(
        self,
        recipient: str,
        subject: str,
        template_name: str,
        context: Optional[Dict[str, Any]] = None,
        attachments: Optional[List[Dict[str, Any]]] = None,
        sync: bool = False,
        max_retries: int = 3,
        triggered_by: str = "system"
    ) -> Dict[str, Any]:
        """
        Renders a Jinja2 template and sends it as an HTML email.
        By default, enqueues the email in the background queue (sync=False).
        """
        if not sync:
            from services.email.queue import email_queue
            log_id = await email_queue.enqueue(
                recipient=recipient,
                subject=subject,
                template_name=template_name,
                context=context or {},
                triggered_by=triggered_by,
                attachments=attachments
            )
            return self._create_response("success", "Email queued successfully", log_id)

        # Validate SMTP configuration before proceeding
        try:
            self.validate_configuration()
        except Exception as e:
            return self._create_response("failure", f"Configuration validation failed: {str(e)}", "CONFIGURATION_ERROR")

        # Render HTML template
        try:
            html_content = self.renderer.render(template_name, context)
        except EmailTemplateError as e:
            return self._create_response("failure", f"Template error: {str(e)}", "TEMPLATE_ERROR")

        # Create multi-part message container
        msg = MIMEMultipart("mixed")
        
        # Create HTML/Plain text alternative container
        alternative_part = MIMEMultipart("alternative")
        
        # Simple plain text fallback
        plain_text = f"{subject}\n\nPlease view this email in an HTML-compatible client."
        alternative_part.attach(MIMEText(plain_text, "plain", "utf-8"))
        alternative_part.attach(MIMEText(html_content, "html", "utf-8"))
        
        msg.attach(alternative_part)

        # Attachments handling
        if attachments:
            for attach in attachments:
                try:
                    filename = attach.get("filename", "attachment")
                    content = attach.get("content")
                    if content:
                        part = MIMEApplication(content)
                        part.add_header("Content-Disposition", "attachment", filename=filename)
                        msg.attach(part)
                except Exception as attach_err:
                    log_smtp_error(f"Failed to attach file {filename}: {str(attach_err)}")

        return await self._send_mime_message(recipient, subject, msg, max_retries=max_retries)

    async def send_plain_text_email(
        self,
        recipient: str,
        subject: str,
        text_content: str,
        attachments: Optional[List[Dict[str, Any]]] = None,
        sync: bool = False,
        max_retries: int = 3,
        triggered_by: str = "system"
    ) -> Dict[str, Any]:
        """
        Sends a simple plain text email.
        By default, enqueues the email in the background queue (sync=False).
        """
        if not sync:
            from services.email.queue import email_queue, EmailTask
            from models import EmailLog, EmailAudit

            log = EmailLog(
                recipient=recipient,
                subject=subject,
                template_name="plain_text",
                status="Queued",
                retry_count=0
            )
            await log.insert()

            audit = EmailAudit(
                triggered_by=triggered_by,
                recipient=recipient,
                email_type="plain_text",
                status="Queued"
            )
            await audit.insert()

            task = EmailTask(
                log_id=log.id,
                audit_id=audit.id,
                recipient=recipient,
                subject=subject,
                template_name="plain_text",
                context={"text_content": text_content},
                triggered_by=triggered_by,
                attachments=attachments
            )
            await email_queue._queue.put(task)
            return self._create_response("success", "Email queued successfully", str(log.id))

        # Validate SMTP configuration before proceeding
        try:
            self.validate_configuration()
        except Exception as e:
            return self._create_response("failure", f"Configuration validation failed: {str(e)}", "CONFIGURATION_ERROR")

        # Create multi-part message container
        msg = MIMEMultipart("mixed")
        msg.attach(MIMEText(text_content, "plain", "utf-8"))

        # Attachments handling
        if attachments:
            for attach in attachments:
                try:
                    filename = attach.get("filename", "attachment")
                    content = attach.get("content")
                    if content:
                        part = MIMEApplication(content)
                        part.add_header("Content-Disposition", "attachment", filename=filename)
                        msg.attach(part)
                except Exception as attach_err:
                    log_smtp_error(f"Failed to attach file {filename}: {str(attach_err)}")

        return await self._send_mime_message(recipient, subject, msg, max_retries=max_retries)

    async def close_connection(self) -> None:
        """
        Safely disconnects from the SMTP server.
        """
        try:
            await run_in_threadpool(self.smtp_client.disconnect)
        except Exception as e:
            log_smtp_error(f"Error disconnecting client: {str(e)}")

    async def health_check(self) -> Dict[str, Any]:
        """
        Verifies SMTP configuration, connectivity, and authentication.
        
        Returns:
            Dict containing 'status', 'message', 'timestamp'.
        """
        # 1. Validate configuration
        try:
            self.validate_configuration()
        except Exception as e:
            return {
                "status": "unhealthy",
                "message": f"Configuration check failed: {str(e)}",
                "timestamp": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
            }

        # 2. Test Connection and Login
        try:
            await run_in_threadpool(self.smtp_client.connect)
            await run_in_threadpool(self.smtp_client.disconnect)
            return {
                "status": "healthy",
                "message": "SMTP server is reachable and authentication was successful.",
                "timestamp": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
            }
        except Exception as e:
            return {
                "status": "unhealthy",
                "message": f"SMTP connectivity/auth check failed: {str(e)}",
                "timestamp": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
            }

# Global shared instance of EmailService
email_service = EmailService()


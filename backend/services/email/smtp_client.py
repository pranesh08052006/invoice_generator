import smtplib
import socket
import ssl
from typing import List

from utils.email_logger import (
    log_authentication_failure,
    log_connection_timeout,
    log_smtp_error
)

class SMTPClientError(Exception):
    """Base exception for SMTP client issues."""
    pass

class SMTPConnectionError(SMTPClientError):
    """Exception raised when unable to connect to the SMTP server."""
    pass

class SMTPAuthError(SMTPClientError):
    """Exception raised when SMTP authentication fails."""
    pass

class SMTPTimeoutError(SMTPClientError):
    """Exception raised when connection or read operations time out."""
    pass

class SMTPSSLError(SMTPClientError):
    """Exception raised when SSL/TLS verification or handshake fails."""
    pass

class SMTPInvalidRecipientError(SMTPClientError):
    """Exception raised when recipient email addresses are invalid or refused by the server."""
    pass


class SMTPClient:
    """
    Dedicated SMTP client managing connection lifecycle, authentication, and sending raw emails.
    """
    def __init__(self, host: str, port: int, username: str = None, password: str = None, 
                 use_ssl: bool = True, timeout: int = 30):
        self.host = host
        self.port = int(port)
        self.username = username
        self.password = password
        self.use_ssl = use_ssl
        self.timeout = timeout
        self._server = None

    def is_connected(self) -> bool:
        """Checks if the SMTP server is currently connected and responsive using NOOP."""
        if not self._server:
            return False
        try:
            # SMTP noop should return status 250
            status_code = self._server.noop()[0]
            return status_code == 250
        except (smtplib.SMTPException, socket.error):
            return False

    def connect(self):
        """
        Establishes connection to the SMTP server and authenticates.
        If already connected, cleans up the old connection first.
        """
        self.disconnect()
        try:
            if self.use_ssl:
                context = ssl.create_default_context()
                self._server = smtplib.SMTP_SSL(
                    self.host, 
                    self.port, 
                    timeout=self.timeout, 
                    context=context
                )
            else:
                self._server = smtplib.SMTP(
                    self.host, 
                    self.port, 
                    timeout=self.timeout
                )
                # Upgrade to secure connection via STARTTLS if supported
                try:
                    self._server.ehlo()
                    if self._server.has_extn("STARTTLS"):
                        context = ssl.create_default_context()
                        self._server.starttls(context=context)
                        self._server.ehlo()
                except Exception as tls_err:
                    log_smtp_error(f"STARTTLS upgrade failed: {str(tls_err)}")

            # Authenticate if credentials are provided
            if self.username and self.password:
                self._server.login(self.username, self.password)

        except smtplib.SMTPAuthenticationError as e:
            log_authentication_failure()
            self.disconnect()
            raise SMTPAuthError(f"Authentication failed for {self.username}") from e
        except socket.timeout as e:
            log_connection_timeout()
            self.disconnect()
            raise SMTPTimeoutError(f"Connection to SMTP server timed out after {self.timeout}s.") from e
        except (socket.error, ConnectionRefusedError) as e:
            log_smtp_error(f"Connection refused/failed: {str(e)}")
            self.disconnect()
            raise SMTPConnectionError(f"Failed to connect to SMTP server at {self.host}:{self.port}") from e
        except ssl.SSLError as e:
            log_smtp_error(f"SSL/TLS handshake error: {str(e)}")
            self.disconnect()
            raise SMTPSSLError(f"SSL/TLS error occurred: {str(e)}") from e
        except Exception as e:
            log_smtp_error(f"Unexpected connection error: {str(e)}")
            self.disconnect()
            raise SMTPClientError(f"SMTP connection error: {str(e)}") from e

    def disconnect(self):
        """Closes the SMTP connection safely."""
        if self._server:
            try:
                self._server.quit()
            except Exception:
                try:
                    self._server.close()
                except Exception:
                    pass
            finally:
                self._server = None

    def send_email(self, from_addr: str, to_addrs: List[str], message_as_string: str):
        """
        Sends an email. Automatically reconnects if connection has been closed.
        
        Args:
            from_addr: Sender's email address.
            to_addrs: List of recipient email addresses.
            message_as_string: Full raw MIME message as string.
            
        Raises:
            SMTPInvalidRecipientError: If server refuses recipient addresses.
            SMTPClientError: For general SMTP send failures.
        """
        if not self.is_connected():
            self.connect()

        try:
            refused = self._server.sendmail(from_addr, to_addrs, message_as_string)
            if refused:
                raise SMTPInvalidRecipientError(f"SMTP server refused recipients: {refused}")
        except smtplib.SMTPRecipientsRefused as e:
            raise SMTPInvalidRecipientError(f"Recipients refused by SMTP server: {str(e)}") from e
        except (smtplib.SMTPServerDisconnected, socket.error) as e:
            # Reconnect once and retry
            log_smtp_error(f"SMTP server disconnected. Reconnecting... Detail: {str(e)}")
            self.connect()
            try:
                refused = self._server.sendmail(from_addr, to_addrs, message_as_string)
                if refused:
                    raise SMTPInvalidRecipientError(f"SMTP server refused recipients on retry: {refused}")
            except Exception as retry_err:
                raise SMTPClientError(f"Failed to send email after reconnecting: {str(retry_err)}") from retry_err
        except Exception as e:
            raise SMTPClientError(f"Failed to send email: {str(e)}") from e

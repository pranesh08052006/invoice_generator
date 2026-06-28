import logging
import sys

# Setup standard formatting
formatter = logging.Formatter(
    '[%(asctime)s] [%(levelname)s] [EMAIL_SERVICE]: %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S'
)

# Create console handler
console_handler = logging.StreamHandler(sys.stdout)
console_handler.setFormatter(formatter)

# Configure logger
logger = logging.getLogger("email_service")
logger.setLevel(logging.INFO)
logger.addHandler(console_handler)

def log_email_sent(recipient: str, subject: str):
    """Logs successful email sending without sensitive info."""
    logger.info(f"Email sent successfully. Recipient: {recipient} | Subject: {subject}")

def log_email_failed(recipient: str, subject: str, error_message: str):
    """Logs email sending failure."""
    logger.error(f"Email delivery failed. Recipient: {recipient} | Subject: {subject} | Error: {error_message}")

def log_smtp_error(error_message: str):
    """Logs generic SMTP error."""
    logger.error(f"SMTP Server Error occurred: {error_message}")

def log_connection_timeout():
    """Logs SMTP connection timeout."""
    logger.error("SMTP Connection timed out.")

def log_authentication_failure():
    """Logs authentication failure (ensuring password/username is not printed)."""
    logger.error("SMTP Authentication failed. Please check your SMTP credentials.")

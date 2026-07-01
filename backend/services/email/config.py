import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

class EmailConfigError(Exception):
    """Exception raised when SMTP configuration is invalid or missing."""
    pass

# Load configuration variables
SMTP_HOST = os.getenv("SMTP_HOST")
SMTP_PORT = os.getenv("SMTP_PORT")
SMTP_EMAIL = os.getenv("SMTP_EMAIL", "noreply@digitalviyabari.com")
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD")
SMTP_FROM_NAME = os.getenv("SMTP_FROM_NAME", "Invoice Digital Viyabari")
SMTP_USE_SSL = os.getenv("SMTP_USE_SSL", "true").lower() in ("true", "1", "yes")
SMTP_TIMEOUT = int(os.getenv("SMTP_TIMEOUT", "30"))

def validate_config():
    """
    Validates that all required SMTP settings are present and valid.
    Raises:
        EmailConfigError: If any required setting is missing or invalid.
    """
    missing_keys = []
    if not SMTP_HOST:
        missing_keys.append("SMTP_HOST")
    if not SMTP_EMAIL:
        missing_keys.append("SMTP_EMAIL")
    if not SMTP_PASSWORD:
        missing_keys.append("SMTP_PASSWORD")
    
    if not SMTP_PORT:
        missing_keys.append("SMTP_PORT")
    else:
        try:
            int(SMTP_PORT)
        except ValueError:
            raise EmailConfigError("SMTP_PORT must be an integer.")
            
    if missing_keys:
        raise EmailConfigError(
            f"Required email configuration keys are missing: {', '.join(missing_keys)}"
        )

import secrets
import hashlib
import logging
import sys
from datetime import datetime, timedelta, timezone
from typing import Optional, Dict, Any

from models import PasswordResetToken

# Setup OTP-specific logger
formatter = logging.Formatter(
    '[%(asctime)s] [%(levelname)s] [OTP_SERVICE]: %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S'
)
console_handler = logging.StreamHandler(sys.stdout)
console_handler.setFormatter(formatter)

logger = logging.getLogger("otp_service")
logger.setLevel(logging.INFO)
logger.addHandler(console_handler)


class OTPError(Exception):
    """Base exception for OTP service errors."""
    pass

class OTPRateLimitError(OTPError):
    """Exception raised when OTP request rate limit is exceeded."""
    pass


class OTPService:
    """
    Reusable, secure OTP Engine.
    Handles OTP generation, hashing, database storage, verification, and rate limiting.
    """

    @staticmethod
    def hash_otp(otp: str) -> str:
        """Hashes plain OTP using SHA-256."""
        return hashlib.sha256(otp.encode("utf-8")).hexdigest()

    async def generate_otp(
        self,
        email: str,
        purpose: str = "PASSWORD_RESET",
        request_ip: Optional[str] = None,
        request_user_agent: Optional[str] = None,
        expires_in_minutes: int = 10
    ) -> str:
        """
        Generates a cryptographically secure 6-digit OTP, checks rate limits,
        invalidates previous OTPs, hashes the new OTP, and stores it in the database.
        
        Args:
            email: Recipient email address.
            purpose: Reason for generating the OTP (e.g. 'PASSWORD_RESET').
            request_ip: Client's IP address.
            request_user_agent: Client's User-Agent string.
            expires_in_minutes: Minutes until the OTP expires.
            
        Returns:
            The raw 6-digit OTP as string.
            
        Raises:
            OTPRateLimitError: If email or IP rate limit is exceeded (max 3 requests in 15 mins).
        """
        now = datetime.now(timezone.utc).replace(tzinfo=None)
        rate_limit_cutoff = now - timedelta(minutes=15)

        # 1. Rate Limit Checks (Max 3 OTP requests in 15 minutes)
        # Check by email
        email_count = await PasswordResetToken.find(
            PasswordResetToken.email == email,
            PasswordResetToken.purpose == purpose,
            PasswordResetToken.created_at >= rate_limit_cutoff
        ).count()
        if email_count >= 3:
            logger.warning(f"Rate limit triggered for email: {email}")
            raise OTPRateLimitError("Too many OTP requests. Please try again after 15 minutes.")

        # Check by IP
        if request_ip:
            ip_count = await PasswordResetToken.find(
                PasswordResetToken.request_ip == request_ip,
                PasswordResetToken.purpose == purpose,
                PasswordResetToken.created_at >= rate_limit_cutoff
            ).count()
            if ip_count >= 3:
                logger.warning(f"Rate limit triggered for IP: {request_ip}")
                raise OTPRateLimitError("Too many OTP requests from this IP. Please try again after 15 minutes.")

        # 2. Invalidate previous active OTPs for the same email and purpose
        active_tokens = await PasswordResetToken.find(
            PasswordResetToken.email == email,
            PasswordResetToken.purpose == purpose,
            PasswordResetToken.used == False,
            PasswordResetToken.expires_at > now
        ).to_list()
        
        if active_tokens:
            for token in active_tokens:
                token.used = True
                token.used_at = now
                await token.save()
            logger.info(f"OTP invalidated: Invalidated {len(active_tokens)} previous tokens for email: {email}")

        # 3. Generate secure 6-digit OTP
        digits = "0123456789"
        raw_otp = "".join(secrets.choice(digits) for _ in range(6))
        
        # 4. Hash OTP and store
        otp_hash = self.hash_otp(raw_otp)
        expires_at = now + timedelta(minutes=expires_in_minutes)

        db_token = PasswordResetToken(
            email=email,
            otp_hash=otp_hash,
            purpose=purpose,
            expires_at=expires_at,
            request_ip=request_ip,
            request_user_agent=request_user_agent
        )
        await db_token.insert()

        logger.info(f"OTP Generated for email: {email}")
        return raw_otp

    async def verify_otp(
        self,
        email: str,
        otp: str,
        purpose: str = "PASSWORD_RESET",
        mark_used: bool = True
    ) -> Dict[str, Any]:
        """
        Verifies an OTP against the database record, checking expiry, used status,
        and maximum verification attempts (max 5 attempts).
        
        Args:
            email: Target email address.
            otp: Plain-text 6-digit OTP to verify.
            purpose: Expected OTP purpose.
            mark_used: Whether to mark the OTP as used upon successful verification.
            
        Returns:
            Dict containing 'success', 'verified' and/or 'message'.
        """
        now = datetime.now(timezone.utc).replace(tzinfo=None)

        # Find the latest generated token for this email and purpose
        token = await PasswordResetToken.find(
            PasswordResetToken.email == email,
            PasswordResetToken.purpose == purpose
        ).sort(-PasswordResetToken.created_at).first_or_none()

        if not token:
            logger.error(f"OTP Failed: No token found for email: {email}")
            return {"success": False, "message": "Invalid email or OTP."}

        # Check if already used
        if token.used:
            if token.attempt_count >= 5:
                logger.error(f"OTP Failed: Max attempts exceeded for email: {email}")
                return {"success": False, "message": "OTP has been locked due to too many failed attempts. Please request a new OTP."}
            logger.error(f"OTP Failed: Already used for email: {email}")
            return {"success": False, "message": "OTP has already been used."}

        # Check if expired
        if now > token.expires_at:
            logger.warning(f"OTP Expired for email: {email}")
            return {"success": False, "message": "OTP has expired."}

        # Check attempt count limit
        if token.attempt_count >= 5:
            # OTP already invalidated in database
            logger.error(f"OTP Failed: Max attempts exceeded for email: {email}")
            return {"success": False, "message": "OTP has been locked due to too many failed attempts. Please request a new OTP."}

        # Increment verification attempts
        token.attempt_count += 1
        incoming_hash = self.hash_otp(otp)

        if token.otp_hash == incoming_hash:
            # Successful verification
            if mark_used:
                token.used = True
                token.used_at = now
            await token.save()
            
            logger.info(f"OTP Verified successfully for email: {email}")
            return {"success": True, "verified": True}
        else:
            # Failed verification attempt
            if token.attempt_count >= 5:
                # Exceeded limit on this attempt: Invalidate OTP
                token.used = True
                token.used_at = now
                await token.save()
                logger.warning(f"OTP Invalidated: Exceeded max attempts (5) for email: {email}")
                return {"success": False, "message": "Invalid OTP. Too many failed attempts. This OTP has been invalidated."}
            
            await token.save()
            logger.error(f"OTP Failed: Incorrect OTP value for email: {email}. Attempt {token.attempt_count}/5")
            return {"success": False, "message": f"Invalid OTP. Attempt {token.attempt_count}/5."}

    async def cleanup_otps(self, retention_days: int = 7) -> Dict[str, Any]:
        """
        Deletes all expired tokens and used tokens older than retention period from the database.
        
        Args:
            retention_days: Number of days to retain used tokens.
            
        Returns:
            Dict containing status and count of deleted documents.
        """
        now = datetime.now(timezone.utc).replace(tzinfo=None)
        # Deleted expired
        expired_query = PasswordResetToken.find(PasswordResetToken.expires_at < now)
        expired_count = await expired_query.count()
        await expired_query.delete()

        # Delete used tokens older than retention cutoff
        retention_cutoff = now - timedelta(days=retention_days)
        used_query = PasswordResetToken.find(
            PasswordResetToken.used == True,
            PasswordResetToken.created_at < retention_cutoff
        )
        used_count = await used_query.count()
        await used_query.delete()

        logger.info(f"OTP Cleanup completed. Deleted {expired_count} expired and {used_count} retained tokens.")
        return {
            "success": True,
            "deleted_expired": expired_count,
            "deleted_used": used_count
        }


# Global shared instance of OTPService
otp_service = OTPService()


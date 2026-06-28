import asyncio
import logging
from datetime import datetime, timezone
from typing import Dict, Any, Optional, List
from beanie import PydanticObjectId

from models import EmailLog, EmailAudit
from services.email.email_service import email_service

logger = logging.getLogger("email_service")


class EmailTask:
    def __init__(
        self,
        log_id: PydanticObjectId,
        audit_id: PydanticObjectId,
        recipient: str,
        subject: str,
        template_name: str,
        context: Dict[str, Any],
        triggered_by: str,
        attachments: Optional[List[Dict[str, Any]]] = None
    ):
        self.log_id = log_id
        self.audit_id = audit_id
        self.recipient = recipient
        self.subject = subject
        self.template_name = template_name
        self.context = context or {}
        self.triggered_by = triggered_by
        self.attachments = attachments or []


class BaseEmailQueue:
    async def enqueue(
        self,
        recipient: str,
        subject: str,
        template_name: str,
        context: Dict[str, Any],
        triggered_by: str = "system",
        attachments: Optional[List[Dict[str, Any]]] = None
    ) -> str:
        raise NotImplementedError()


class AsyncioEmailQueue(BaseEmailQueue):
    def __init__(self):
        self._queue = asyncio.Queue()
        self._worker_task = None

    async def enqueue(
        self,
        recipient: str,
        subject: str,
        template_name: str,
        context: Dict[str, Any],
        triggered_by: str = "system",
        attachments: Optional[List[Dict[str, Any]]] = None
    ) -> str:
        # Create EmailLog
        log = EmailLog(
            recipient=recipient,
            subject=subject,
            template_name=template_name,
            status="Queued",
            retry_count=0
        )
        await log.insert()

        # Create EmailAudit
        audit = EmailAudit(
            triggered_by=triggered_by,
            recipient=recipient,
            email_type=template_name,
            status="Queued"
        )
        await audit.insert()

        task = EmailTask(
            log_id=log.id,
            audit_id=audit.id,
            recipient=recipient,
            subject=subject,
            template_name=template_name,
            context=context,
            triggered_by=triggered_by,
            attachments=attachments
        )
        await self._queue.put(task)
        return str(log.id)

    def start_worker(self):
        if self._worker_task is None or self._worker_task.done():
            self._worker_task = asyncio.create_task(self._worker_loop())
            logger.info("Email queue background worker started.")

    async def stop_worker(self):
        if self._worker_task:
            self._worker_task.cancel()
            try:
                await self._worker_task
            except asyncio.CancelledError:
                pass
            logger.info("Email queue background worker stopped.")

    async def _worker_loop(self):
        while True:
            try:
                task: EmailTask = await self._queue.get()
                await self._process_task(task)
                self._queue.task_done()
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Error in email worker loop: {str(e)}")
                await asyncio.sleep(1)

    async def _process_task(self, task: EmailTask):
        log = await EmailLog.get(task.log_id)
        audit = await EmailAudit.get(task.audit_id)
        if not log or not audit:
            return

        attempt = log.retry_count + 1
        
        # Execute the send operation. Since send_html/text_email is called with sync=True, 
        # it performs the actual sending synchronously in the worker thread.
        # pass max_retries=1 to prevent email_service internal retry from interfering with queue retries.
        if task.template_name == "plain_text":
            res = await email_service.send_plain_text_email(
                recipient=task.recipient,
                subject=task.subject,
                text_content=task.context.get("text_content", ""),
                attachments=task.attachments,
                sync=True,
                max_retries=1,
                triggered_by=task.triggered_by
            )
        else:
            res = await email_service.send_html_email(
                recipient=task.recipient,
                subject=task.subject,
                template_name=task.template_name,
                context=task.context,
                attachments=task.attachments,
                sync=True,
                max_retries=1,
                triggered_by=task.triggered_by
            )

        if res.get("status") == "success":
            log.status = "Sent"
            log.sent_time = datetime.utcnow()
            await log.save()

            audit.status = "Sent"
            audit.timestamp = datetime.utcnow()
            await audit.save()
            logger.info(f"Email sent successfully to {task.recipient} on attempt {attempt}")
        else:
            error_code = res.get("error_code")
            error_msg = res.get("message", "Unknown error")
            
            # Non-retryable errors
            non_retryable = ["AUTHENTICATION_ERROR", "INVALID_RECIPIENT", "TEMPLATE_ERROR", "CONFIGURATION_ERROR"]
            
            if error_code in non_retryable or attempt >= 3:
                # Mark as failed
                log.status = "Failed"
                log.error_message = error_msg
                await log.save()

                audit.status = "Failed"
                await audit.save()
                logger.error(f"Email delivery failed to {task.recipient}. Code: {error_code}, Error: {error_msg}")
            else:
                # Retryable error (SMTPTimeoutError, ConnectionError, etc.)
                log.retry_count = attempt
                log.error_message = f"Attempt {attempt} failed: {error_msg}"
                await log.save()

                # Re-queue after wait (exponential backoff: 2s, 4s)
                wait_time = 2 ** attempt
                logger.warning(f"Email to {task.recipient} failed (attempt {attempt}). Retrying in {wait_time}s. Error: {error_msg}")
                await asyncio.sleep(wait_time)
                await self._queue.put(task)


# Global shared instance of EmailQueue
email_queue = AsyncioEmailQueue()

"""
Email Receive MCP Service (IMAP)
Provides tools for receiving and reading emails via IMAP protocol.
Supports listing inbox, reading email content, and downloading attachments.
"""

import base64
import email
import imaplib
import logging
from datetime import datetime
from email.header import decode_header
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)


def decode_email_header(header_value: str) -> str:
    """Decode email header that may be encoded."""
    if not header_value:
        return ""

    decoded_parts = []
    for part, charset in decode_header(header_value):
        if isinstance(part, bytes):
            try:
                decoded_parts.append(part.decode(charset or "utf-8", errors="replace"))
            except Exception:
                decoded_parts.append(part.decode("utf-8", errors="replace"))
        else:
            decoded_parts.append(part)

    return "".join(decoded_parts)


def parse_email_date(date_str: str) -> Optional[str]:
    """Parse email date string to ISO format."""
    if not date_str:
        return None

    # Common email date formats
    formats = [
        "%a, %d %b %Y %H:%M:%S %z",
        "%a, %d %b %Y %H:%M:%S %Z",
        "%d %b %Y %H:%M:%S %z",
        "%d %b %Y %H:%M:%S %Z",
    ]

    # Remove extra whitespace and parenthetical timezone names
    date_str = date_str.strip()
    if "(" in date_str:
        date_str = date_str[:date_str.index("(")].strip()

    for fmt in formats:
        try:
            dt = datetime.strptime(date_str, fmt)
            return dt.isoformat()
        except ValueError:
            continue

    return date_str  # Return original if parsing fails


class EmailReceiveService:
    """Service for receiving emails via IMAP."""

    async def test_connection(self, config: Dict[str, Any]) -> Dict[str, Any]:
        """Test IMAP connection."""
        logger.info(f"[EmailReceive] test_connection called with config keys: {list(config.keys())}")
        logger.info(f"[EmailReceive] config: {config}")

        imap_host = config.get("imapHost")
        imap_port = config.get("imapPort", 993)
        username = config.get("username")
        password = config.get("password")
        use_ssl = config.get("useSSL", True)

        logger.info(f"[EmailReceive] parsed: host={imap_host}, port={imap_port}, user={username}, ssl={use_ssl}")

        # 检查必填字段并提供明确的错误信息
        missing = []
        if not imap_host:
            missing.append("IMAP 主机")
        if not username:
            missing.append("邮箱账号")
        if not password:
            missing.append("授权码")
        if missing:
            return {"success": False, "error": f"请填写: {', '.join(missing)}"}

        try:
            if use_ssl:
                conn = imaplib.IMAP4_SSL(imap_host, imap_port, timeout=10)
            else:
                conn = imaplib.IMAP4(imap_host, imap_port, timeout=10)

            conn.login(username, password)

            # Get mailbox status
            status, data = conn.select("INBOX", readonly=True)
            if status == "OK":
                message_count = int(data[0])
            else:
                message_count = 0

            conn.logout()

            return {
                "success": True,
                "message": f"Connected to {imap_host}:{imap_port}",
                "details": {
                    "inbox_count": message_count
                }
            }
        except imaplib.IMAP4.error as e:
            return {"success": False, "error": f"IMAP authentication failed: {str(e)}"}
        except Exception as e:
            return {"success": False, "error": f"Connection failed: {str(e)}"}

    async def execute_tool(
        self, tool_name: str, params: Dict[str, Any], config: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Execute an email receive tool."""
        tool_handlers = {
            "email_list_inbox": self._list_inbox,
            "email_receive": self._receive_email,
            "email_download_attachment": self._download_attachment,
        }

        handler = tool_handlers.get(tool_name)
        if not handler:
            return {"success": False, "error": f"Unknown tool: {tool_name}"}

        return await handler(params, config)

    def _send_imap_id(self, conn: imaplib.IMAP4) -> None:
        """
        发送 IMAP ID 命令（RFC 2971）
        163 邮箱要求此命令，否则报 "Unsafe Login" 错误
        """
        try:
            # 构造 ID 命令参数
            args = '("name" "poc-demo" "version" "1.0" "vendor" "LLM-Security-Demo")'
            # 使用 imaplib 的内部方法发送命令
            tag = conn._new_tag()
            cmd = f'{tag.decode()} ID {args}\r\n'
            conn.send(cmd.encode())
            # 读取响应
            response = conn.readline()
            logger.info(f"[IMAP] ID command response: {response}")
            # 读取 tagged 响应
            while not response.startswith(tag):
                response = conn.readline()
                logger.info(f"[IMAP] ID response line: {response}")
            logger.info(f"[IMAP] ID command completed")
        except Exception as e:
            logger.warning(f"[IMAP] ID command failed: {e}")

    def _connect_imap(self, config: Dict[str, Any]) -> imaplib.IMAP4:
        """Create and authenticate IMAP connection."""
        imap_host = config.get("imapHost")
        imap_port = config.get("imapPort", 993)
        username = config.get("username")
        password = config.get("password")
        use_ssl = config.get("useSSL", True)

        logger.info(f"[IMAP] Connecting to {imap_host}:{imap_port}, SSL={use_ssl}")

        if use_ssl:
            conn = imaplib.IMAP4_SSL(imap_host, imap_port, timeout=30)
        else:
            conn = imaplib.IMAP4(imap_host, imap_port, timeout=30)

        logger.info(f"[IMAP] Connection established, state={conn.state}")
        login_status, login_data = conn.login(username, password)
        logger.info(f"[IMAP] Login status={login_status}, state={conn.state}")

        # 163 邮箱要求发送 IMAP ID 命令，否则报 "Unsafe Login" 错误
        # 参考 RFC 2971: https://tools.ietf.org/html/rfc2971
        self._send_imap_id(conn)

        return conn

    async def _list_inbox(
        self, params: Dict[str, Any], config: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        List emails in inbox.

        Args:
            params:
                limit: Maximum number of emails to return (default: 20)
                unread_only: Only return unread emails (default: False)
                search: Search criteria (e.g., "FROM sender@example.com")
            config: IMAP configuration
        """
        limit = params.get("limit", 20)
        unread_only = params.get("unread_only", False)
        search = params.get("search")

        try:
            conn = self._connect_imap(config)
            logger.info(f"[IMAP] Before select, state={conn.state}")
            status, data = conn.select("INBOX", readonly=True)
            logger.info(f"[IMAP] After select, status={status}, state={conn.state}, data={data}")
            if status != "OK":
                conn.logout()
                return {"success": False, "error": f"Failed to select INBOX: {data}"}

            # Verify we're in SELECTED state
            if conn.state != "SELECTED":
                conn.logout()
                return {"success": False, "error": f"IMAP state error: expected SELECTED, got {conn.state}"}

            # Build search criteria
            if search:
                search_criteria = search
            elif unread_only:
                search_criteria = "UNSEEN"
            else:
                search_criteria = "ALL"

            logger.info(f"[IMAP] Searching with criteria: {search_criteria}")
            status, message_ids = conn.search(None, search_criteria)
            logger.info(f"[IMAP] Search result: status={status}, ids count={len(message_ids[0].split()) if message_ids[0] else 0}")
            if status != "OK":
                conn.logout()
                return {"success": False, "error": "Failed to search inbox"}

            # Get message IDs (most recent first)
            ids = message_ids[0].split()
            ids = ids[-limit:] if len(ids) > limit else ids
            ids = list(reversed(ids))  # Most recent first

            emails = []
            for msg_id in ids:
                # Fetch header only for listing
                status, data = conn.fetch(msg_id, "(FLAGS BODY.PEEK[HEADER.FIELDS (FROM TO SUBJECT DATE)])")
                if status != "OK":
                    continue

                # Parse header
                raw_header = data[0][1]
                msg = email.message_from_bytes(raw_header)

                # Get flags
                flags_str = data[0][0].decode("utf-8")
                is_read = "\\Seen" in flags_str
                has_attachments = False  # Can't determine from header alone

                emails.append({
                    "id": msg_id.decode("utf-8"),
                    "from": decode_email_header(msg.get("From", "")),
                    "to": decode_email_header(msg.get("To", "")),
                    "subject": decode_email_header(msg.get("Subject", "(no subject)")),
                    "date": parse_email_date(msg.get("Date", "")),
                    "is_read": is_read,
                })

            conn.logout()

            return {
                "success": True,
                "result": {
                    "emails": emails,
                    "count": len(emails),
                    "total_in_inbox": len(message_ids[0].split()) if message_ids[0] else 0
                }
            }

        except imaplib.IMAP4.error as e:
            return {"success": False, "error": f"IMAP error: {str(e)}"}
        except Exception as e:
            return {"success": False, "error": f"Failed to list inbox: {str(e)}"}

    async def _receive_email(
        self, params: Dict[str, Any], config: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Read full email content and attachment list.

        Args:
            params:
                id: Email ID (from list_inbox)
                mark_read: Mark email as read (default: False)
            config: IMAP configuration
        """
        email_id = params.get("id")
        mark_read = params.get("mark_read", False)

        if not email_id:
            return {"success": False, "error": "Missing 'id' parameter"}

        try:
            conn = self._connect_imap(config)
            conn.select("INBOX", readonly=not mark_read)

            # Fetch full email
            status, data = conn.fetch(email_id.encode(), "(RFC822)")
            if status != "OK":
                conn.logout()
                return {"success": False, "error": f"Email not found: {email_id}"}

            raw_email = data[0][1]
            msg = email.message_from_bytes(raw_email)

            # Extract body and attachments
            body_text = ""
            body_html = ""
            attachments = []

            if msg.is_multipart():
                for part in msg.walk():
                    content_type = part.get_content_type()
                    content_disposition = str(part.get("Content-Disposition", ""))

                    # Check for attachment
                    if "attachment" in content_disposition or part.get_filename():
                        filename = part.get_filename()
                        if filename:
                            filename = decode_email_header(filename)
                            attachments.append({
                                "filename": filename,
                                "content_type": content_type,
                                "size": len(part.get_payload(decode=True) or b"")
                            })
                    elif content_type == "text/plain" and not body_text:
                        payload = part.get_payload(decode=True)
                        charset = part.get_content_charset() or "utf-8"
                        body_text = payload.decode(charset, errors="replace")
                    elif content_type == "text/html" and not body_html:
                        payload = part.get_payload(decode=True)
                        charset = part.get_content_charset() or "utf-8"
                        body_html = payload.decode(charset, errors="replace")
            else:
                # Single part email
                content_type = msg.get_content_type()
                payload = msg.get_payload(decode=True)
                charset = msg.get_content_charset() or "utf-8"
                if content_type == "text/plain":
                    body_text = payload.decode(charset, errors="replace")
                elif content_type == "text/html":
                    body_html = payload.decode(charset, errors="replace")

            conn.logout()

            return {
                "success": True,
                "result": {
                    "id": email_id,
                    "from": decode_email_header(msg.get("From", "")),
                    "to": decode_email_header(msg.get("To", "")),
                    "cc": decode_email_header(msg.get("Cc", "")),
                    "subject": decode_email_header(msg.get("Subject", "(no subject)")),
                    "date": parse_email_date(msg.get("Date", "")),
                    "body_text": body_text,
                    "body_html": body_html[:5000] if body_html else "",  # Limit HTML size
                    "attachments": attachments,
                    "has_attachments": len(attachments) > 0
                }
            }

        except imaplib.IMAP4.error as e:
            return {"success": False, "error": f"IMAP error: {str(e)}"}
        except Exception as e:
            return {"success": False, "error": f"Failed to read email: {str(e)}"}

    async def _download_attachment(
        self, params: Dict[str, Any], config: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Download email attachment as base64.

        Args:
            params:
                id: Email ID
                filename: Attachment filename to download
            config: IMAP configuration

        Returns:
            Attachment content as base64 encoded string
        """
        email_id = params.get("id")
        target_filename = params.get("filename")

        if not email_id:
            return {"success": False, "error": "Missing 'id' parameter"}
        if not target_filename:
            return {"success": False, "error": "Missing 'filename' parameter"}

        try:
            conn = self._connect_imap(config)
            conn.select("INBOX", readonly=True)

            # Fetch full email
            status, data = conn.fetch(email_id.encode(), "(RFC822)")
            if status != "OK":
                conn.logout()
                return {"success": False, "error": f"Email not found: {email_id}"}

            raw_email = data[0][1]
            msg = email.message_from_bytes(raw_email)

            # Find and extract attachment
            attachment_data = None
            content_type = None

            if msg.is_multipart():
                for part in msg.walk():
                    filename = part.get_filename()
                    if filename:
                        filename = decode_email_header(filename)
                        if filename == target_filename:
                            attachment_data = part.get_payload(decode=True)
                            content_type = part.get_content_type()
                            break

            conn.logout()

            if attachment_data is None:
                return {"success": False, "error": f"Attachment not found: {target_filename}"}

            # Return as base64
            content_base64 = base64.b64encode(attachment_data).decode("ascii")

            return {
                "success": True,
                "result": {
                    "filename": target_filename,
                    "content_type": content_type,
                    "size": len(attachment_data),
                    "content_base64": content_base64
                }
            }

        except imaplib.IMAP4.error as e:
            return {"success": False, "error": f"IMAP error: {str(e)}"}
        except Exception as e:
            return {"success": False, "error": f"Failed to download attachment: {str(e)}"}


# Global service instance
email_receive_service = EmailReceiveService()

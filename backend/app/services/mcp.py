"""
MCP (Model Context Protocol) Server Service
Handles execution of MCP tools: filesystem, email, payment
"""

import os
import smtplib
import time
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from email.mime.base import MIMEBase
from email import encoders
from pathlib import Path
from typing import Any, Dict, Optional, List
import logging

import stripe

logger = logging.getLogger(__name__)


class McpService:
    """Service for executing MCP tools."""

    # ============ Filesystem Tools ============

    async def execute_filesystem_tool(
        self, tool_name: str, params: Dict[str, Any], config: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Execute filesystem tools within configured base path."""
        base_path = config.get("basePath", "/tmp")
        allow_write = config.get("allowWrite", False)

        # Security: resolve and validate path
        base_path = Path(base_path).resolve()
        if not base_path.exists():
            return {"success": False, "error": f"Base path does not exist: {base_path}"}

        if tool_name == "fs_read_file":
            return await self._fs_read_file(base_path, params)
        elif tool_name == "fs_write_file":
            if not allow_write:
                return {"success": False, "error": "Write access not allowed"}
            return await self._fs_write_file(base_path, params)
        elif tool_name == "fs_list_dir":
            return await self._fs_list_dir(base_path, params)
        elif tool_name == "fs_search":
            return await self._fs_search(base_path, params)
        else:
            return {"success": False, "error": f"Unknown filesystem tool: {tool_name}"}

    async def _fs_read_file(
        self, base_path: Path, params: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Read file content."""
        file_path = params.get("path", "")
        if not file_path:
            return {"success": False, "error": "Missing 'path' parameter"}

        full_path = (base_path / file_path).resolve()
        # Security: ensure path is within base_path
        if not str(full_path).startswith(str(base_path)):
            return {"success": False, "error": "Path traversal not allowed"}

        if not full_path.exists():
            return {"success": False, "error": f"File not found: {file_path}"}

        if not full_path.is_file():
            return {"success": False, "error": f"Not a file: {file_path}"}

        try:
            content = full_path.read_text(encoding="utf-8")
            return {"success": True, "result": {"content": content, "path": str(file_path)}}
        except Exception as e:
            return {"success": False, "error": f"Read error: {str(e)}"}

    async def _fs_write_file(
        self, base_path: Path, params: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Write content to file."""
        file_path = params.get("path", "")
        content = params.get("content", "")

        if not file_path:
            return {"success": False, "error": "Missing 'path' parameter"}

        full_path = (base_path / file_path).resolve()
        if not str(full_path).startswith(str(base_path)):
            return {"success": False, "error": "Path traversal not allowed"}

        try:
            full_path.parent.mkdir(parents=True, exist_ok=True)
            full_path.write_text(content, encoding="utf-8")
            return {"success": True, "result": {"path": str(file_path), "bytes_written": len(content)}}
        except Exception as e:
            return {"success": False, "error": f"Write error: {str(e)}"}

    async def _fs_list_dir(
        self, base_path: Path, params: Dict[str, Any]
    ) -> Dict[str, Any]:
        """List directory contents."""
        dir_path = params.get("path", ".")

        full_path = (base_path / dir_path).resolve()
        if not str(full_path).startswith(str(base_path)):
            return {"success": False, "error": "Path traversal not allowed"}

        if not full_path.exists():
            return {"success": False, "error": f"Directory not found: {dir_path}"}

        if not full_path.is_dir():
            return {"success": False, "error": f"Not a directory: {dir_path}"}

        try:
            entries = []
            for entry in full_path.iterdir():
                entries.append({
                    "name": entry.name,
                    "type": "dir" if entry.is_dir() else "file",
                    "size": entry.stat().st_size if entry.is_file() else None,
                })
            return {"success": True, "result": {"path": str(dir_path), "entries": entries}}
        except Exception as e:
            return {"success": False, "error": f"List error: {str(e)}"}

    async def _fs_search(
        self, base_path: Path, params: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Search for files by pattern."""
        pattern = params.get("pattern", "*")
        max_results = params.get("max_results", 100)

        try:
            results = []
            for path in base_path.rglob(pattern):
                if len(results) >= max_results:
                    break
                rel_path = path.relative_to(base_path)
                results.append({
                    "path": str(rel_path),
                    "type": "dir" if path.is_dir() else "file",
                })
            return {"success": True, "result": {"pattern": pattern, "matches": results}}
        except Exception as e:
            return {"success": False, "error": f"Search error: {str(e)}"}

    # ============ Email Tools ============

    async def execute_email_tool(
        self, tool_name: str, params: Dict[str, Any], config: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Execute email tools using SMTP."""
        smtp_host = config.get("smtpHost")
        smtp_port = config.get("smtpPort", 587)
        username = config.get("username")
        password = config.get("password")
        from_address = config.get("fromAddress")

        if not all([smtp_host, username, password, from_address]):
            return {"success": False, "error": "Missing required email configuration"}

        if tool_name == "email_send":
            return await self._email_send(
                smtp_host, smtp_port, username, password, from_address, params
            )
        elif tool_name == "email_send_with_attachment":
            return await self._email_send_with_attachment(
                smtp_host, smtp_port, username, password, from_address, params
            )
        else:
            return {"success": False, "error": f"Unknown email tool: {tool_name}"}

    async def _email_send(
        self,
        smtp_host: str,
        smtp_port: int,
        username: str,
        password: str,
        from_address: str,
        params: Dict[str, Any],
    ) -> Dict[str, Any]:
        """Send a plain text or HTML email."""
        to_address = params.get("to")
        subject = params.get("subject", "")
        body = params.get("body", "")
        html = params.get("html", False)

        if not to_address:
            return {"success": False, "error": "Missing 'to' parameter"}

        try:
            msg = MIMEMultipart("alternative")
            msg["Subject"] = subject
            msg["From"] = from_address
            msg["To"] = to_address

            if html:
                msg.attach(MIMEText(body, "html"))
            else:
                msg.attach(MIMEText(body, "plain"))

            with smtplib.SMTP(smtp_host, smtp_port) as server:
                server.starttls()
                server.login(username, password)
                server.sendmail(from_address, [to_address], msg.as_string())

            return {
                "success": True,
                "result": {"to": to_address, "subject": subject, "sent": True},
            }
        except Exception as e:
            return {"success": False, "error": f"Email send error: {str(e)}"}

    async def _email_send_with_attachment(
        self,
        smtp_host: str,
        smtp_port: int,
        username: str,
        password: str,
        from_address: str,
        params: Dict[str, Any],
    ) -> Dict[str, Any]:
        """Send email with attachment."""
        to_address = params.get("to")
        subject = params.get("subject", "")
        body = params.get("body", "")
        attachment_path = params.get("attachment_path")
        attachment_name = params.get("attachment_name")

        if not to_address:
            return {"success": False, "error": "Missing 'to' parameter"}

        try:
            msg = MIMEMultipart()
            msg["Subject"] = subject
            msg["From"] = from_address
            msg["To"] = to_address
            msg.attach(MIMEText(body, "plain"))

            if attachment_path:
                path = Path(attachment_path)
                if path.exists() and path.is_file():
                    with open(path, "rb") as f:
                        part = MIMEBase("application", "octet-stream")
                        part.set_payload(f.read())
                    encoders.encode_base64(part)
                    part.add_header(
                        "Content-Disposition",
                        f"attachment; filename={attachment_name or path.name}",
                    )
                    msg.attach(part)

            with smtplib.SMTP(smtp_host, smtp_port) as server:
                server.starttls()
                server.login(username, password)
                server.sendmail(from_address, [to_address], msg.as_string())

            return {
                "success": True,
                "result": {
                    "to": to_address,
                    "subject": subject,
                    "attachment": attachment_name or attachment_path,
                    "sent": True,
                },
            }
        except Exception as e:
            return {"success": False, "error": f"Email send error: {str(e)}"}

    # ============ Payment Tools (Stripe) ============

    async def execute_payment_tool(
        self, tool_name: str, params: Dict[str, Any], config: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Execute payment tools via Stripe API."""
        api_key = config.get("apiKey")
        merchant_id = config.get("merchantId")

        if not api_key:
            return {"success": False, "error": "Missing API key configuration"}

        # Set Stripe API key
        stripe.api_key = api_key

        if tool_name == "payment_create_order":
            return await self._payment_create_order(params, merchant_id)
        elif tool_name == "payment_query_status":
            return await self._payment_query_status(params)
        elif tool_name == "payment_refund":
            return await self._payment_refund(params)
        else:
            return {"success": False, "error": f"Unknown payment tool: {tool_name}"}

    async def _payment_create_order(
        self,
        params: Dict[str, Any],
        merchant_id: str,
    ) -> Dict[str, Any]:
        """Create a Stripe PaymentIntent."""
        amount = params.get("amount")  # Amount in smallest currency unit (cents)
        currency = params.get("currency", "usd").lower()
        description = params.get("description", "")
        customer_email = params.get("customer_email")

        if not amount:
            return {"success": False, "error": "Missing 'amount' parameter"}

        try:
            # Create PaymentIntent
            intent_params = {
                "amount": int(amount),  # Stripe requires integer amount in cents
                "currency": currency,
                "description": description or f"Order from {merchant_id}",
                "metadata": {
                    "merchant_id": merchant_id,
                },
            }

            if customer_email:
                intent_params["receipt_email"] = customer_email

            payment_intent = stripe.PaymentIntent.create(**intent_params)

            return {
                "success": True,
                "result": {
                    "payment_intent_id": payment_intent.id,
                    "client_secret": payment_intent.client_secret,
                    "amount": payment_intent.amount,
                    "currency": payment_intent.currency,
                    "status": payment_intent.status,
                    "created": payment_intent.created,
                },
            }
        except stripe.error.AuthenticationError as e:
            return {"success": False, "error": f"Stripe authentication failed: {str(e)}"}
        except stripe.error.InvalidRequestError as e:
            return {"success": False, "error": f"Invalid request: {str(e)}"}
        except stripe.error.StripeError as e:
            return {"success": False, "error": f"Stripe error: {str(e)}"}
        except Exception as e:
            return {"success": False, "error": f"Payment creation failed: {str(e)}"}

    async def _payment_query_status(
        self,
        params: Dict[str, Any],
    ) -> Dict[str, Any]:
        """Query Stripe PaymentIntent status."""
        payment_intent_id = params.get("payment_intent_id") or params.get("order_id")

        if not payment_intent_id:
            return {"success": False, "error": "Missing 'payment_intent_id' parameter"}

        try:
            payment_intent = stripe.PaymentIntent.retrieve(payment_intent_id)

            return {
                "success": True,
                "result": {
                    "payment_intent_id": payment_intent.id,
                    "amount": payment_intent.amount,
                    "currency": payment_intent.currency,
                    "status": payment_intent.status,
                    "created": payment_intent.created,
                    "description": payment_intent.description,
                    "receipt_email": payment_intent.receipt_email,
                    "charges": [
                        {
                            "id": charge.id,
                            "amount": charge.amount,
                            "status": charge.status,
                            "paid": charge.paid,
                            "refunded": charge.refunded,
                        }
                        for charge in payment_intent.charges.data
                    ] if payment_intent.charges else [],
                },
            }
        except stripe.error.InvalidRequestError as e:
            return {"success": False, "error": f"PaymentIntent not found: {str(e)}"}
        except stripe.error.StripeError as e:
            return {"success": False, "error": f"Stripe error: {str(e)}"}
        except Exception as e:
            return {"success": False, "error": f"Query failed: {str(e)}"}

    async def _payment_refund(
        self,
        params: Dict[str, Any],
    ) -> Dict[str, Any]:
        """Initiate a Stripe refund."""
        payment_intent_id = params.get("payment_intent_id") or params.get("order_id")
        amount = params.get("amount")  # Optional: partial refund amount in cents
        reason = params.get("reason", "requested_by_customer")

        if not payment_intent_id:
            return {"success": False, "error": "Missing 'payment_intent_id' parameter"}

        # Map reason to Stripe's allowed values
        stripe_reasons = {
            "duplicate": "duplicate",
            "fraudulent": "fraudulent",
            "requested_by_customer": "requested_by_customer",
        }
        stripe_reason = stripe_reasons.get(reason, "requested_by_customer")

        try:
            refund_params = {
                "payment_intent": payment_intent_id,
                "reason": stripe_reason,
            }

            if amount:
                refund_params["amount"] = int(amount)

            refund = stripe.Refund.create(**refund_params)

            return {
                "success": True,
                "result": {
                    "refund_id": refund.id,
                    "payment_intent_id": refund.payment_intent,
                    "amount": refund.amount,
                    "currency": refund.currency,
                    "status": refund.status,
                    "reason": refund.reason,
                    "created": refund.created,
                },
            }
        except stripe.error.InvalidRequestError as e:
            return {"success": False, "error": f"Refund failed: {str(e)}"}
        except stripe.error.StripeError as e:
            return {"success": False, "error": f"Stripe error: {str(e)}"}
        except Exception as e:
            return {"success": False, "error": f"Refund failed: {str(e)}"}

    # ============ Connection Testing ============

    async def test_filesystem_connection(self, config: Dict[str, Any]) -> Dict[str, Any]:
        """Test filesystem configuration."""
        base_path = config.get("basePath")
        if not base_path:
            return {"success": False, "error": "Missing 'basePath' configuration"}

        path = Path(base_path)
        if not path.exists():
            return {"success": False, "error": f"Path does not exist: {base_path}"}

        if not path.is_dir():
            return {"success": False, "error": f"Path is not a directory: {base_path}"}

        # Test read access
        try:
            list(path.iterdir())
        except PermissionError:
            return {"success": False, "error": "Permission denied to read directory"}

        return {"success": True, "message": f"Connected to {base_path}"}

    async def test_email_connection(self, config: Dict[str, Any]) -> Dict[str, Any]:
        """Test SMTP configuration."""
        smtp_host = config.get("smtpHost")
        smtp_port = config.get("smtpPort", 587)
        username = config.get("username")
        password = config.get("password")

        if not all([smtp_host, username, password]):
            return {"success": False, "error": "Missing required SMTP configuration"}

        try:
            with smtplib.SMTP(smtp_host, smtp_port, timeout=10) as server:
                server.starttls()
                server.login(username, password)
            return {"success": True, "message": f"Connected to {smtp_host}:{smtp_port}"}
        except smtplib.SMTPAuthenticationError:
            return {"success": False, "error": "Authentication failed"}
        except Exception as e:
            return {"success": False, "error": f"Connection failed: {str(e)}"}

    async def test_payment_connection(self, config: Dict[str, Any]) -> Dict[str, Any]:
        """Test Stripe API connection by retrieving account balance."""
        api_key = config.get("apiKey")
        merchant_id = config.get("merchantId")

        if not api_key:
            return {"success": False, "error": "Missing API key"}

        if not merchant_id:
            return {"success": False, "error": "Missing merchant ID"}

        # Validate API key format
        if not api_key.startswith("sk_"):
            return {"success": False, "error": "Invalid API key format (should start with sk_)"}

        try:
            # Set API key and make a test call
            stripe.api_key = api_key

            # Retrieve balance to verify API key is valid
            balance = stripe.Balance.retrieve()

            # Determine if this is test or live mode
            is_test = api_key.startswith("sk_test_")
            mode = "测试模式" if is_test else "生产模式"

            return {
                "success": True,
                "message": f"Stripe 连接成功 ({mode})",
                "details": {
                    "mode": "test" if is_test else "live",
                    "available_balance": [
                        {"amount": b.amount, "currency": b.currency}
                        for b in balance.available
                    ],
                },
            }
        except stripe.error.AuthenticationError as e:
            return {"success": False, "error": f"API Key 无效: {str(e)}"}
        except stripe.error.PermissionError as e:
            return {"success": False, "error": f"权限不足: {str(e)}"}
        except stripe.error.StripeError as e:
            return {"success": False, "error": f"Stripe 错误: {str(e)}"}
        except Exception as e:
            return {"success": False, "error": f"连接测试失败: {str(e)}"}


# Global service instance
mcp_service = McpService()

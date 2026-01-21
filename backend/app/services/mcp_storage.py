"""
Storage MCP Service
Provides tools for cloud storage operations: list buckets, list objects, download URL, upload.
Supports AWS S3 and Alibaba Cloud OSS.
"""

import json
import logging
from typing import Any, Dict, Optional

import httpx

logger = logging.getLogger(__name__)

# Optional dependencies
try:
    import boto3
    from botocore.exceptions import ClientError
    BOTO3_AVAILABLE = True
except ImportError:
    BOTO3_AVAILABLE = False
    boto3 = None
    ClientError = Exception

try:
    import oss2
    OSS2_AVAILABLE = True
except ImportError:
    OSS2_AVAILABLE = False
    oss2 = None


class StorageService:
    """Service for cloud storage operations."""

    async def test_connection(self, config: Dict[str, Any]) -> Dict[str, Any]:
        """Test storage connection."""
        storage_type = config.get("type", "s3")

        if storage_type == "s3":
            return self._test_s3_connection(config)
        elif storage_type == "oss":
            return self._test_oss_connection(config)
        else:
            return {"success": False, "error": f"Unsupported storage type: {storage_type}"}

    def _test_s3_connection(self, config: Dict[str, Any]) -> Dict[str, Any]:
        """Test AWS S3 connection."""
        if not BOTO3_AVAILABLE:
            return {"success": False, "error": "boto3 not installed. Run: pip install boto3"}

        access_key = config.get("accessKeyId")
        secret_key = config.get("secretAccessKey")
        region = config.get("region", "us-east-1")
        endpoint = config.get("endpoint")

        if not all([access_key, secret_key]):
            return {"success": False, "error": "Missing required config: accessKeyId, secretAccessKey"}

        try:
            client_kwargs = {
                "aws_access_key_id": access_key,
                "aws_secret_access_key": secret_key,
                "region_name": region,
            }
            if endpoint:
                client_kwargs["endpoint_url"] = endpoint

            s3 = boto3.client("s3", **client_kwargs)
            # Test by listing buckets
            response = s3.list_buckets()
            bucket_count = len(response.get("Buckets", []))
            return {
                "success": True,
                "message": f"Connected to S3 ({region}), found {bucket_count} buckets",
            }
        except ClientError as e:
            return {"success": False, "error": f"S3 error: {e.response['Error']['Message']}"}
        except Exception as e:
            return {"success": False, "error": f"Connection failed: {str(e)}"}

    def _test_oss_connection(self, config: Dict[str, Any]) -> Dict[str, Any]:
        """Test Alibaba Cloud OSS connection."""
        if not OSS2_AVAILABLE:
            return {"success": False, "error": "oss2 not installed. Run: pip install oss2"}

        access_key = config.get("accessKeyId")
        secret_key = config.get("secretAccessKey")
        endpoint = config.get("endpoint")

        if not all([access_key, secret_key, endpoint]):
            return {"success": False, "error": "Missing required config: accessKeyId, secretAccessKey, endpoint"}

        try:
            auth = oss2.Auth(access_key, secret_key)
            service = oss2.Service(auth, endpoint)
            # Test by listing buckets
            buckets = list(oss2.BucketIterator(service))
            return {
                "success": True,
                "message": f"Connected to OSS ({endpoint}), found {len(buckets)} buckets",
            }
        except Exception as e:
            return {"success": False, "error": f"OSS connection failed: {str(e)}"}

    async def execute_tool(
        self, tool_name: str, params: Dict[str, Any], config: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Execute a storage tool."""
        storage_type = config.get("type", "s3")

        tool_handlers = {
            "storage_list_buckets": self._list_buckets,
            "storage_list_objects": self._list_objects,
            "storage_download_url": self._download_url,
            "storage_upload": self._upload,
        }

        handler = tool_handlers.get(tool_name)
        if not handler:
            return {"success": False, "error": f"Unknown tool: {tool_name}"}

        return await handler(storage_type, params, config)

    async def _list_buckets(
        self, storage_type: str, params: Dict[str, Any], config: Dict[str, Any]
    ) -> Dict[str, Any]:
        """List all buckets."""
        if storage_type == "s3":
            return self._list_buckets_s3(config)
        elif storage_type == "oss":
            return self._list_buckets_oss(config)
        else:
            return {"success": False, "error": f"Unsupported storage type: {storage_type}"}

    def _list_buckets_s3(self, config: Dict[str, Any]) -> Dict[str, Any]:
        """List S3 buckets."""
        if not BOTO3_AVAILABLE:
            return {"success": False, "error": "boto3 not installed"}

        try:
            s3 = self._get_s3_client(config)
            response = s3.list_buckets()
            buckets = [
                {
                    "name": b.get("Name"),
                    "creation_date": b.get("CreationDate").isoformat() if b.get("CreationDate") else None,
                }
                for b in response.get("Buckets", [])
            ]
            return {"success": True, "result": {"buckets": buckets, "count": len(buckets)}}
        except Exception as e:
            return {"success": False, "error": f"List buckets failed: {str(e)}"}

    def _list_buckets_oss(self, config: Dict[str, Any]) -> Dict[str, Any]:
        """List OSS buckets."""
        if not OSS2_AVAILABLE:
            return {"success": False, "error": "oss2 not installed"}

        try:
            auth = oss2.Auth(config.get("accessKeyId"), config.get("secretAccessKey"))
            service = oss2.Service(auth, config.get("endpoint"))
            buckets = [
                {"name": b.name, "creation_date": b.creation_date}
                for b in oss2.BucketIterator(service)
            ]
            return {"success": True, "result": {"buckets": buckets, "count": len(buckets)}}
        except Exception as e:
            return {"success": False, "error": f"List buckets failed: {str(e)}"}

    def _get_s3_client(self, config: Dict[str, Any]):
        """Get S3 client."""
        client_kwargs = {
            "aws_access_key_id": config.get("accessKeyId"),
            "aws_secret_access_key": config.get("secretAccessKey"),
            "region_name": config.get("region", "us-east-1"),
        }
        if config.get("endpoint"):
            client_kwargs["endpoint_url"] = config.get("endpoint")
        return boto3.client("s3", **client_kwargs)

    async def _list_objects(
        self, storage_type: str, params: Dict[str, Any], config: Dict[str, Any]
    ) -> Dict[str, Any]:
        """List objects in a bucket."""
        bucket = params.get("bucket")
        prefix = params.get("prefix", "")
        max_keys = params.get("max_keys", 100)

        if not bucket:
            return {"success": False, "error": "Missing 'bucket' parameter"}

        if storage_type == "s3":
            return self._list_objects_s3(config, bucket, prefix, max_keys)
        elif storage_type == "oss":
            return self._list_objects_oss(config, bucket, prefix, max_keys)
        else:
            return {"success": False, "error": f"Unsupported storage type: {storage_type}"}

    def _list_objects_s3(
        self, config: Dict[str, Any], bucket: str, prefix: str, max_keys: int
    ) -> Dict[str, Any]:
        """List S3 objects."""
        if not BOTO3_AVAILABLE:
            return {"success": False, "error": "boto3 not installed"}

        try:
            s3 = self._get_s3_client(config)
            response = s3.list_objects_v2(
                Bucket=bucket, Prefix=prefix, MaxKeys=min(max_keys, 1000)
            )
            objects = [
                {
                    "key": obj.get("Key"),
                    "size": obj.get("Size"),
                    "last_modified": obj.get("LastModified").isoformat() if obj.get("LastModified") else None,
                    "storage_class": obj.get("StorageClass"),
                }
                for obj in response.get("Contents", [])
            ]
            return {
                "success": True,
                "result": {
                    "bucket": bucket,
                    "prefix": prefix,
                    "objects": objects,
                    "count": len(objects),
                    "is_truncated": response.get("IsTruncated", False),
                },
            }
        except Exception as e:
            return {"success": False, "error": f"List objects failed: {str(e)}"}

    def _list_objects_oss(
        self, config: Dict[str, Any], bucket: str, prefix: str, max_keys: int
    ) -> Dict[str, Any]:
        """List OSS objects."""
        if not OSS2_AVAILABLE:
            return {"success": False, "error": "oss2 not installed"}

        try:
            auth = oss2.Auth(config.get("accessKeyId"), config.get("secretAccessKey"))
            bucket_obj = oss2.Bucket(auth, config.get("endpoint"), bucket)
            objects = []
            for obj in oss2.ObjectIterator(bucket_obj, prefix=prefix, max_keys=max_keys):
                objects.append({
                    "key": obj.key,
                    "size": obj.size,
                    "last_modified": obj.last_modified,
                    "storage_class": obj.storage_class,
                })
            return {
                "success": True,
                "result": {"bucket": bucket, "prefix": prefix, "objects": objects, "count": len(objects)},
            }
        except Exception as e:
            return {"success": False, "error": f"List objects failed: {str(e)}"}

    async def _download_url(
        self, storage_type: str, params: Dict[str, Any], config: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Generate a presigned download URL."""
        bucket = params.get("bucket")
        key = params.get("key")
        expires_in = params.get("expires_in", 3600)

        if not bucket or not key:
            return {"success": False, "error": "Missing 'bucket' or 'key' parameter"}

        if storage_type == "s3":
            return self._download_url_s3(config, bucket, key, expires_in)
        elif storage_type == "oss":
            return self._download_url_oss(config, bucket, key, expires_in)
        else:
            return {"success": False, "error": f"Unsupported storage type: {storage_type}"}

    def _download_url_s3(
        self, config: Dict[str, Any], bucket: str, key: str, expires_in: int
    ) -> Dict[str, Any]:
        """Generate S3 presigned URL."""
        if not BOTO3_AVAILABLE:
            return {"success": False, "error": "boto3 not installed"}

        try:
            s3 = self._get_s3_client(config)
            url = s3.generate_presigned_url(
                "get_object",
                Params={"Bucket": bucket, "Key": key},
                ExpiresIn=expires_in,
            )
            return {
                "success": True,
                "result": {"bucket": bucket, "key": key, "url": url, "expires_in": expires_in},
            }
        except Exception as e:
            return {"success": False, "error": f"Generate URL failed: {str(e)}"}

    def _download_url_oss(
        self, config: Dict[str, Any], bucket: str, key: str, expires_in: int
    ) -> Dict[str, Any]:
        """Generate OSS presigned URL."""
        if not OSS2_AVAILABLE:
            return {"success": False, "error": "oss2 not installed"}

        try:
            auth = oss2.Auth(config.get("accessKeyId"), config.get("secretAccessKey"))
            bucket_obj = oss2.Bucket(auth, config.get("endpoint"), bucket)
            url = bucket_obj.sign_url("GET", key, expires_in)
            return {
                "success": True,
                "result": {"bucket": bucket, "key": key, "url": url, "expires_in": expires_in},
            }
        except Exception as e:
            return {"success": False, "error": f"Generate URL failed: {str(e)}"}

    async def _upload(
        self, storage_type: str, params: Dict[str, Any], config: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Upload content to storage."""
        bucket = params.get("bucket")
        key = params.get("key")
        content = params.get("content")
        content_type = params.get("content_type", "application/octet-stream")

        if not bucket or not key:
            return {"success": False, "error": "Missing 'bucket' or 'key' parameter"}
        if content is None:
            return {"success": False, "error": "Missing 'content' parameter"}

        if storage_type == "s3":
            return self._upload_s3(config, bucket, key, content, content_type)
        elif storage_type == "oss":
            return self._upload_oss(config, bucket, key, content, content_type)
        else:
            return {"success": False, "error": f"Unsupported storage type: {storage_type}"}

    def _upload_s3(
        self, config: Dict[str, Any], bucket: str, key: str, content: str, content_type: str
    ) -> Dict[str, Any]:
        """Upload to S3."""
        if not BOTO3_AVAILABLE:
            return {"success": False, "error": "boto3 not installed"}

        try:
            s3 = self._get_s3_client(config)
            content_bytes = content.encode("utf-8") if isinstance(content, str) else content
            s3.put_object(
                Bucket=bucket,
                Key=key,
                Body=content_bytes,
                ContentType=content_type,
            )
            return {
                "success": True,
                "result": {"bucket": bucket, "key": key, "size": len(content_bytes)},
            }
        except Exception as e:
            return {"success": False, "error": f"Upload failed: {str(e)}"}

    def _upload_oss(
        self, config: Dict[str, Any], bucket: str, key: str, content: str, content_type: str
    ) -> Dict[str, Any]:
        """Upload to OSS."""
        if not OSS2_AVAILABLE:
            return {"success": False, "error": "oss2 not installed"}

        try:
            auth = oss2.Auth(config.get("accessKeyId"), config.get("secretAccessKey"))
            bucket_obj = oss2.Bucket(auth, config.get("endpoint"), bucket)
            content_bytes = content.encode("utf-8") if isinstance(content, str) else content
            bucket_obj.put_object(key, content_bytes, headers={"Content-Type": content_type})
            return {
                "success": True,
                "result": {"bucket": bucket, "key": key, "size": len(content_bytes)},
            }
        except Exception as e:
            return {"success": False, "error": f"Upload failed: {str(e)}"}


# Global service instance
storage_service = StorageService()

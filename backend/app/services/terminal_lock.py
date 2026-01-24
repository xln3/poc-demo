"""终端独占锁服务

使用文件锁持久化存储，确保后端重启后锁状态保持。
"""

import json
import time
from pathlib import Path
from threading import Lock
from typing import Optional, Dict, Any
from datetime import datetime

from ..config import LOCK_CONFIG, ensure_lock_dir


class TerminalLock:
    """终端独占锁

    特性:
    - 文件锁持久化，后端重启不丢失
    - 支持心跳续期
    - 超时自动释放
    - 并发安全
    """

    def __init__(self):
        self._lock = Lock()
        self._lock_dir = ensure_lock_dir()
        self._timeout = LOCK_CONFIG['timeout_seconds']
        self._heartbeat_interval = LOCK_CONFIG['heartbeat_interval']

    def _get_lock_path(self, tag: str) -> Path:
        """获取锁文件路径"""
        return self._lock_dir / f"{tag}.lock"

    def _read_lock(self, tag: str) -> Optional[Dict[str, Any]]:
        """读取锁文件"""
        lock_file = self._get_lock_path(tag)
        if not lock_file.exists():
            return None
        try:
            return json.loads(lock_file.read_text())
        except (json.JSONDecodeError, IOError):
            return None

    def _write_lock(self, tag: str, lock_info: Dict[str, Any]) -> bool:
        """写入锁文件"""
        lock_file = self._get_lock_path(tag)
        try:
            lock_file.write_text(json.dumps(lock_info))
            return True
        except IOError:
            return False

    def _delete_lock(self, tag: str) -> bool:
        """删除锁文件"""
        lock_file = self._get_lock_path(tag)
        try:
            if lock_file.exists():
                lock_file.unlink()
            return True
        except IOError:
            return False

    def _is_expired(self, lock_info: Dict[str, Any]) -> bool:
        """检查锁是否已超时"""
        last_heartbeat = lock_info.get('last_heartbeat', 0)
        return time.time() - last_heartbeat > self._timeout

    def acquire(self, tag: str, user_id: str, client_ip: str = None) -> Dict[str, Any]:
        """尝试获取锁

        Args:
            tag: 终端标识
            user_id: 用户/浏览器标识
            client_ip: 客户端 IP 地址

        Returns:
            {
                "success": bool,
                "holder": str | None,  # 当前持有者
                "holder_ip": str | None,  # 持有者 IP
                "message": str
            }
        """
        with self._lock:
            lock_info = self._read_lock(tag)

            if lock_info is not None:
                # 检查是否超时
                if not self._is_expired(lock_info):
                    # 锁仍然有效
                    if lock_info['user_id'] == user_id:
                        # 同一用户，更新心跳和 IP
                        lock_info['last_heartbeat'] = time.time()
                        if client_ip:
                            lock_info['client_ip'] = client_ip
                        self._write_lock(tag, lock_info)
                        return {
                            "success": True,
                            "holder": user_id,
                            "holder_ip": lock_info.get('client_ip'),
                            "message": "锁已刷新"
                        }
                    elif client_ip and lock_info.get('client_ip') == client_ip:
                        # 同 IP 不同会话，允许抢夺锁
                        # 继续往下创建新锁
                        pass
                    else:
                        # 被其他用户（不同 IP）持有
                        return {
                            "success": False,
                            "holder": lock_info['user_id'],
                            "holder_ip": lock_info.get('client_ip'),
                            "message": f"终端被 {lock_info['user_id'][:8]}... 占用"
                        }

            # 锁不存在或已超时，创建新锁
            new_lock = {
                "user_id": user_id,
                "client_ip": client_ip,
                "acquired_at": datetime.now().isoformat(),
                "last_heartbeat": time.time()
            }

            if self._write_lock(tag, new_lock):
                return {
                    "success": True,
                    "holder": user_id,
                    "holder_ip": client_ip,
                    "message": "锁已获取"
                }
            else:
                return {
                    "success": False,
                    "holder": None,
                    "holder_ip": None,
                    "message": "写入锁文件失败"
                }

    def release(self, tag: str, user_id: str) -> Dict[str, Any]:
        """释放锁

        Args:
            tag: 终端标识
            user_id: 用户标识

        Returns:
            {"success": bool, "message": str}
        """
        with self._lock:
            lock_info = self._read_lock(tag)

            if lock_info is None:
                return {
                    "success": True,
                    "message": "锁不存在"
                }

            if lock_info['user_id'] != user_id:
                return {
                    "success": False,
                    "message": "无权释放他人的锁"
                }

            if self._delete_lock(tag):
                return {
                    "success": True,
                    "message": "锁已释放"
                }
            else:
                return {
                    "success": False,
                    "message": "删除锁文件失败"
                }

    def heartbeat(self, tag: str, user_id: str) -> Dict[str, Any]:
        """发送心跳续期

        Args:
            tag: 终端标识
            user_id: 用户标识

        Returns:
            {"success": bool, "message": str}
        """
        with self._lock:
            lock_info = self._read_lock(tag)

            if lock_info is None:
                return {
                    "success": False,
                    "message": "锁不存在"
                }

            if lock_info['user_id'] != user_id:
                return {
                    "success": False,
                    "message": "无权续期他人的锁"
                }

            lock_info['last_heartbeat'] = time.time()
            if self._write_lock(tag, lock_info):
                return {
                    "success": True,
                    "message": "心跳已更新"
                }
            else:
                return {
                    "success": False,
                    "message": "更新失败"
                }

    def get_status(self, tag: str) -> Dict[str, Any]:
        """获取锁状态

        Returns:
            {
                "locked": bool,
                "holder": str | None,
                "holder_ip": str | None,
                "acquired_at": str | None,
                "expired": bool
            }
        """
        with self._lock:
            lock_info = self._read_lock(tag)

            if lock_info is None:
                return {
                    "locked": False,
                    "holder": None,
                    "holder_ip": None,
                    "acquired_at": None,
                    "expired": False
                }

            expired = self._is_expired(lock_info)
            return {
                "locked": not expired,
                "holder": lock_info['user_id'] if not expired else None,
                "holder_ip": lock_info.get('client_ip') if not expired else None,
                "acquired_at": lock_info['acquired_at'],
                "expired": expired
            }

    def force_release(self, tag: str) -> Dict[str, Any]:
        """强制释放锁（管理员用）

        Returns:
            {"success": bool, "message": str}
        """
        with self._lock:
            if self._delete_lock(tag):
                return {
                    "success": True,
                    "message": "锁已强制释放"
                }
            else:
                return {
                    "success": False,
                    "message": "操作失败"
                }

    def cleanup_expired(self) -> int:
        """清理所有过期锁

        Returns:
            清理的锁数量
        """
        with self._lock:
            cleaned = 0
            for lock_file in self._lock_dir.glob("*.lock"):
                try:
                    lock_info = json.loads(lock_file.read_text())
                    if self._is_expired(lock_info):
                        lock_file.unlink()
                        cleaned += 1
                except (json.JSONDecodeError, IOError):
                    # 损坏的锁文件也清理
                    try:
                        lock_file.unlink()
                        cleaned += 1
                    except IOError:
                        pass
            return cleaned


# 全局单例
terminal_lock = TerminalLock()

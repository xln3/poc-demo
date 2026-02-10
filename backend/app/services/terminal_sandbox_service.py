"""
多终端沙箱服务 - 支持多用户同时使用不同容器

负责管理多个用户的终端沙箱容器，每个用户通过 tag 标识。
支持 Python、Ubuntu、Node 三种镜像。
文件持久化到宿主机目录，容器删除后保留文件到 deleted/ 目录。
"""

import os
import re
import stat
import shutil
from datetime import datetime
from threading import Lock
from typing import Dict, List, Optional
from dataclasses import dataclass

from ..models.schemas import (
    TerminalImage,
    ContainerType,
    MEMORY_LIMITS,
    ContainerInfo,
    ContainerStatus,
    TerminalInfo,
    DeletedTerminalInfo,
    CleanupResult,
)
from .container import container_manager


@dataclass
class TerminalState:
    """终端状态"""
    tag: str
    session_id: str
    container_id: str
    image: str
    created_at: str
    mount_path: str


class MultiTerminalSandboxService:
    """多终端沙箱服务 - 支持并发安全的多用户终端管理"""

    # 数据目录路径计算
    _PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..'))
    _DATA_ROOT = os.path.join(_PROJECT_ROOT, '..', 'poc-data', 'sandbox')
    _FALLBACK_DATA_ROOT = '/mnt/data1/workspace/xln/2026Jan/poc-data/sandbox'

    # Tag 格式校验
    TAG_PATTERN = re.compile(r'^[a-zA-Z0-9][a-zA-Z0-9_-]{0,31}$')

    def __init__(self):
        self._registry_lock = Lock()      # 全局：保护终端列表增删
        self._tag_locks: Dict[str, Lock] = {}  # 每 tag：保护单终端操作
        self._fs_lock = Lock()            # 文件系统操作
        self._terminals: Dict[str, Optional[TerminalState]] = {}

        # 确保数据目录存在
        self._ensure_data_dirs()

    def _get_data_root(self) -> str:
        """获取数据根目录，优先使用相对路径"""
        if os.path.exists(os.path.dirname(self._DATA_ROOT)):
            return self._DATA_ROOT
        return self._FALLBACK_DATA_ROOT

    def _ensure_data_dirs(self):
        """确保数据目录存在"""
        data_root = self._get_data_root()
        os.makedirs(os.path.join(data_root, 'active'), exist_ok=True)
        os.makedirs(os.path.join(data_root, 'deleted'), exist_ok=True)

    def _validate_tag(self, tag: str) -> None:
        """校验 tag 格式"""
        if not self.TAG_PATTERN.match(tag):
            raise ValueError(
                f"无效的 tag '{tag}'：必须以字母或数字开头，"
                "只能包含字母、数字、下划线和连字符，长度 1-32"
            )

    def _get_active_path(self, tag: str) -> str:
        """获取活跃终端的挂载路径"""
        return os.path.join(self._get_data_root(), 'active', tag)

    def _get_deleted_path(self, name: str) -> str:
        """获取已删除终端的路径"""
        return os.path.join(self._get_data_root(), 'deleted', name)

    def _get_dir_size(self, path: str) -> int:
        """计算目录大小"""
        total = 0
        try:
            for dirpath, _, filenames in os.walk(path):
                for filename in filenames:
                    filepath = os.path.join(dirpath, filename)
                    try:
                        total += os.path.getsize(filepath)
                    except OSError:
                        pass
        except OSError:
            pass
        return total

    @staticmethod
    def _force_remove_readonly(func, path, excinfo):
        """强制删除只读文件/目录（用于 shutil.rmtree 的 onerror 回调）"""
        try:
            # 对目录需要 rwx 权限，对文件需要 rw 权限
            if os.path.isdir(path):
                os.chmod(path, stat.S_IRWXU)
            else:
                os.chmod(path, stat.S_IRUSR | stat.S_IWUSR)
            func(path)
        except Exception:
            pass  # 仍然失败则忽略

    def _fix_permissions_recursive(self, path: str):
        """递归修复目录权限（用于删除前）"""
        try:
            for root, dirs, files in os.walk(path, topdown=False):
                for name in files:
                    filepath = os.path.join(root, name)
                    try:
                        os.chmod(filepath, stat.S_IRUSR | stat.S_IWUSR)
                    except Exception:
                        pass
                for name in dirs:
                    dirpath = os.path.join(root, name)
                    try:
                        os.chmod(dirpath, stat.S_IRWXU)
                    except Exception:
                        pass
            # 最后修复根目录
            os.chmod(path, stat.S_IRWXU)
        except Exception:
            pass

    def create_terminal(self, tag: str, image: TerminalImage) -> TerminalInfo:
        """创建终端容器

        Args:
            tag: 用户自定义标识
            image: 终端镜像类型

        Returns:
            TerminalInfo: 终端信息

        Raises:
            ValueError: tag 格式无效或已被使用
        """
        # 1. 验证 tag 格式
        self._validate_tag(tag)

        # 2. 检查并预注册（全局锁）
        with self._registry_lock:
            if tag in self._terminals:
                raise ValueError(f"Tag '{tag}' 已被使用")
            # 占位，表示正在创建
            self._terminals[tag] = None
            self._tag_locks[tag] = Lock()

        try:
            # 3. 创建目录（文件系统锁）
            mount_path = self._get_active_path(tag)
            with self._fs_lock:
                os.makedirs(mount_path, exist_ok=True)

            # 4. 创建 Docker 容器（无锁，耗时操作）
            session_id = f"terminal-{tag}"
            mem_limit = MEMORY_LIMITS[ContainerType.TERMINAL]

            info = container_manager.get_or_create_container(
                image=image.value,
                session_id=session_id,
                mem_limit=mem_limit,
                volumes={mount_path: {'bind': '/workspace', 'mode': 'rw'}},
                run_as_root=False,
            )

            # 5. 更新注册表
            state = TerminalState(
                tag=tag,
                session_id=session_id,
                container_id=info.container_id,
                image=image.value,
                created_at=info.created_at,
                mount_path=mount_path,
            )
            with self._registry_lock:
                self._terminals[tag] = state

            return TerminalInfo(
                tag=tag,
                session_id=session_id,
                container_id=info.container_id,
                image=image.value,
                status=info.status,
                created_at=info.created_at,
                mount_path=mount_path,
            )

        except Exception:
            # 回滚预注册
            with self._registry_lock:
                self._terminals.pop(tag, None)
                self._tag_locks.pop(tag, None)
            raise

    def destroy_terminal(self, tag: str) -> bool:
        """销毁指定终端容器

        Args:
            tag: 终端标识

        Returns:
            bool: 是否成功销毁

        Raises:
            ValueError: 终端不存在
        """
        # 1. 从注册表移除
        with self._registry_lock:
            if tag not in self._terminals:
                raise ValueError(f"终端 '{tag}' 不存在")
            state = self._terminals.pop(tag)
            tag_lock = self._tag_locks.pop(tag)

        # state 可能为 None（正在创建中）
        if state is None:
            return False

        # 2. 修复权限并停止容器（终端锁）
        with tag_lock:
            # 在容器还运行时，用容器内的 root 修复文件权限
            # 这样宿主机用户删除时不会遇到权限问题
            try:
                container_manager.exec_in_container(
                    state.session_id,
                    "chmod -R a+rwX /workspace 2>/dev/null || true"
                )
            except Exception:
                pass  # 容器可能已异常，忽略错误
            container_manager.destroy_container(state.session_id)

        # 3. 重命名目录到 deleted/（文件系统锁）
        timestamp = datetime.now().strftime('%Y%m%d%H%M%S')
        deleted_name = f"{tag}-{timestamp}"
        with self._fs_lock:
            src_path = self._get_active_path(tag)
            dst_path = self._get_deleted_path(deleted_name)
            if os.path.exists(src_path):
                shutil.move(src_path, dst_path)

        return True

    def get_terminal(self, tag: str) -> Optional[TerminalInfo]:
        """获取指定终端信息

        Args:
            tag: 终端标识

        Returns:
            TerminalInfo 或 None
        """
        with self._registry_lock:
            state = self._terminals.get(tag)
            if state is None:
                return None

        # 获取容器最新状态
        container_info = container_manager.get_container_status(state.session_id)

        # 计算占用体积
        size_bytes = self._get_dir_size(state.mount_path)

        return TerminalInfo(
            tag=state.tag,
            session_id=state.session_id,
            container_id=state.container_id,
            image=state.image,
            status=container_info.status,
            created_at=state.created_at,
            mount_path=state.mount_path,
            size_bytes=size_bytes,
        )

    def list_terminals(self) -> List[TerminalInfo]:
        """列出所有运行中的终端"""
        with self._registry_lock:
            tags = [tag for tag, state in self._terminals.items() if state is not None]

        result = []
        for tag in tags:
            info = self.get_terminal(tag)
            if info:
                result.append(info)
        return result

    def get_session_id(self, tag: str) -> Optional[str]:
        """获取终端的 session_id

        Args:
            tag: 终端标识

        Returns:
            session_id 或 None
        """
        with self._registry_lock:
            state = self._terminals.get(tag)
            return state.session_id if state else None

    def list_deleted_terminals(self) -> List[DeletedTerminalInfo]:
        """列出所有已删除终端"""
        result = []
        deleted_root = os.path.join(self._get_data_root(), 'deleted')

        with self._fs_lock:
            if not os.path.exists(deleted_root):
                return result

            for name in os.listdir(deleted_root):
                path = os.path.join(deleted_root, name)
                if not os.path.isdir(path):
                    continue

                # 解析 "{tag}-{timestamp}"
                parts = name.rsplit('-', 1)
                if len(parts) == 2:
                    original_tag, timestamp = parts
                    try:
                        deleted_at = datetime.strptime(timestamp, '%Y%m%d%H%M%S').isoformat()
                    except ValueError:
                        deleted_at = timestamp
                else:
                    original_tag = name
                    deleted_at = ""

                size = self._get_dir_size(path)
                result.append(DeletedTerminalInfo(
                    original_tag=original_tag,
                    deleted_at=deleted_at,
                    path=path,
                    size_bytes=size,
                ))

        return result

    def cleanup_deleted_terminal(self, name: str) -> CleanupResult:
        """清理单个已删除终端

        Args:
            name: 已删除终端目录名（格式: {tag}-{timestamp}）

        Returns:
            CleanupResult: 清理结果
        """
        errors = []
        cleaned = 0
        freed = 0

        with self._fs_lock:
            path = self._get_deleted_path(name)
            if not os.path.exists(path):
                errors.append(f"目录不存在: {name}")
                return CleanupResult(cleaned_count=0, freed_bytes=0, errors=errors)

            # 先修复权限再计算大小和删除
            self._fix_permissions_recursive(path)
            size = self._get_dir_size(path)
            try:
                shutil.rmtree(path, onerror=self._force_remove_readonly)
                cleaned = 1
                freed = size
            except Exception as e:
                errors.append(f"删除失败 {name}: {str(e)}")

        return CleanupResult(cleaned_count=cleaned, freed_bytes=freed, errors=errors)

    def cleanup_all_deleted(self) -> CleanupResult:
        """清理所有已删除终端

        Returns:
            CleanupResult: 清理结果
        """
        errors = []
        cleaned = 0
        freed = 0

        deleted_root = os.path.join(self._get_data_root(), 'deleted')

        with self._fs_lock:
            if not os.path.exists(deleted_root):
                return CleanupResult(cleaned_count=0, freed_bytes=0, errors=errors)

            for name in os.listdir(deleted_root):
                path = os.path.join(deleted_root, name)
                if not os.path.isdir(path):
                    continue

                # 先修复权限再计算大小和删除
                self._fix_permissions_recursive(path)
                size = self._get_dir_size(path)
                try:
                    shutil.rmtree(path, onerror=self._force_remove_readonly)
                    cleaned += 1
                    freed += size
                except Exception as e:
                    errors.append(f"删除失败 {name}: {str(e)}")

        return CleanupResult(cleaned_count=cleaned, freed_bytes=freed, errors=errors)


# 全局单例
terminal_sandbox_service = MultiTerminalSandboxService()

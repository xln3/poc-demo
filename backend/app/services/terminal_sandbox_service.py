"""
终端沙箱服务 - 严格单例管理

负责管理用户的终端沙箱容器，确保同时只能运行一个终端容器。
支持 Python、Ubuntu、Node 三种镜像。
"""

from typing import Optional
from ..models.schemas import TerminalImage, ContainerType, MEMORY_LIMITS, ContainerInfo, ContainerStatus
from .container import container_manager


class TerminalSandboxService:
    """终端沙箱服务 - 严格单例管理"""

    _current_session_id: Optional[str] = None
    _current_tag: Optional[str] = None
    _current_image: Optional[str] = None

    @classmethod
    def create_terminal(cls, image: TerminalImage, tag: str) -> ContainerInfo:
        """创建终端容器（单例）

        Args:
            image: 终端镜像类型
            tag: 容器标签，用于生成 session_id

        Returns:
            ContainerInfo: 容器信息

        Raises:
            ValueError: 如果已有终端容器在运行
        """
        if cls._current_session_id is not None:
            raise ValueError(f"已有终端容器运行: {cls._current_tag}，请先销毁")

        session_id = f"terminal-{tag}"
        mem_limit = MEMORY_LIMITS[ContainerType.TERMINAL]

        info = container_manager.get_or_create_container(
            image=image.value,
            session_id=session_id,
            mem_limit=mem_limit
        )

        cls._current_session_id = session_id
        cls._current_tag = tag
        cls._current_image = image.value
        return info

    @classmethod
    def destroy_terminal(cls) -> bool:
        """销毁当前终端容器

        Returns:
            bool: 是否成功销毁

        Raises:
            ValueError: 如果没有运行中的终端容器
        """
        if cls._current_session_id is None:
            raise ValueError("没有运行中的终端容器")

        success = container_manager.destroy_container(cls._current_session_id)
        cls._current_session_id = None
        cls._current_tag = None
        cls._current_image = None
        return success

    @classmethod
    def get_current(cls) -> Optional[ContainerInfo]:
        """获取当前终端容器信息

        Returns:
            ContainerInfo 或 None（如果没有运行中的终端）
        """
        if cls._current_session_id is None:
            return None
        return container_manager.get_container_status(cls._current_session_id)

    @classmethod
    def has_running_terminal(cls) -> bool:
        """检查是否有运行中的终端

        Returns:
            bool: 是否有运行中的终端
        """
        return cls._current_session_id is not None

    @classmethod
    def get_current_session_id(cls) -> Optional[str]:
        """获取当前终端的 session_id

        Returns:
            str 或 None
        """
        return cls._current_session_id


# 全局单例
terminal_sandbox_service = TerminalSandboxService()

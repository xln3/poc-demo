"""
MCP 服务容器管理

负责管理 MCP (Model Context Protocol) 服务器容器，
提供工具调用和资源管理功能。
"""

from typing import Optional, Dict, Any, Tuple
from ..models.schemas import ContainerType, MEMORY_LIMITS, ContainerInfo
from .container import container_manager


class MCPService:
    """MCP 服务容器管理"""

    SESSION_ID = "mcp-server"
    IMAGE = "mcp-server:latest"

    def __init__(self):
        self._container_info: Optional[ContainerInfo] = None

    def ensure_container(self) -> ContainerInfo:
        """确保 MCP 容器运行

        Returns:
            ContainerInfo: 容器信息
        """
        if self._container_info:
            status = container_manager.get_container_status(self.SESSION_ID)
            if status.status.value == "running":
                return status

        mem_limit = MEMORY_LIMITS[ContainerType.MCP_SERVER]
        info = container_manager.get_or_create_container(
            image=self.IMAGE,
            session_id=self.SESSION_ID,
            mem_limit=mem_limit
        )
        self._container_info = info
        return info

    def get_status(self) -> ContainerInfo:
        """获取容器状态

        Returns:
            ContainerInfo: 容器信息
        """
        return container_manager.get_container_status(self.SESSION_ID)

    def destroy(self) -> bool:
        """销毁容器

        Returns:
            bool: 是否成功销毁
        """
        success = container_manager.destroy_container(self.SESSION_ID)
        self._container_info = None
        return success

    def execute_command(self, command: str) -> Tuple[int, str, str]:
        """在容器内执行命令

        Args:
            command: 要执行的命令

        Returns:
            (exit_code, stdout, stderr)
        """
        self.ensure_container()
        return container_manager.exec_in_container(self.SESSION_ID, command)

    def is_running(self) -> bool:
        """检查容器是否在运行

        Returns:
            bool: 是否在运行
        """
        status = container_manager.get_container_status(self.SESSION_ID)
        return status.status.value == "running"


# 全局单例
mcp_service = MCPService()

"""
容器化文件解析服务

使用 mcp-tools:latest 镜像在 Docker 容器内执行文件解析，
解决主机缺少 tesseract 等依赖的问题。
"""

import json
import logging
from typing import List, Optional

from .container import container_manager
from ..models.schemas import ImageType

logger = logging.getLogger(__name__)

# 解析容器的固定 session_id
PARSER_SESSION_ID = "parser"


class ContainerParserService:
    """容器化解析服务 - 在 Docker 容器内执行文件解析"""

    def __init__(self):
        self._initialized = False

    def _ensure_container(self):
        """确保解析容器存在并运行"""
        info = container_manager.get_or_create_container(
            image=ImageType.MCP_TOOLS,
            session_id=PARSER_SESSION_ID
        )
        if not self._initialized:
            # 确保临时上传目录存在
            container_manager.exec_in_container(PARSER_SESSION_ID, "mkdir -p /tmp/upload")
            self._initialized = True
        return info

    def parse_file(
        self,
        file_bytes: bytes,
        filename: str,
        parser_ids: List[str]
    ) -> List[dict]:
        """
        在容器内解析文件

        Args:
            file_bytes: 文件内容
            filename: 文件名（用于判断类型）
            parser_ids: 要使用的解析器 ID 列表

        Returns:
            解析结果列表
        """
        # 1. 确保容器存在
        self._ensure_container()

        # 2. 复制文件到容器
        container_path = f"/tmp/upload/{filename}"
        try:
            container_manager.copy_file_to_container(
                PARSER_SESSION_ID,
                container_path,
                file_bytes
            )
        except Exception as e:
            logger.error(f"Failed to copy file to container: {e}")
            return [{"error": f"文件上传到容器失败: {str(e)}"}]

        # 3. 执行解析命令
        parsers_json = json.dumps(parser_ids)
        command = f"python3 /app/mcp_parser_cli.py '{container_path}' '{parsers_json}'"

        try:
            exit_code, output = container_manager.exec_in_container(
                PARSER_SESSION_ID,
                f"/bin/bash -c {json.dumps(command)}"
            )

            if exit_code != 0:
                logger.error(f"Container parse failed: exit_code={exit_code}, output={output}")
                return [{"error": f"容器内解析失败: {output}"}]

            # 4. 解析 JSON 输出
            try:
                results = json.loads(output)
                return results
            except json.JSONDecodeError as e:
                logger.error(f"Failed to parse container output: {e}, output={output}")
                return [{"error": f"解析结果格式错误: {output}"}]

        except Exception as e:
            logger.error(f"Container exec failed: {e}")
            return [{"error": f"容器执行失败: {str(e)}"}]

    def is_available(self) -> bool:
        """检查容器解析服务是否可用"""
        try:
            self._ensure_container()

            # 简单验证：检查 CLI 脚本是否存在
            exit_code, output = container_manager.exec_in_container(
                PARSER_SESSION_ID,
                "test -f /app/mcp_parser_cli.py && echo ok"
            )
            return exit_code == 0 and "ok" in output
        except Exception as e:
            logger.warning(f"Container parser not available: {e}")
            return False


# 全局单例
_container_parser: Optional[ContainerParserService] = None


def get_container_parser() -> ContainerParserService:
    """获取容器解析服务单例"""
    global _container_parser
    if _container_parser is None:
        _container_parser = ContainerParserService()
    return _container_parser

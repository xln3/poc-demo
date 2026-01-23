"""文件监控服务

使用 Docker SDK 的流式 exec API 运行 inotifywait 监控文件变化，
通过 WebSocket 推送事件到前端。
"""

import asyncio
import json
import fnmatch
from datetime import datetime
from typing import Dict, Set, Optional, Callable, Any
from dataclasses import dataclass, field

from ..config import FILE_WATCHER_CONFIG


@dataclass
class WatcherSession:
    """监控会话"""
    tag: str
    session_id: str
    path: str
    callback: Callable[[dict], None]
    task: Optional[asyncio.Task] = None
    active: bool = True
    # 事件批处理
    event_buffer: list = field(default_factory=list)
    last_flush: float = 0


class FileWatcher:
    """文件监控服务

    特性:
    - 使用 inotifywait 监控文件变化
    - 事件批处理防止刷屏
    - 支持忽略模式
    - 并发安全
    """

    def __init__(self):
        self._watchers: Dict[str, WatcherSession] = {}  # tag -> session
        self._lock = asyncio.Lock()
        self._batch_interval = FILE_WATCHER_CONFIG['batch_interval']
        self._batch_threshold = FILE_WATCHER_CONFIG['batch_threshold']
        self._ignore_patterns = FILE_WATCHER_CONFIG['ignore_patterns']

    def _should_ignore(self, path: str) -> bool:
        """检查路径是否应被忽略"""
        for pattern in self._ignore_patterns:
            if fnmatch.fnmatch(path, pattern):
                return True
        return False

    async def start_watching(
        self,
        tag: str,
        session_id: str,
        path: str,
        callback: Callable[[dict], None],
        container_manager: Any,
    ) -> bool:
        """启动文件监控

        Args:
            tag: 终端标识
            session_id: 容器会话 ID
            path: 监控路径
            callback: 事件回调函数
            container_manager: 容器管理器实例

        Returns:
            bool: 是否启动成功
        """
        async with self._lock:
            # 如果已有监控，先停止
            if tag in self._watchers:
                await self._stop_watcher(tag)

            session = WatcherSession(
                tag=tag,
                session_id=session_id,
                path=path,
                callback=callback,
            )

            # 启动监控任务
            session.task = asyncio.create_task(
                self._watch_loop(session, container_manager)
            )
            self._watchers[tag] = session

            return True

    async def stop_watching(self, tag: str) -> bool:
        """停止文件监控"""
        async with self._lock:
            return await self._stop_watcher(tag)

    async def _stop_watcher(self, tag: str) -> bool:
        """内部停止方法（需在锁内调用）"""
        if tag not in self._watchers:
            return False

        session = self._watchers[tag]
        session.active = False

        if session.task and not session.task.done():
            session.task.cancel()
            try:
                await session.task
            except asyncio.CancelledError:
                pass

        del self._watchers[tag]
        return True

    async def _watch_loop(self, session: WatcherSession, container_manager: Any):
        """监控循环

        使用 Docker SDK 的流式 exec API 运行 inotifywait
        """
        try:
            container = container_manager._ensure_session(session.session_id)

            # 构建 inotifywait 命令
            # -m: 持续监控
            # -r: 递归
            # -e: 事件类型
            # --format: 输出格式
            cmd = [
                '/bin/sh', '-c',
                f"inotifywait -m -r -e create,delete,modify,move "
                f"--format '%e|%w%f' '{session.path}' 2>/dev/null"
            ]

            # 创建 exec 实例
            exec_id = container.client.api.exec_create(
                container.id,
                cmd,
                stdout=True,
                stderr=True,
            )

            # 启动并获取流式输出
            output_gen = container.client.api.exec_start(
                exec_id['Id'],
                stream=True,
                demux=True,
            )

            # 处理输出
            buffer = b""
            async for stdout_chunk, stderr_chunk in self._async_iter(output_gen):
                if not session.active:
                    break

                if stdout_chunk:
                    buffer += stdout_chunk
                    # 按行处理
                    while b'\n' in buffer:
                        line, buffer = buffer.split(b'\n', 1)
                        await self._process_event(session, line.decode('utf-8', errors='replace'))

        except asyncio.CancelledError:
            pass
        except Exception as e:
            # 发送错误事件
            session.callback({
                "type": "error",
                "message": f"监控出错: {str(e)}",
                "timestamp": datetime.now().isoformat(),
            })

    async def _async_iter(self, generator):
        """将同步生成器转换为异步迭代器"""
        loop = asyncio.get_event_loop()
        while True:
            try:
                item = await loop.run_in_executor(None, next, generator)
                yield item
            except StopIteration:
                break

    async def _process_event(self, session: WatcherSession, line: str):
        """处理单个事件行"""
        if not line.strip():
            return

        # 解析格式: EVENT|PATH
        parts = line.split('|', 1)
        if len(parts) != 2:
            return

        event_type, path = parts

        # 检查是否应忽略
        if self._should_ignore(path):
            return

        event = {
            "type": "file_change",
            "event": event_type,
            "path": path,
            "timestamp": datetime.now().isoformat(),
        }

        # 添加到缓冲区
        session.event_buffer.append(event)

        # 检查是否需要批量发送
        now = asyncio.get_event_loop().time()
        should_flush = (
            len(session.event_buffer) >= self._batch_threshold or
            now - session.last_flush >= self._batch_interval
        )

        if should_flush:
            await self._flush_events(session)

    async def _flush_events(self, session: WatcherSession):
        """发送缓冲的事件"""
        if not session.event_buffer:
            return

        events = session.event_buffer
        session.event_buffer = []
        session.last_flush = asyncio.get_event_loop().time()

        if len(events) == 1:
            # 单个事件直接发送
            session.callback(events[0])
        else:
            # 多个事件发送摘要
            session.callback({
                "type": "file_changes",
                "count": len(events),
                "events": events[:5],  # 只发前 5 个作为样例
                "timestamp": datetime.now().isoformat(),
            })

    def is_watching(self, tag: str) -> bool:
        """检查是否正在监控"""
        return tag in self._watchers and self._watchers[tag].active

    async def cleanup_all(self):
        """清理所有监控"""
        async with self._lock:
            for tag in list(self._watchers.keys()):
                await self._stop_watcher(tag)


# 全局单例
file_watcher = FileWatcher()

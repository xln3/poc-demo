from __future__ import annotations
import uuid
import io
import tarfile
import base64
from datetime import datetime
from typing import Optional, Dict, List, Tuple
from ..models.schemas import ContainerStatus, ContainerInfo

# Docker is optional
try:
    import docker
    DOCKER_AVAILABLE = True
except ImportError:
    DOCKER_AVAILABLE = False
    docker = None


class ContainerManager:
    """Manages Docker containers for sandbox execution."""

    CONTAINER_PREFIX = "poc-sandbox-"
    WORK_DIR = "/workspace"
    ISOLATED_NETWORK_NAME = "poc-sandbox-isolated"
    ISOLATED_NETWORK_SUBNET = "10.200.0.0/16"

    def __init__(self):
        self.client = docker.from_env() if DOCKER_AVAILABLE else None
        self._sessions: Dict[str, str] = {}  # session_id -> container_id
        self._session_images: Dict[str, str] = {}  # session_id -> image
        self._session_created: Dict[str, str] = {}  # session_id -> created_at
        self._network = self._ensure_isolated_network()

    def _ensure_isolated_network(self):
        """Ensure the isolated Docker network exists, create if not.

        The isolated network restricts container access to internal/private IPs
        while allowing public internet access. Requires companion iptables rules
        from setup-sandbox-network.sh on the host to be effective.
        """
        if not self.client:
            return None

        try:
            network = self.client.networks.get(self.ISOLATED_NETWORK_NAME)
            return network
        except docker.errors.NotFound:
            pass

        ipam_pool = docker.types.IPAMPool(subnet=self.ISOLATED_NETWORK_SUBNET)
        ipam_config = docker.types.IPAMConfig(pool_configs=[ipam_pool])
        network = self.client.networks.create(
            self.ISOLATED_NETWORK_NAME,
            driver="bridge",
            ipam=ipam_config,
        )
        return network

    def is_available(self) -> bool:
        """Check if Docker is available."""
        return DOCKER_AVAILABLE and self.client is not None

    def get_or_create_container(
        self,
        image: str,  # 改为 str，支持任意镜像名
        session_id: Optional[str] = None,
        mem_limit: str = "512m",
        volumes: Optional[Dict[str, dict]] = None  # 宿主机挂载卷
    ) -> ContainerInfo:
        """Get existing container for session or create new one.

        Args:
            image: 容器镜像名
            session_id: 会话 ID，用于标识容器
            mem_limit: 内存限制
            volumes: 挂载卷映射，如 {'/host/path': {'bind': '/container/path', 'mode': 'rw'}}

        Returns:
            ContainerInfo: 容器信息
        """

        if session_id and session_id in self._sessions:
            container_id = self._sessions[session_id]
            try:
                container = self.client.containers.get(container_id)
                if container.status == "running":
                    return ContainerInfo(
                        session_id=session_id,
                        container_id=container_id[:12],
                        image=self._session_images[session_id],
                        status=ContainerStatus.RUNNING,
                        created_at=self._session_created[session_id]
                    )
                # Container exists but not running, start it
                container.start()
                return ContainerInfo(
                    session_id=session_id,
                    container_id=container_id[:12],
                    image=self._session_images[session_id],
                    status=ContainerStatus.RUNNING,
                    created_at=self._session_created[session_id]
                )
            except docker.errors.NotFound:
                # Container was removed, create new one
                del self._sessions[session_id]
                del self._session_images[session_id]
                del self._session_created[session_id]

        # Create new session and container
        new_session_id = session_id or str(uuid.uuid4())[:8]
        container_name = f"{self.CONTAINER_PREFIX}{new_session_id}"

        # Remove existing container with same name if exists
        try:
            old_container = self.client.containers.get(container_name)
            old_container.remove(force=True)
        except docker.errors.NotFound:
            pass

        # Create new container
        container = self.client.containers.run(
            image=image,  # 直接使用字符串
            name=container_name,
            detach=True,
            tty=True,
            working_dir=self.WORK_DIR,
            # Security: limit resources
            mem_limit=mem_limit,  # 使用传入的参数
            cpu_period=100000,
            cpu_quota=50000,  # 50% CPU
            network=self.ISOLATED_NETWORK_NAME,  # Isolated network; see setup-sandbox-network.sh
            # Volume mounts for file persistence
            volumes=volumes or {},
            # Keep container alive
            command="tail -f /dev/null"
        )

        created_at = datetime.now().isoformat()
        self._sessions[new_session_id] = container.id
        self._session_images[new_session_id] = image  # 直接使用字符串
        self._session_created[new_session_id] = created_at

        # Create workspace directory
        container.exec_run(f"mkdir -p {self.WORK_DIR}")

        return ContainerInfo(
            session_id=new_session_id,
            container_id=container.id[:12],
            image=image,  # 直接使用字符串
            status=ContainerStatus.RUNNING,
            created_at=created_at
        )

    def get_container_status(self, session_id: str) -> ContainerInfo:
        """Get status of a container by session ID."""
        if session_id not in self._sessions:
            return ContainerInfo(
                session_id=session_id,
                container_id="",
                image="",
                status=ContainerStatus.NOT_FOUND,
                created_at=""
            )

        container_id = self._sessions[session_id]
        try:
            container = self.client.containers.get(container_id)
            status = ContainerStatus.RUNNING if container.status == "running" else ContainerStatus.STOPPED
            return ContainerInfo(
                session_id=session_id,
                container_id=container_id[:12],
                image=self._session_images[session_id],
                status=status,
                created_at=self._session_created[session_id]
            )
        except docker.errors.NotFound:
            return ContainerInfo(
                session_id=session_id,
                container_id="",
                image="",
                status=ContainerStatus.NOT_FOUND,
                created_at=""
            )

    def destroy_container(self, session_id: str) -> bool:
        """Destroy a container and clean up session."""
        destroyed = False

        # 方式1: 通过 session 字典查找
        if session_id in self._sessions:
            container_id = self._sessions[session_id]
            try:
                container = self.client.containers.get(container_id)
                container.remove(force=True)
                destroyed = True
            except docker.errors.NotFound:
                pass

            del self._sessions[session_id]
            self._session_images.pop(session_id, None)
            self._session_created.pop(session_id, None)

        # 方式2: 通过容器名称查找（后端重启后 session 字典为空的情况）
        container_name = f"{self.CONTAINER_PREFIX}{session_id}"
        try:
            container = self.client.containers.get(container_name)
            container.remove(force=True)
            destroyed = True
        except docker.errors.NotFound:
            pass

        return destroyed

    def _ensure_session(self, session_id: str):
        """确保会话存在，如需要则恢复

        Returns:
            container: Docker container object
        """
        if session_id not in self._sessions:
            # 尝试恢复已存在的容器（后端重启后容器可能仍在运行）
            container_name = f"{self.CONTAINER_PREFIX}{session_id}"
            try:
                container = self.client.containers.get(container_name)
                if container.status == "running":
                    # 恢复会话
                    self._sessions[session_id] = container.id
                    self._session_images[session_id] = container.image.tags[0] if container.image.tags else "unknown"
                    self._session_created[session_id] = datetime.now().isoformat()
                else:
                    raise ValueError(f"Session {session_id} not found (container not running)")
            except docker.errors.NotFound:
                raise ValueError(f"Session {session_id} not found")

        container_id = self._sessions[session_id]
        return self.client.containers.get(container_id)

    def exec_in_container(self, session_id: str, command: str) -> Tuple[int, str, str]:
        """Execute command in container and return (exit_code, stdout, stderr).

        Returns stdout and stderr separately so callers can parse JSON from stdout
        while keeping logs/progress from stderr separate.
        """
        container = self._ensure_session(session_id)

        result = container.exec_run(
            command,
            workdir=self.WORK_DIR,
            demux=True
        )

        stdout = result.output[0].decode() if result.output[0] else ""
        stderr = result.output[1].decode() if result.output[1] else ""

        return result.exit_code, stdout.strip(), stderr.strip()

    def exec_in_container_binary(
        self, session_id: str, command: str
    ) -> Tuple[int, bytes, bytes]:
        """执行命令并返回二进制输出（用于处理含特殊字符的文件名）

        Returns:
            (exit_code, stdout_bytes, stderr_bytes)
        """
        container = self._ensure_session(session_id)

        result = container.exec_run(
            command,
            workdir=self.WORK_DIR,
            demux=True
        )

        # 返回原始二进制，不解码
        stdout = result.output[0] if result.output[0] else b""
        stderr = result.output[1] if result.output[1] else b""

        return result.exit_code, stdout, stderr

    def get_archive(self, session_id: str, path: str) -> Tuple[bytes, dict]:
        """从容器获取文件/目录的 tar 归档

        Args:
            session_id: 会话 ID
            path: 容器内路径

        Returns:
            (tar_data, stat_info)
        """
        container = self._ensure_session(session_id)

        # Docker SDK 的 get_archive 返回 (generator, stat_dict)
        bits, stat = container.get_archive(path)

        # 读取所有数据
        tar_data = b''.join(bits)

        return tar_data, stat

    def put_archive(self, session_id: str, path: str, data: bytes) -> bool:
        """将 tar 归档写入容器

        Args:
            session_id: 会话 ID
            path: 容器内目标目录
            data: tar 归档数据

        Returns:
            bool: 是否成功
        """
        container = self._ensure_session(session_id)
        return container.put_archive(path, data)

    def copy_file_to_container(self, session_id: str, path: str, content: bytes) -> bool:
        """Copy a file to container using Docker's put_archive API.

        Args:
            session_id: Session ID
            path: Full path in container (e.g., /tmp/file.pdf)
            content: File content as bytes

        Returns:
            True if successful
        """
        container = self._ensure_session(session_id)

        # Create a tar archive in memory
        tar_stream = io.BytesIO()
        with tarfile.open(fileobj=tar_stream, mode='w') as tar:
            # Get just the filename from path
            filename = path.split('/')[-1]
            tarinfo = tarfile.TarInfo(name=filename)
            tarinfo.size = len(content)
            tarinfo.mode = 0o644  # rw-r--r--
            tarinfo.uid = 0  # root
            tarinfo.gid = 0  # root
            tar.addfile(tarinfo, io.BytesIO(content))

        tar_stream.seek(0)

        # Get the directory path
        dir_path = '/'.join(path.split('/')[:-1]) or '/'

        # Put the archive to the container
        return container.put_archive(dir_path, tar_stream)

    def list_sessions(self) -> List[ContainerInfo]:
        """List all active sessions."""
        sessions = []
        for session_id in list(self._sessions.keys()):
            sessions.append(self.get_container_status(session_id))
        return sessions

    def cleanup_all(self):
        """Clean up all containers."""
        for session_id in list(self._sessions.keys()):
            self.destroy_container(session_id)


# Singleton instance
container_manager = ContainerManager()

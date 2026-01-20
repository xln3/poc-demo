from __future__ import annotations
import uuid
import io
import tarfile
import base64
from datetime import datetime
from typing import Optional, Dict, List, Tuple
from ..models.schemas import ImageType, ContainerStatus, ContainerInfo

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

    def __init__(self):
        self.client = docker.from_env() if DOCKER_AVAILABLE else None
        self._sessions: Dict[str, str] = {}  # session_id -> container_id
        self._session_images: Dict[str, str] = {}  # session_id -> image
        self._session_created: Dict[str, str] = {}  # session_id -> created_at

    def is_available(self) -> bool:
        """Check if Docker is available."""
        return DOCKER_AVAILABLE and self.client is not None

    def get_or_create_container(
        self,
        image: ImageType,
        session_id: Optional[str] = None
    ) -> ContainerInfo:
        """Get existing container for session or create new one."""

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
            image=image.value,
            name=container_name,
            detach=True,
            tty=True,
            working_dir=self.WORK_DIR,
            # Security: limit resources
            mem_limit="512m",
            cpu_period=100000,
            cpu_quota=50000,  # 50% CPU
            network_mode="bridge",  # Allow network access
            # Keep container alive
            command="tail -f /dev/null"
        )

        created_at = datetime.now().isoformat()
        self._sessions[new_session_id] = container.id
        self._session_images[new_session_id] = image.value
        self._session_created[new_session_id] = created_at

        # Create workspace directory
        container.exec_run(f"mkdir -p {self.WORK_DIR}")

        return ContainerInfo(
            session_id=new_session_id,
            container_id=container.id[:12],
            image=image.value,
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
        if session_id not in self._sessions:
            return False

        container_id = self._sessions[session_id]
        try:
            container = self.client.containers.get(container_id)
            container.remove(force=True)
        except docker.errors.NotFound:
            pass

        del self._sessions[session_id]
        del self._session_images[session_id]
        del self._session_created[session_id]
        return True

    def exec_in_container(self, session_id: str, command: str) -> Tuple[int, str]:
        """Execute command in container and return (exit_code, output)."""
        if session_id not in self._sessions:
            raise ValueError(f"Session {session_id} not found")

        container_id = self._sessions[session_id]
        container = self.client.containers.get(container_id)

        result = container.exec_run(
            command,
            workdir=self.WORK_DIR,
            demux=True
        )

        stdout = result.output[0].decode() if result.output[0] else ""
        stderr = result.output[1].decode() if result.output[1] else ""
        output = stdout + stderr

        return result.exit_code, output.strip()

    def copy_file_to_container(self, session_id: str, path: str, content: bytes) -> bool:
        """Copy a file to container using Docker's put_archive API.

        Args:
            session_id: Session ID
            path: Full path in container (e.g., /tmp/file.pdf)
            content: File content as bytes

        Returns:
            True if successful
        """
        if session_id not in self._sessions:
            raise ValueError(f"Session {session_id} not found")

        container_id = self._sessions[session_id]
        container = self.client.containers.get(container_id)

        # Create a tar archive in memory
        tar_stream = io.BytesIO()
        with tarfile.open(fileobj=tar_stream, mode='w') as tar:
            # Get just the filename from path
            filename = path.split('/')[-1]
            tarinfo = tarfile.TarInfo(name=filename)
            tarinfo.size = len(content)
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

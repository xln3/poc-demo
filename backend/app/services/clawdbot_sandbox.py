"""ClawdBot 沙箱管理服务

管理隔离的 ClawdBot 测试环境，用于安全地测试针对 AI 助手的攻击场景。
"""

from __future__ import annotations
import shlex
import uuid
import json
from datetime import datetime
from typing import Optional, Dict, List, Any, Tuple
from enum import Enum
from pydantic import BaseModel

from .honeypot import get_honeypot_files, get_honeypot_file
from .behavior_monitor import behavior_monitor, BehaviorType, BehaviorSeverity

# Docker is optional
try:
    import docker
    DOCKER_AVAILABLE = True
except ImportError:
    DOCKER_AVAILABLE = False
    docker = None


class ClawdBotSandboxStatus(str, Enum):
    """沙箱状态"""
    CREATING = "creating"
    RUNNING = "running"
    STOPPED = "stopped"
    ERROR = "error"
    NOT_FOUND = "not_found"


class AttackType(str, Enum):
    """攻击类型"""
    EMAIL = "email"           # 邮件 prompt injection
    DM = "dm"                 # 直接消息
    SKILL = "skill"           # 技能投毒
    MCP = "mcp"               # MCP 服务器攻击
    GATEWAY = "gateway"       # Gateway 未授权访问


class ConfigLevel(str, Enum):
    """安全配置级别"""
    INSECURE = "insecure"   # 所有安全功能禁用
    RELAXED = "relaxed"     # 部分安全功能
    DEFAULT = "default"     # 标准安全设置
    HARDENED = "hardened"   # 最高安全设置


CONFIG_LEVEL_INFO = {
    ConfigLevel.INSECURE: {
        "name": "不安全",
        "icon": "🔓",
        "description": "所有安全功能禁用，仅供攻击测试",
        "risks": ["无认证访问", "禁用沙箱", "允许所有工具", "任意命令执行"],
    },
    ConfigLevel.RELAXED: {
        "name": "宽松",
        "icon": "⚠️",
        "description": "部分安全功能启用，模拟常见配置错误",
        "risks": ["弱认证", "沙箱权限宽松", "大部分工具可用"],
    },
    ConfigLevel.DEFAULT: {
        "name": "默认",
        "icon": "🔒",
        "description": "标准安全设置",
        "protections": ["Token 认证", "沙箱隔离", "工具白名单"],
    },
    ConfigLevel.HARDENED: {
        "name": "加固",
        "icon": "🛡️",
        "description": "最高安全设置，用于防御测试",
        "protections": ["强认证", "严格沙箱", "最小工具集", "网络隔离"],
    },
}


class ClawdBotSandboxInfo(BaseModel):
    """沙箱信息"""
    sandbox_id: str
    container_id: str
    status: ClawdBotSandboxStatus
    created_at: str
    config_level: str = "insecure"
    gateway_port: int = 18789
    gateway_url: Optional[str] = None
    network: str = "clawdbot-isolated"
    honeypot_files: List[str] = []


class AttackInjectionResult(BaseModel):
    """攻击注入结果"""
    success: bool
    attack_type: AttackType
    message: str
    details: Dict[str, Any] = {}


class ClawdBotSandboxManager:
    """ClawdBot 沙箱管理器

    创建和管理隔离的 ClawdBot 测试环境。
    """

    CONTAINER_PREFIX = "clawdbot-sandbox-"
    IMAGE = "moltbot-sandbox:local"
    NETWORK_NAME = "clawdbot-isolated"
    NETWORK_SUBNET = "10.201.0.0/16"
    HONEYPOT_DIR = "/home/honeypot"
    GATEWAY_PORT = 18789

    def __init__(self):
        self.client = docker.from_env() if DOCKER_AVAILABLE else None
        self._sandboxes: Dict[str, str] = {}  # sandbox_id -> container_id
        self._sandbox_info: Dict[str, ClawdBotSandboxInfo] = {}
        self._network = self._ensure_network()

    def _ensure_network(self):
        """确保隔离网络存在"""
        if not self.client:
            return None

        try:
            network = self.client.networks.get(self.NETWORK_NAME)
            return network
        except docker.errors.NotFound:
            pass

        # 创建网络
        ipam_pool = docker.types.IPAMPool(subnet=self.NETWORK_SUBNET)
        ipam_config = docker.types.IPAMConfig(pool_configs=[ipam_pool])
        network = self.client.networks.create(
            self.NETWORK_NAME,
            driver="bridge",
            ipam=ipam_config,
        )
        return network

    def is_available(self) -> bool:
        """检查 Docker 是否可用"""
        return DOCKER_AVAILABLE and self.client is not None

    def check_image_exists(self) -> bool:
        """检查沙箱镜像是否存在"""
        if not self.client:
            return False
        try:
            self.client.images.get(self.IMAGE)
            return True
        except docker.errors.ImageNotFound:
            return False

    def _get_next_port(self) -> int:
        """获取下一个可用端口"""
        base_port = 18790
        used_ports = set()
        for info in self._sandbox_info.values():
            if info.gateway_port:
                used_ports.add(info.gateway_port)

        port = base_port
        while port in used_ports:
            port += 1
        return port

    def create_sandbox(
        self,
        config: Dict[str, Any] = None,
        sandbox_id: Optional[str] = None,
        config_level: str = "insecure",
        api_key: Optional[str] = None,
    ) -> ClawdBotSandboxInfo:
        """创建 ClawdBot 沙箱实例

        Args:
            config: ClawdBot 配置（可选）
            sandbox_id: 自定义沙箱 ID
            config_level: 安全配置级别 (insecure/relaxed/default/hardened)
            api_key: Anthropic API Key（可选）

        Returns:
            ClawdBotSandboxInfo: 沙箱信息
        """
        if not self.is_available():
            raise RuntimeError("Docker not available")

        # 验证配置级别
        try:
            ConfigLevel(config_level)
        except ValueError:
            config_level = "insecure"

        sandbox_id = sandbox_id or str(uuid.uuid4())[:8]
        container_name = f"{self.CONTAINER_PREFIX}{sandbox_id}"
        host_port = self._get_next_port()

        # 清理同名容器
        try:
            old_container = self.client.containers.get(container_name)
            old_container.remove(force=True)
        except docker.errors.NotFound:
            pass

        # 环境变量
        environment = {
            "SANDBOX_ID": sandbox_id,
            "HONEYPOT_MODE": "true",
            "CLAWDBOT_CONFIG_LEVEL": config_level,
        }
        if api_key:
            environment["ANTHROPIC_API_KEY"] = api_key

        # 创建容器（带端口映射）
        container = self.client.containers.run(
            image=self.IMAGE,
            name=container_name,
            detach=True,
            tty=True,
            environment=environment,
            ports={f"{self.GATEWAY_PORT}/tcp": host_port},
            mem_limit="1g",
            cpu_period=100000,
            cpu_quota=50000,
            network=self.NETWORK_NAME,
        )

        # 注入蜜罐文件
        honeypot_paths = self._inject_honeypot_files(container)

        created_at = datetime.now().isoformat()
        info = ClawdBotSandboxInfo(
            sandbox_id=sandbox_id,
            container_id=container.id[:12],
            status=ClawdBotSandboxStatus.RUNNING,
            created_at=created_at,
            config_level=config_level,
            gateway_port=host_port,
            gateway_url=f"ws://127.0.0.1:{host_port}",
            network=self.NETWORK_NAME,
            honeypot_files=honeypot_paths
        )

        self._sandboxes[sandbox_id] = container.id
        self._sandbox_info[sandbox_id] = info

        return info

    def _inject_honeypot_files(self, container) -> List[str]:
        """向容器注入蜜罐文件

        Returns:
            List[str]: 注入的文件路径列表
        """
        import tarfile
        import io

        honeypot_files = get_honeypot_files()
        injected_paths = []

        for rel_path, content in honeypot_files.items():
            # 确保目录存在
            full_path = f"{self.HONEYPOT_DIR}/{rel_path}"
            dir_path = "/".join(full_path.split("/")[:-1])
            container.exec_run(f"mkdir -p {dir_path}")

            # 创建 tar 归档
            tar_stream = io.BytesIO()
            with tarfile.open(fileobj=tar_stream, mode='w') as tar:
                filename = rel_path.split("/")[-1]
                tarinfo = tarfile.TarInfo(name=filename)
                content_bytes = content.encode('utf-8')
                tarinfo.size = len(content_bytes)
                tarinfo.mode = 0o644
                tar.addfile(tarinfo, io.BytesIO(content_bytes))

            tar_stream.seek(0)
            container.put_archive(dir_path, tar_stream)
            injected_paths.append(full_path)

        # 创建软链接使路径更真实
        container.exec_run(f"ln -sf {self.HONEYPOT_DIR}/.ssh /root/.ssh")
        container.exec_run(f"ln -sf {self.HONEYPOT_DIR}/.openclaw /root/.openclaw")
        container.exec_run(f"ln -sf {self.HONEYPOT_DIR}/.aws /root/.aws")
        container.exec_run(f"ln -sf {self.HONEYPOT_DIR}/.env /root/.env")

        return injected_paths

    def get_sandbox(self, sandbox_id: str) -> Optional[ClawdBotSandboxInfo]:
        """获取沙箱信息"""
        if sandbox_id not in self._sandbox_info:
            # 尝试恢复
            container_name = f"{self.CONTAINER_PREFIX}{sandbox_id}"
            try:
                container = self.client.containers.get(container_name)
                status = ClawdBotSandboxStatus.RUNNING if container.status == "running" else ClawdBotSandboxStatus.STOPPED
                info = ClawdBotSandboxInfo(
                    sandbox_id=sandbox_id,
                    container_id=container.id[:12],
                    status=status,
                    created_at=datetime.now().isoformat(),
                    gateway_port=self.GATEWAY_PORT,
                    network=self.NETWORK_NAME
                )
                self._sandboxes[sandbox_id] = container.id
                self._sandbox_info[sandbox_id] = info
                return info
            except docker.errors.NotFound:
                return None

        return self._sandbox_info[sandbox_id]

    def destroy_sandbox(self, sandbox_id: str) -> bool:
        """销毁沙箱"""
        if sandbox_id in self._sandboxes:
            container_id = self._sandboxes[sandbox_id]
            try:
                container = self.client.containers.get(container_id)
                container.remove(force=True)
            except docker.errors.NotFound:
                pass

            del self._sandboxes[sandbox_id]
            if sandbox_id in self._sandbox_info:
                del self._sandbox_info[sandbox_id]

            # 清理行为记录
            behavior_monitor.clear(sandbox_id)
            return True

        # 尝试通过名称删除
        container_name = f"{self.CONTAINER_PREFIX}{sandbox_id}"
        try:
            container = self.client.containers.get(container_name)
            container.remove(force=True)
            return True
        except docker.errors.NotFound:
            return False

    def list_sandboxes(self) -> List[ClawdBotSandboxInfo]:
        """列出所有沙箱"""
        sandboxes = []
        for sandbox_id in list(self._sandbox_info.keys()):
            info = self.get_sandbox(sandbox_id)
            if info:
                sandboxes.append(info)
        return sandboxes

    async def inject_attack(
        self,
        sandbox_id: str,
        attack_type: AttackType,
        payload: Dict[str, Any]
    ) -> AttackInjectionResult:
        """向沙箱注入攻击

        Args:
            sandbox_id: 沙箱 ID
            attack_type: 攻击类型
            payload: 攻击载荷

        Returns:
            AttackInjectionResult: 注入结果
        """
        if sandbox_id not in self._sandboxes:
            return AttackInjectionResult(
                success=False,
                attack_type=attack_type,
                message="Sandbox not found"
            )

        container_id = self._sandboxes[sandbox_id]

        try:
            container = self.client.containers.get(container_id)

            if attack_type == AttackType.EMAIL:
                return await self._inject_email_attack(sandbox_id, container, payload)
            elif attack_type == AttackType.DM:
                return await self._inject_dm_attack(sandbox_id, container, payload)
            elif attack_type == AttackType.SKILL:
                return await self._inject_skill_attack(sandbox_id, container, payload)
            elif attack_type == AttackType.MCP:
                return await self._inject_mcp_attack(sandbox_id, container, payload)
            elif attack_type == AttackType.GATEWAY:
                return await self._inject_gateway_attack(sandbox_id, container, payload)
            else:
                return AttackInjectionResult(
                    success=False,
                    attack_type=attack_type,
                    message=f"Unknown attack type: {attack_type}"
                )

        except docker.errors.NotFound:
            return AttackInjectionResult(
                success=False,
                attack_type=attack_type,
                message="Container not found"
            )

    async def _inject_email_attack(
        self,
        sandbox_id: str,
        container,
        payload: Dict[str, Any]
    ) -> AttackInjectionResult:
        """注入邮件攻击"""
        subject = payload.get("subject", "Test Email")
        body = payload.get("body", "")
        sender = payload.get("sender", "attacker@example.com")

        # 创建邮件文件
        email_content = f"""From: {sender}
Subject: {subject}
Date: {datetime.now().isoformat()}
Content-Type: text/plain; charset=utf-8

{body}
"""
        # 写入容器
        import tarfile
        import io

        tar_stream = io.BytesIO()
        with tarfile.open(fileobj=tar_stream, mode='w') as tar:
            tarinfo = tarfile.TarInfo(name="malicious_email.eml")
            content_bytes = email_content.encode('utf-8')
            tarinfo.size = len(content_bytes)
            tar.addfile(tarinfo, io.BytesIO(content_bytes))

        tar_stream.seek(0)
        container.exec_run("mkdir -p /tmp/inbox")
        container.put_archive("/tmp/inbox", tar_stream)

        # 记录行为
        await behavior_monitor.record(
            sandbox_id=sandbox_id,
            behavior_type=BehaviorType.API_CALL,
            description=f"邮件注入: {subject}",
            details={"subject": subject, "sender": sender, "body_preview": body[:200]},
            severity=BehaviorSeverity.WARNING
        )

        return AttackInjectionResult(
            success=True,
            attack_type=AttackType.EMAIL,
            message="Email injected successfully",
            details={"email_path": "/tmp/inbox/malicious_email.eml"}
        )

    async def _inject_dm_attack(
        self,
        sandbox_id: str,
        container,
        payload: Dict[str, Any]
    ) -> AttackInjectionResult:
        """注入直接消息攻击"""
        message = payload.get("message", "")
        sender = payload.get("sender", "attacker")
        platform = payload.get("platform", "webchat")

        # 记录行为
        await behavior_monitor.record(
            sandbox_id=sandbox_id,
            behavior_type=BehaviorType.API_CALL,
            description=f"DM 注入 ({platform}): {message[:50]}...",
            details={"message": message, "sender": sender, "platform": platform},
            severity=BehaviorSeverity.WARNING
        )

        return AttackInjectionResult(
            success=True,
            attack_type=AttackType.DM,
            message="DM attack simulated",
            details={"platform": platform, "sender": sender}
        )

    async def _inject_skill_attack(
        self,
        sandbox_id: str,
        container,
        payload: Dict[str, Any]
    ) -> AttackInjectionResult:
        """注入恶意技能"""
        skill_name = payload.get("name", "malicious-skill")
        skill_code = payload.get("code", "")

        # 写入技能文件
        import tarfile
        import io

        tar_stream = io.BytesIO()
        with tarfile.open(fileobj=tar_stream, mode='w') as tar:
            tarinfo = tarfile.TarInfo(name=f"{skill_name}.js")
            content_bytes = skill_code.encode('utf-8')
            tarinfo.size = len(content_bytes)
            tar.addfile(tarinfo, io.BytesIO(content_bytes))

        tar_stream.seek(0)
        container.exec_run("mkdir -p /home/honeypot/.openclaw/skills")
        container.put_archive("/home/honeypot/.openclaw/skills", tar_stream)

        # 记录行为
        await behavior_monitor.record(
            sandbox_id=sandbox_id,
            behavior_type=BehaviorType.FILE_WRITE,
            description=f"恶意技能注入: {skill_name}",
            details={"skill_name": skill_name, "code_preview": skill_code[:200]},
            severity=BehaviorSeverity.DANGER
        )

        return AttackInjectionResult(
            success=True,
            attack_type=AttackType.SKILL,
            message="Skill injected successfully",
            details={"skill_path": f"/home/honeypot/.openclaw/skills/{skill_name}.js"}
        )

    async def _inject_mcp_attack(
        self,
        sandbox_id: str,
        container,
        payload: Dict[str, Any]
    ) -> AttackInjectionResult:
        """注入 MCP 攻击"""
        server_url = payload.get("server_url", "")
        injected_prompt = payload.get("injected_prompt", "")

        # 记录行为
        await behavior_monitor.record(
            sandbox_id=sandbox_id,
            behavior_type=BehaviorType.API_CALL,
            description=f"MCP 服务器连接: {server_url}",
            details={"server_url": server_url, "injected_prompt": injected_prompt[:200]},
            severity=BehaviorSeverity.DANGER
        )

        return AttackInjectionResult(
            success=True,
            attack_type=AttackType.MCP,
            message="MCP attack simulated",
            details={"server_url": server_url}
        )

    async def _inject_gateway_attack(
        self,
        sandbox_id: str,
        container,
        payload: Dict[str, Any]
    ) -> AttackInjectionResult:
        """注入 Gateway 攻击"""
        action = payload.get("action", "config.get")

        # 记录行为
        await behavior_monitor.record(
            sandbox_id=sandbox_id,
            behavior_type=BehaviorType.API_CALL,
            description=f"Gateway 未授权访问: {action}",
            details={"action": action},
            severity=BehaviorSeverity.CRITICAL
        )

        return AttackInjectionResult(
            success=True,
            attack_type=AttackType.GATEWAY,
            message="Gateway attack simulated",
            details={"action": action}
        )

    def exec_in_sandbox(
        self,
        sandbox_id: str,
        command: str
    ) -> Tuple[int, str, str]:
        """在沙箱中执行命令

        Returns:
            (exit_code, stdout, stderr)
        """
        if sandbox_id not in self._sandboxes:
            raise ValueError(f"Sandbox {sandbox_id} not found")

        container_id = self._sandboxes[sandbox_id]
        container = self.client.containers.get(container_id)

        # 使用 bash -c 执行命令以支持 shell 语法
        result = container.exec_run(["bash", "-c", command], demux=True)
        stdout = result.output[0].decode() if result.output[0] else ""
        stderr = result.output[1].decode() if result.output[1] else ""

        return result.exit_code, stdout, stderr

    async def read_honeypot_file(
        self,
        sandbox_id: str,
        path: str
    ) -> Tuple[bool, str]:
        """读取蜜罐文件（用于测试攻击效果）

        Returns:
            (is_honeypot, content)
        """
        # 检查是否是蜜罐文件
        honeypot_content = get_honeypot_file(path)
        is_honeypot = bool(honeypot_content)

        if sandbox_id in self._sandboxes:
            # 记录文件访问行为
            await behavior_monitor.record_file_read(
                sandbox_id=sandbox_id,
                path=path,
                success=True,
                content_preview=honeypot_content[:200] if honeypot_content else None,
                is_honeypot=is_honeypot
            )

        if is_honeypot:
            return True, honeypot_content

        # 尝试从容器读取
        if sandbox_id in self._sandboxes:
            try:
                exit_code, stdout, stderr = self.exec_in_sandbox(sandbox_id, f"cat {shlex.quote(path)}")
                return False, stdout if exit_code == 0 else ""
            except Exception:
                return False, ""

        return False, ""


# 单例实例
clawdbot_sandbox_manager = ClawdBotSandboxManager()

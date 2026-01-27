# 开发与部署工作流

## 架构图

```
┌─────────────────────────────────────────────────────────────┐
│                         服务器                               │
├─────────────────────────────┬───────────────────────────────┤
│       开发环境 (本地进程)     │      生产环境 (Docker)         │
├─────────────────────────────┼───────────────────────────────┤
│                             │                               │
│   npm run dev → :5173       │   ┌─── nginx ───┐             │
│         ↓                   │   │   :5175     │             │
│   localhost:8000 ←──────────│───│ 前端静态文件 │← 外网访问    │
│         ↓                   │   │ 反向代理    │             │
│   python backend            │   └──────┬──────┘             │
│                             │          ↓                    │
│                             │   ┌── backend ──┐             │
│                             │   │ 内部 :8000  │             │
│                             │   │ Docker SDK  │             │
│                             │   └──────┬──────┘             │
│                             │          ↓                    │
│                             │   /var/run/docker.sock        │
│                             │                               │
└─────────────────────────────┴───────────────────────────────┘
                                         ↓
                              ┌─── sandbox 容器 ───┐
                              │ terminal-python    │
                              │ file-parser 等     │
                              └────────────────────┘
```

## 两个环境对比

| 项目 | 开发环境 | 生产环境 |
|------|---------|---------|
| 前端端口 | :5173 | :5175 |
| 后端端口 | :8000 (宿主机) | :8000 (容器内部) |
| 启动方式 | npm run dev + python | ./deploy.sh |
| 代码变更 | 热更新 | 需重新构建 |
| 用途 | 本地开发调试 | 外网访问演示 |

## 操作步骤

### 日常开发

```bash
# 终端 1: 前端
npm run dev

# 终端 2: 后端
cd backend && ./run.sh
```

访问 http://localhost:5173

### 部署生产

```bash
# 一键部署
./deploy.sh
```

输出示例：
```
=== 环境检测 ===
Docker: Docker version 24.0.5
Compose: Docker Compose version v2.20.2
Docker GID: 998

=== 开始构建 ===
...

=== 部署完成 ===
本机: http://localhost:5175
外网: http://192.168.1.100:5175
```

### 更新生产

```bash
# 代码修改后，重新构建
./deploy.sh

# 只更新前端
docker compose up -d --build frontend

# 只更新后端
docker compose up -d --build backend
```

### 查看日志

```bash
# 所有服务
docker compose logs -f

# 只看后端
docker compose logs -f backend
```

### 停止生产

```bash
docker compose down
```

## 端口说明

生产环境使用 5175 端口而非标准 80 端口，原因：

1. **80 端口限制**：国内机房、校园网常封锁 80 端口，未备案域名无法使用
2. **免备案**：使用非标准端口可绕过 ICP 备案要求

### VS Code Remote SSH 端口转发

如果通过 VS Code Remote SSH 连接服务器开发：
- 可使用 VS Code 的端口转发功能访问远程服务
- 在 VS Code 底部「端口」面板添加 5175 端口
- 本地访问 `http://localhost:5175` 即可

### 更换端口

如需使用其他端口，修改以下两处：

1. `docker-compose.yml` 第 9 行：
   ```yaml
   ports:
     - "新端口:80"
   ```

2. `deploy.sh` 第 42-43 行的 URL

## 沙箱网络隔离

沙箱容器运行在独立的 Docker 网络 `poc-sandbox-isolated`（子网 10.200.0.0/16）中。需要在宿主机上配置 iptables 规则，阻止容器访问内网：

```bash
# 应用规则（需要 root 权限）
sudo bash backend/setup-sandbox-network.sh

# 移除规则
sudo bash backend/setup-sandbox-network.sh --remove
```

规则写入 DOCKER-USER 链，阻止沙箱子网访问 RFC 1918 私有地址和链路本地地址（含云元数据 169.254.169.254），但保留公网访问。

**持久化**：iptables 规则在宿主机重启后丢失，需通过以下方式之一持久化：
- `apt install iptables-persistent` 并 `netfilter-persistent save`
- 创建 systemd 服务在启动时运行脚本
- 加入 `/etc/rc.local`

## 注意事项

1. **两环境可同时运行**：端口不冲突，互不影响
2. **代码隔离**：改本地代码不影响已部署的生产环境
3. **sandbox 镜像**：首次部署需确保 `terminal-python:3.11` 等镜像已构建
4. **沙箱网络隔离**：首次部署后需运行 `setup-sandbox-network.sh` 配置 iptables 规则

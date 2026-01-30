#!/bin/bash
# 创建 ClawdBot 专用隔离网络
# 策略：允许外网访问（测试数据外泄），阻止内网私有 IP
#
# 注意：此脚本需要 root 权限运行

set -e

NETWORK_NAME="clawdbot-isolated"
SUBNET="10.201.0.0/16"

echo "=== Setting up ClawdBot Isolated Network ==="
echo ""
echo "Network: $NETWORK_NAME"
echo "Subnet: $SUBNET"
echo "Policy: External network ALLOWED, Internal network BLOCKED"
echo ""

# 检查是否为 root
if [ "$EUID" -ne 0 ]; then
    echo "Warning: This script requires root privileges for iptables rules."
    echo "Docker network will be created, but iptables rules may fail."
    echo ""
fi

# 创建 Docker 网络（如果不存在）
if docker network inspect "$NETWORK_NAME" >/dev/null 2>&1; then
    echo "Network '$NETWORK_NAME' already exists."
else
    echo "Creating Docker network '$NETWORK_NAME'..."
    docker network create \
        --driver bridge \
        --subnet "$SUBNET" \
        "$NETWORK_NAME"
    echo "Network created."
fi

echo ""
echo "=== Configuring iptables rules ==="

# 检查 DOCKER-USER 链是否存在
if ! iptables -L DOCKER-USER >/dev/null 2>&1; then
    echo "Warning: DOCKER-USER chain not found. Docker may not be properly configured."
    echo "Skipping iptables rules."
    exit 0
fi

# 清理旧规则（如果存在）
echo "Cleaning up old rules..."
iptables -D DOCKER-USER -s "$SUBNET" -d "$SUBNET" -j ACCEPT 2>/dev/null || true
iptables -D DOCKER-USER -s "$SUBNET" -d 10.0.0.0/8 -j DROP 2>/dev/null || true
iptables -D DOCKER-USER -s "$SUBNET" -d 172.16.0.0/12 -j DROP 2>/dev/null || true
iptables -D DOCKER-USER -s "$SUBNET" -d 192.168.0.0/16 -j DROP 2>/dev/null || true
iptables -D DOCKER-USER -s "$SUBNET" -d 127.0.0.0/8 -j DROP 2>/dev/null || true
iptables -D DOCKER-USER -s "$SUBNET" -d 169.254.0.0/16 -j DROP 2>/dev/null || true

# 添加新规则
echo "Adding iptables rules..."

# 允许容器间通信（同一网络内）
iptables -I DOCKER-USER -s "$SUBNET" -d "$SUBNET" -j ACCEPT

# 阻止访问 RFC 1918 私有地址
# 10.0.0.0/8（但排除自身网络 10.201.0.0/16）
iptables -I DOCKER-USER -s "$SUBNET" -d 10.0.0.0/8 -j DROP

# 172.16.0.0/12
iptables -I DOCKER-USER -s "$SUBNET" -d 172.16.0.0/12 -j DROP

# 192.168.0.0/16
iptables -I DOCKER-USER -s "$SUBNET" -d 192.168.0.0/16 -j DROP

# 本地回环地址
iptables -I DOCKER-USER -s "$SUBNET" -d 127.0.0.0/8 -j DROP

# 链路本地地址
iptables -I DOCKER-USER -s "$SUBNET" -d 169.254.0.0/16 -j DROP

# 重新允许自身网络（优先级高于上面的 10.0.0.0/8 规则）
iptables -I DOCKER-USER -s "$SUBNET" -d "$SUBNET" -j ACCEPT

echo ""
echo "=== Setup Complete ==="
echo ""
echo "Current DOCKER-USER rules for $SUBNET:"
iptables -L DOCKER-USER -n | grep -E "10\.201\." || echo "(no specific rules found)"
echo ""
echo "To test network isolation:"
echo "  1. Create a sandbox: POST /clawdbot/sandbox"
echo "  2. Exec in container: docker exec <container> curl https://httpbin.org/ip"
echo "  3. Verify internal blocked: docker exec <container> curl 192.168.1.1 (should fail)"
echo ""
echo "To remove rules, run: $0 --cleanup"

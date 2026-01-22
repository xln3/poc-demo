#!/bin/bash
set -e

echo "=== 环境检测 ==="

# 检测 Docker
if ! command -v docker &> /dev/null; then
    echo "错误: Docker 未安装"
    exit 1
fi
echo "Docker: $(docker --version)"

# 检测 Docker Compose
if command -v docker-compose &> /dev/null; then
    COMPOSE_CMD="docker-compose"
    echo "Compose: $(docker-compose --version)"
elif docker compose version &> /dev/null; then
    COMPOSE_CMD="docker compose"
    echo "Compose: $(docker compose version)"
else
    echo "错误: Docker Compose 未安装"
    exit 1
fi

# 检测 Docker GID
DOCKER_GID=$(getent group docker | cut -d: -f3)
if [ -z "$DOCKER_GID" ]; then
    echo "错误: 找不到 docker 组"
    exit 1
fi
echo "Docker GID: $DOCKER_GID"

echo ""
echo "=== 开始构建 ==="

# 导出环境变量并启动
export DOCKER_GID
$COMPOSE_CMD up -d --build "$@"

echo ""
echo "=== 部署完成 ==="
echo "本机: http://localhost:5175"
echo "外网: http://$(hostname -I | awk '{print $1}'):5175"

#!/bin/bash
# 构建 ClawdBot/Moltbot 安全测试沙箱镜像
# 包含真实的 OpenClaw agent

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

IMAGE_NAME="moltbot-sandbox:local"
OPENCLAW_DIR="/mnt/data1/workspace/xln/2026Jan/openclaw"

echo "=== Building ClawdBot/Moltbot Sandbox Image ==="
echo "Image: $IMAGE_NAME"
echo ""

# 检查 openclaw 目录
if [ ! -d "$OPENCLAW_DIR" ]; then
    echo "Error: OpenClaw directory not found at $OPENCLAW_DIR"
    exit 1
fi

echo "OpenClaw source: $OPENCLAW_DIR"

# 检查 openclaw 是否已构建
if [ ! -d "$OPENCLAW_DIR/dist" ]; then
    echo "Error: OpenClaw not built. Run 'pnpm build' in $OPENCLAW_DIR first."
    exit 1
fi

# 准备 openclaw-dist 目录
echo "Preparing openclaw-dist..."
rm -rf openclaw-dist
mkdir -p openclaw-dist

# 使用 npm pack 创建 tarball，然后解压（这样只包含 files 字段指定的内容）
echo "Packing OpenClaw..."
cd "$OPENCLAW_DIR"
npm pack --pack-destination "$SCRIPT_DIR/openclaw-dist" 2>/dev/null

cd "$SCRIPT_DIR/openclaw-dist"
tar -xzf openclaw-*.tgz
mv package/* .
rm -rf package openclaw-*.tgz

# 安装生产依赖
echo "Installing production dependencies (this may take a while)..."
npm install --omit=dev --ignore-scripts 2>&1 | tail -5

cd "$SCRIPT_DIR"

echo ""
echo "Building Docker image..."
docker build \
    -f Dockerfile.moltbot-sandbox \
    -t "$IMAGE_NAME" \
    .

# 清理临时文件
echo "Cleaning up..."
rm -rf openclaw-dist

echo ""
echo "=== Build Complete ==="
echo "Image: $IMAGE_NAME"
echo ""
echo "Available config levels (CLAWDBOT_CONFIG_LEVEL):"
echo "  - insecure  : All security disabled (for attack testing)"
echo "  - relaxed   : Partial security (common misconfigurations)"
echo "  - default   : Standard security settings"
echo "  - hardened  : Maximum security (for defense testing)"
echo ""
echo "Run with:"
echo "  docker run -d --name clawdbot-test -p 18789:18789 \\"
echo "    -e CLAWDBOT_CONFIG_LEVEL=insecure \\"
echo "    -e ANTHROPIC_API_KEY=your-key \\"
echo "    $IMAGE_NAME"

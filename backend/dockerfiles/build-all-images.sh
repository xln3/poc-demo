#!/bin/bash

# ============================================
# 构建所有容器镜像
# ============================================
#
# 用法:
#   bash dockerfiles/build-all-images.sh            # 构建所有镜像
#   bash dockerfiles/build-all-images.sh file-parser # 只构建file-parser
#   bash dockerfiles/build-all-images.sh terminal    # 构建所有terminal镜像
#
# 注意: 必须在 backend/ 目录下执行

set -e  # 遇到错误立即退出

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 检查是否在backend目录
if [ ! -d "dockerfiles" ]; then
    echo -e "${RED}错误: 请在 backend/ 目录下执行此脚本${NC}"
    exit 1
fi

# 解析参数
BUILD_TARGET="${1:-all}"

# 定义镜像列表
declare -A IMAGES=(
    ["file-parser"]="file-parser:latest|Dockerfile.file-parser|文件解析容器"
    ["terminal-python"]="terminal-python:3.11|Dockerfile.terminal-python|终端运行容器(Python)"
    ["terminal-ubuntu"]="terminal-ubuntu:22.04|Dockerfile.terminal-ubuntu|终端运行容器(Ubuntu)"
    ["terminal-node"]="terminal-node:20|Dockerfile.terminal-node|终端运行容器(Node.js)"
    ["rag-server"]="rag-server:latest|Dockerfile.rag-server|RAG检索容器"
    ["mcp-server"]="mcp-server:latest|Dockerfile.mcp-server|MCP工具容器"
)

# 函数: 构建单个镜像
build_image() {
    local key=$1
    local info="${IMAGES[$key]}"

    IFS='|' read -r tag dockerfile description <<< "$info"

    echo ""
    echo -e "${BLUE}========================================${NC}"
    echo -e "${BLUE}🐳 构建镜像: ${YELLOW}$tag${NC}"
    echo -e "${BLUE}   描述: $description${NC}"
    echo -e "${BLUE}========================================${NC}"

    # 构建命令
    if docker build \
        -f "dockerfiles/$dockerfile" \
        -t "$tag" \
        --progress=plain \
        . ; then
        echo -e "${GREEN}✓ 镜像构建成功: $tag${NC}"

        # 显示镜像信息
        IMAGE_SIZE=$(docker images "$tag" --format "{{.Size}}" | head -n 1)
        IMAGE_ID=$(docker images "$tag" --format "{{.ID}}" | head -n 1)
        echo -e "${GREEN}  镜像ID: $IMAGE_ID${NC}"
        echo -e "${GREEN}  镜像大小: $IMAGE_SIZE${NC}"
    else
        echo -e "${RED}✗ 镜像构建失败: $tag${NC}"
        return 1
    fi
}

# 主逻辑
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}开始构建容器镜像${NC}"
echo -e "${GREEN}========================================${NC}"

FAILED_IMAGES=()
BUILT_IMAGES=()

case "$BUILD_TARGET" in
    "all")
        echo -e "${YELLOW}将构建所有6个镜像...${NC}"
        for key in "${!IMAGES[@]}"; do
            if build_image "$key"; then
                BUILT_IMAGES+=("$key")
            else
                FAILED_IMAGES+=("$key")
            fi
        done
        ;;

    "file-parser")
        build_image "file-parser" && BUILT_IMAGES+=("file-parser") || FAILED_IMAGES+=("file-parser")
        ;;

    "terminal")
        echo -e "${YELLOW}将构建所有终端沙箱镜像...${NC}"
        for key in "terminal-python" "terminal-ubuntu" "terminal-node"; do
            if build_image "$key"; then
                BUILT_IMAGES+=("$key")
            else
                FAILED_IMAGES+=("$key")
            fi
        done
        ;;

    "rag")
        build_image "rag-server" && BUILT_IMAGES+=("rag-server") || FAILED_IMAGES+=("rag-server")
        ;;

    "mcp")
        build_image "mcp-server" && BUILT_IMAGES+=("mcp-server") || FAILED_IMAGES+=("mcp-server")
        ;;

    *)
        echo -e "${RED}未知的构建目标: $BUILD_TARGET${NC}"
        echo -e "${YELLOW}用法:${NC}"
        echo "  $0              # 构建所有镜像"
        echo "  $0 file-parser  # 构建文件解析容器"
        echo "  $0 terminal     # 构建所有终端容器"
        echo "  $0 rag          # 构建RAG容器"
        echo "  $0 mcp          # 构建MCP容器"
        exit 1
        ;;
esac

# 汇总结果
echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}构建完成${NC}"
echo -e "${GREEN}========================================${NC}"

if [ ${#BUILT_IMAGES[@]} -gt 0 ]; then
    echo -e "${GREEN}✓ 成功构建 ${#BUILT_IMAGES[@]} 个镜像:${NC}"
    for img in "${BUILT_IMAGES[@]}"; do
        echo -e "${GREEN}  - $img${NC}"
    done
fi

if [ ${#FAILED_IMAGES[@]} -gt 0 ]; then
    echo -e "${RED}✗ 失败 ${#FAILED_IMAGES[@]} 个镜像:${NC}"
    for img in "${FAILED_IMAGES[@]}"; do
        echo -e "${RED}  - $img${NC}"
    done
    exit 1
fi

echo ""
echo -e "${BLUE}查看所有镜像:${NC}"
echo "  docker images | grep -E '(file-parser|terminal-|rag-server|mcp-server)'"

echo ""
echo -e "${BLUE}测试镜像:${NC}"
echo "  docker run --rm file-parser:latest python3 -c 'import fitz; print(\"file-parser OK\")'"
echo "  docker run --rm terminal-python:3.11 python --version"
echo "  docker run --rm terminal-ubuntu:22.04 uname -a"
echo "  docker run --rm terminal-node:20 node --version"
echo "  docker run --rm rag-server:latest python3 -c 'import chromadb; print(\"rag-server OK\")'"
echo "  docker run --rm mcp-server:latest python3 -c 'import psycopg2; print(\"mcp-server OK\")'"

#!/bin/bash
# 清理后端残留进程

PORT=8000

echo "🔍 检查 $PORT 端口进程..."
PIDS=$(lsof -t -i :$PORT 2>/dev/null)

if [ -z "$PIDS" ]; then
    echo "✅ $PORT 端口无残留进程"
else
    echo "🧹 发现进程: $PIDS"
    echo "⏳ 正在清理..."
    kill -9 $PIDS 2>/dev/null
    sleep 1

    # 再次检查
    REMAINING=$(lsof -t -i :$PORT 2>/dev/null)
    if [ -z "$REMAINING" ]; then
        echo "✅ 清理完成"
    else
        echo "⚠️ 仍有残留进程: $REMAINING"
        echo "   请手动执行: kill -9 $REMAINING"
    fi
fi

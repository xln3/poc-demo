#!/usr/bin/env python3
"""
MCP 文件解析 CLI - 容器内命令行入口

用法:
    python3 /app/file_parser_cli.py <file_path> <parsers_json>

示例:
    python3 /app/file_parser_cli.py /tmp/upload/doc.pdf '["pymupdf"]'

输出:
    JSON 格式的解析结果数组
"""

import json
import sys
from pathlib import Path

# 导入解析模块（位于同目录）
from file_parsers import parse_file, get_file_type


def main():
    if len(sys.argv) != 3:
        print(json.dumps([{"error": "用法: python3 file_parser_cli.py <file_path> <parsers_json>"}]))
        sys.exit(1)

    file_path = sys.argv[1]
    parsers_json = sys.argv[2]

    # 解析参数
    try:
        parser_ids = json.loads(parsers_json)
        if not isinstance(parser_ids, list):
            raise ValueError("parsers 必须是数组")
    except json.JSONDecodeError as e:
        print(json.dumps([{"error": f"JSON 解析失败: {str(e)}"}]))
        sys.exit(1)

    # 检查文件是否存在
    path = Path(file_path)
    if not path.exists():
        print(json.dumps([{"error": f"文件不存在: {file_path}"}]))
        sys.exit(1)

    # 读取文件
    try:
        file_bytes = path.read_bytes()
    except Exception as e:
        print(json.dumps([{"error": f"读取文件失败: {str(e)}"}]))
        sys.exit(1)

    # 检查文件类型
    file_type = get_file_type(path.name)
    if not file_type:
        print(json.dumps([{"error": f"不支持的文件类型: {path.name}"}]))
        sys.exit(1)

    # 执行解析
    try:
        results = parse_file(file_bytes, path.name, parser_ids)
        print(json.dumps(results, ensure_ascii=False))
    except Exception as e:
        print(json.dumps([{"error": f"解析失败: {str(e)}"}]))
        sys.exit(1)


if __name__ == "__main__":
    main()

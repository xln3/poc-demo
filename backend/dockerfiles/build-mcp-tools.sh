#!/bin/bash
# 构建 MCP-tools 镜像

set -e

cd "$(dirname "$0")/.."

echo "🐳 构建 MCP-tools Docker 镜像..."
docker build \
  -f docker/Dockerfile.mcp-tools \
  -t mcp-tools:latest \
  .

echo "✅ MCP-tools 镜像构建完成！"
echo ""
echo "镜像信息："
docker images mcp-tools:latest
echo ""
echo "验证解析器："
docker run --rm mcp-tools:latest python3 -c "
import sys
print('Python:', sys.version.split()[0])
import fitz; print('✓ PyMuPDF')
import pdfplumber; print('✓ pdfplumber')
import pytesseract; print('✓ pytesseract')
from docx import Document; print('✓ python-docx')
import mammoth; print('✓ mammoth')
from openpyxl import load_workbook; print('✓ openpyxl')
from PIL import Image; print('✓ Pillow')
"

#!/bin/bash
# 构建 File Parser 镜像

set -e

cd "$(dirname "$0")/.."

echo "🐳 构建 File Parser Docker 镜像..."
docker build \
  -f dockerfiles/Dockerfile.file-parser \
  -t file-parser:latest \
  .

echo "✅ File Parser 镜像构建完成！"
echo ""
echo "镜像信息："
docker images file-parser:latest
echo ""
echo "验证解析器："
docker run --rm file-parser:latest python3 -c "
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

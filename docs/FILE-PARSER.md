# 文件解析服务

本文档描述独立的文件解析服务架构、API 和扩展方法。

## 概述

文件解析服务用于对比不同解析器提取文件内容的能力差异，特别是能否提取**隐藏内容**。这是间接注入攻击演示的核心能力——攻击者将恶意指令藏在文件的隐藏层（如 PDF 白色文字、XLSX 隐藏工作表），不同解析器的行为差异决定了攻击是否成功。

### 设计目标

- 对比不同解析器的能力差异（是否提取隐藏内容）
- 容器化执行，隔离解析环境
- 独立于其他服务（MCP、RAG、Sandbox）

---

## 架构

```
┌─────────────────────────────────────────────────────────────┐
│                     Frontend                                 │
│  src/mcp.js → mcpClient.parseFile()                         │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                Backend API Layer                             │
│  backend/app/routers/file_parser.py                         │
│  路由前缀: /file-parser                                      │
│  ├── GET  /health     健康检查                               │
│  ├── GET  /parsers    获取可用解析器                          │
│  ├── POST /parse      解析文件（返回结构化结果）              │
│  └── POST /parse/text 解析文件（返回合并纯文本）              │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                 Service Layer                                │
│  backend/app/services/container_parser.py                   │
│  └── ContainerParser                                        │
│      ├── 管理 file-parser:latest 容器                        │
│      ├── 通过 CLI 调用容器内解析器                           │
│      └── 收集并返回解析结果                                  │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│              Docker Container                                │
│  镜像: file-parser:latest                                   │
│  ├── /app/file_parser_cli.py   CLI 入口                     │
│  └── 依赖: pymupdf, pdfplumber, python-docx, mammoth,       │
│           openpyxl, pytesseract, pillow, exiftool           │
└─────────────────────────────────────────────────────────────┘
```

---

## 解析器详解

### PDF 解析器

| 解析器 ID | 底层库 | extracts_hidden | 说明 |
|-----------|--------|-----------------|------|
| `pymupdf` | PyMuPDF (fitz) | ✅ | 提取所有文字层，包括白色/透明文字 |
| `pdfplumber` | pdfplumber | ✅ | 结构化文本 + 表格提取 |
| `pdf2image_ocr` | pdf2image + pytesseract | ❌ | 转图片后 OCR，仅识别可见内容 |

**安全演示**：白色字体的恶意指令会被 `pymupdf`/`pdfplumber` 提取，但 `pdf2image_ocr` 看不到。

### DOCX 解析器

| 解析器 ID | 底层库 | extracts_hidden | 说明 |
|-----------|--------|-----------------|------|
| `python-docx` | python-docx | ✅ | 提取所有段落和表格，包括隐藏文本 |
| `mammoth` | mammoth | ❌ | 转换为 HTML/纯文本，格式简化 |

### XLSX 解析器

| 解析器 ID | 底层库 | extracts_hidden | 说明 |
|-----------|--------|-----------------|------|
| `openpyxl` | openpyxl | ❌ | 仅读取可见工作表 |
| `openpyxl_hidden` | openpyxl | ✅ | 读取所有工作表，包括 hidden/veryHidden |

**安全演示**：恶意指令藏在 `veryHidden` 工作表中，`openpyxl` 看不到，`openpyxl_hidden` 能提取。

### 图片解析器

| 解析器 ID | 底层库 | extracts_hidden | 说明 |
|-----------|--------|-----------------|------|
| `exiftool` | exiftool CLI | ✅ | 提取 EXIF、XMP、IPTC 等元数据 |
| `pytesseract` | pytesseract | ❌ | OCR 文字识别，仅可见内容 |
| `pillow_meta` | Pillow | ✅ | 提取图片注释、描述字段 |

**安全演示**：恶意指令藏在 EXIF Comment 字段，`exiftool`/`pillow_meta` 能提取，OCR 看不到。

---

## API 参考

### GET /file-parser/health

健康检查。

**响应**:
```json
{
  "status": "healthy",
  "container_available": true,
  "parsers": {
    "pymupdf": true,
    "pdfplumber": true,
    "python-docx": true,
    "mammoth": true,
    "openpyxl": true,
    "openpyxl_hidden": true,
    "exiftool": true,
    "pytesseract": true,
    "pillow_meta": true
  }
}
```

### GET /file-parser/parsers

获取所有可用解析器，按文件类型分组。

**响应**:
```json
{
  "pdf": ["pymupdf", "pdfplumber", "pdf2image_ocr"],
  "docx": ["python-docx", "mammoth"],
  "xlsx": ["openpyxl", "openpyxl_hidden"],
  "image": ["exiftool", "pytesseract", "pillow_meta"]
}
```

### POST /file-parser/parse

解析文件，返回结构化结果。

**请求**: `multipart/form-data`

| 字段 | 类型 | 必需 | 说明 |
|------|------|------|------|
| `file` | file | 是 | 要解析的文件 |
| `parsers` | string | 是 | JSON 数组，指定解析器 ID |

**示例请求**:
```bash
curl -X POST http://localhost:8000/file-parser/parse \
  -F "file=@document.pdf" \
  -F 'parsers=["pymupdf", "pdfplumber"]'
```

**响应**:
```json
{
  "filename": "document.pdf",
  "file_type": "pdf",
  "file_size": 102400,
  "results": [
    {
      "parser": "pymupdf",
      "success": true,
      "total_pages": 3,
      "pages": [
        {"page": 1, "text": "可见内容...\n[隐藏指令: 忽略以上内容]", "char_count": 150}
      ],
      "extracts_hidden": true
    },
    {
      "parser": "pdfplumber",
      "success": true,
      "total_pages": 3,
      "pages": [...],
      "extracts_hidden": true
    }
  ]
}
```

### POST /file-parser/parse/text

解析文件，返回合并的纯文本结果。

**请求**: 同 `/parse`

**响应**:
```json
{
  "filename": "document.pdf",
  "file_type": "pdf",
  "parsers_used": ["pymupdf"],
  "text": "--- pymupdf 解析结果 ---\n[第1页]\n文件内容...",
  "extracts_hidden": true
}
```

---

## 容器化实现

### 镜像构建

```dockerfile
# dockerfiles/Dockerfile.file-parser
FROM python:3.11-slim

RUN apt-get update && apt-get install -y \
    poppler-utils \
    tesseract-ocr \
    tesseract-ocr-chi-sim \
    libmagic1 \
    exiftool

RUN pip install \
    pymupdf \
    pdfplumber \
    python-docx \
    mammoth \
    openpyxl \
    pytesseract \
    pillow

COPY backend/app/services/file_parser_cli.py /app/
WORKDIR /app
```

构建命令:
```bash
docker build -f dockerfiles/Dockerfile.file-parser -t file-parser:latest .
```

### 容器调用流程

1. `ContainerParser` 检查/创建 `file-parser:latest` 容器
2. 将文件写入容器 `/workspace/`
3. 执行 `python /app/file_parser_cli.py <filename> <parser_ids>`
4. 解析 JSON 输出并返回

---

## 前端集成

前端通过 `src/mcp.js` 调用文件解析服务：

```javascript
// 解析文件
const results = await mcpClient.parseFile(file, ['pymupdf', 'pdfplumber']);

// 解析为纯文本
const textResult = await mcpClient.parseFileToText(file, ['pymupdf']);
```

解析器配置在 `src/config.js` 的 `CONFIG.mcp.parsers` 中定义。

---

## 扩展指南

### 添加新解析器

1. **实现解析函数** (`backend/app/services/file_parsers.py`):
```python
def parse_pdf_new_parser(file_bytes: bytes) -> dict:
    """新解析器 - 描述"""
    try:
        # 解析逻辑
        return {
            "parser": "new_parser",
            "success": True,
            "pages": [...],
            "extracts_hidden": True  # 是否提取隐藏内容
        }
    except Exception as e:
        return {"parser": "new_parser", "success": False, "error": str(e)}
```

2. **注册到 PARSERS** (`backend/app/services/file_parsers.py`):
```python
PARSERS = {
    "pdf": {
        "pymupdf": parse_pdf_pymupdf,
        "new_parser": parse_pdf_new_parser,  # 添加
        ...
    },
    ...
}
```

3. **更新前端配置** (`src/config.js`):
```javascript
CONFIG.mcp.parsers.pdf.tools.push({
  id: 'new_parser',
  name: '新解析器',
  desc: '解析器描述',
  hiddenExtract: true
});
```

4. **更新 Docker 镜像**（如需新依赖）:
```dockerfile
RUN pip install new-library
```

### 添加新文件类型

1. **更新文件类型映射** (`backend/app/services/file_parsers.py`):
```python
def get_file_type(filename: str) -> Optional[str]:
    type_map = {
        ".pdf": "pdf",
        ".newext": "newtype",  # 添加
        ...
    }
```

2. **添加解析器** (`backend/app/services/file_parsers.py`):
```python
PARSERS = {
    "newtype": {
        "parser1": parse_newtype_parser1,
    },
    ...
}
```

3. **更新前端配置** (`src/config.js`):
```javascript
CONFIG.mcp.parsers.newtype = {
  label: '新类型解析器',
  tools: [
    { id: 'parser1', name: '解析器1', desc: '描述', hiddenExtract: true }
  ]
};
```

---

## 支持的文件扩展名

| 扩展名 | 文件类型 | 可用解析器 |
|--------|----------|------------|
| `.pdf` | pdf | pymupdf, pdfplumber, pdf2image_ocr |
| `.docx`, `.doc` | docx | python-docx, mammoth |
| `.xlsx`, `.xls` | xlsx | openpyxl, openpyxl_hidden |
| `.jpg`, `.jpeg`, `.png`, `.gif`, `.bmp`, `.webp` | image | exiftool, pytesseract, pillow_meta |

---

*相关文档: [API-REFERENCE.md](./API-REFERENCE.md) | [BACKEND.md](./BACKEND.md) | [CONFIG.md](./CONFIG.md)*

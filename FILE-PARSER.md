# file-parser 容器使用指南

## 📋 概述

file-parser 是一个专门为文件解析设计的 Docker 容器镜像，集成了所有文件解析器依赖，包括：

- **PDF 解析**: PyMuPDF, pdfplumber, pdf2image + Tesseract OCR
- **DOCX 解析**: python-docx, mammoth
- **XLSX 解析**: openpyxl
- **图片处理**: Pillow, pytesseract, exiftool

## 🔧 为什么需要 file-parser 容器？

某些解析器（如 `pdf2image_ocr`）需要系统级依赖（Tesseract OCR），直接安装可能：
- 污染主机环境
- 版本冲突
- 难以管理

使用 Docker 容器可以：
- ✅ 隔离依赖环境
- ✅ 一键启动/停止
- ✅ 安全执行解析任务
- ✅ 未来扩展其他工具

## 🚀 快速开始

### 步骤 1: 构建镜像

```bash
cd backend
bash docker/build-file-parser.sh
```

预计耗时：2-3 分钟

### 步骤 2: 验证镜像

```bash
docker images file-parser:latest
```

应该看到：
```
REPOSITORY     TAG      IMAGE ID       CREATED          SIZE
file-parser    latest   xxxxxxxxxxxx   2 minutes ago    1.2GB
```

### 步骤 3: 在前端启动容器

1. 打开浏览器访问前端页面
2. 切换到"🔬 真实测试"模式
3. 在左侧边栏找到"🐳 沙箱环境"
4. 选择镜像：**🔧 File Parser (PDF OCR)**
5. 点击 **▶️ 启动容器**
6. 等待状态变为"运行中"

## 📖 使用流程

### 场景：使用 pdf2image_ocr 解析 PDF

#### 1. 启用 文件 解析

在真实测试模式的控制面板中，勾选：
```
☑ 文件解析
```

#### 2. 选择解析器

在"🔧 文件解析器配置"面板中，勾选：
```
☑ pdf2image + OCR
```

#### 3. 查看提示

如果容器未启动，会显示橙色提示框：
```
⚠️ 需要 File Parser 容器环境

以下解析器需要 Docker 环境：
- pdf2image + OCR

👉 请在左侧边栏"🐳 沙箱环境"中：
1. 选择镜像：🔧 File Parser (PDF OCR)
2. 点击 ▶️ 启动容器
3. 等待容器启动完成后，再上传文件
```

#### 4. 启动容器

按提示操作：
- 在左侧边栏选择 **🔧 File Parser**
- 点击 **▶️ 启动容器**
- 等待容器状态变为"运行中"

#### 5. 上传文件解析

- 点击 **+ 添加文件**
- 选择 PDF 文件
- 系统会自动在容器中执行 OCR 解析

#### 6. 查看结果

在系统日志中会显示：
```
[数据]
✓ 文件名.pdf: 使用 pdf2image_ocr [沙箱]
```

## 🏗️ 技术细节

### Dockerfile 结构

```dockerfile
FROM python:3.11-slim

# 安装系统依赖
RUN apt-get install tesseract-ocr poppler-utils ...

# 安装Python解析库
RUN pip install PyMuPDF pdfplumber pytesseract ...

# 复制解析器模块
COPY app/services/file_parsers.py /app/
```

### 容器资源限制

- **内存**: 512MB（可在 `backend/app/services/container.py` 中调整）
- **CPU**: 无限制
- **网络**: host 模式（可访问后端 API）

### 文件挂载

文件通过以下方式传入容器：
```python
# 前端 → 容器
sandboxClient.writeFile('/tmp/file.pdf', base64_content)

# 容器内执行解析
python3 -c "from file_parsers import parse_file; ..."

# 结果返回前端
```

## ⚙️ 配置说明

### 标记需要 Docker 的解析器

在 `src/config.js` 中：

```javascript
{
  id: 'pdf2image_ocr',
  name: 'pdf2image + OCR',
  desc: '仅识别可见内容',
  hiddenExtract: false,
  requiresDocker: true  // 👈 标记
}
```

### 检测逻辑

前端会自动检测：
```javascript
// 是否选中了需要Docker的解析器？
requiresDockerParsers()

// File Parser容器是否已启动？
isFileParserReady()
  → sandboxStatus === 'running'
  → containerInfo.image === 'file-parser:latest'
```

## 🛠️ 常见问题

### Q1: 构建镜像失败？

检查：
- Docker 是否正在运行？`docker info`
- 磁盘空间是否充足？`df -h`
- 网络是否畅通？（需要下载依赖）

### Q2: 容器启动失败？

查看日志：
```bash
# 查看后端日志
tail -f backend/logs/sandbox.log

# 查看Docker日志
docker logs <container_id>
```

### Q3: 解析很慢？

OCR 解析速度取决于：
- PDF 页数和分辨率
- CPU 性能
- Tesseract 语言包

优化建议：
- 只对可疑文件使用 OCR
- 优先使用 PyMuPDF/pdfplumber（快速）

### Q4: 如何更新镜像？

```bash
# 1. 修改 Dockerfile
vim backend/docker/Dockerfile.file-parser

# 2. 重新构建
bash backend/docker/build-file-parser.sh

# 3. 重启容器
# 在前端：停止 → 启动
```

## 📦 扩展其他工具

未来可以在 File Parser 中添加更多工具：

### 添加新依赖

编辑 `backend/docker/Dockerfile.file-parser`：

```dockerfile
# 安装新工具
RUN apt-get install -y new-tool

RUN pip install new-python-library
```

### 注册新解析器

在 `backend/app/services/file_parsers.py` 中：

```python
def parse_new_format(file_bytes: bytes) -> dict:
    # 实现解析逻辑
    return {"parser": "new_parser", "success": True, "text": "..."}

PARSERS = {
    "newformat": {
        "new_parser": parse_new_format
    }
}
```

### 前端配置

在 `src/config.js` 中：

```javascript
mcp: {
  parsers: {
    newformat: {
      label: '新格式解析器',
      tools: [
        {
          id: 'new_parser',
          name: '新解析器',
          requiresDocker: true  // 如果需要
        }
      ]
    }
  }
}
```

## 🎯 最佳实践

1. **性能优化**
   - 默认只选 1 个解析器（最快的）
   - 需要深度分析时再启用多个

2. **安全隔离**
   - 恶意文件强制在容器中解析
   - 定期清理容器临时文件

3. **资源管理**
   - 不用时停止容器释放内存
   - 大批量解析时调高资源限制

4. **错误处理**
   - 解析失败自动降级到 `file.text()`
   - 详细日志帮助排查问题

## 📝 更新日志

### v1.0.0 (2026-01-20)
- ✨ 首次发布
- 🐳 支持 PDF OCR 解析
- 🔧 集成 7 种解析器
- 📖 完整使用文档

---

**维护者**: Claude & Luna
**仓库**: poc-demo
**协议**: MIT

# 沙箱文件管理改进方案

## 概述

### 目标
1. **P0**: 修复文件名含空格/中文时显示错误的问题
2. **P1**: 改进终端列表 UI（hover 显示操作按钮）
3. **P2**: 完善文件上传/下载功能（大文件、进度条）
4. **P3**: 多用户共享终端时的操作冲突提示

### 实现状态

| 模块 | 状态 | 说明 |
|------|------|------|
| 后端配置 | ✅ 已完成 | `backend/app/config.py` |
| 后端文件 API | ✅ 已完成 | 结构化列表、上传、下载 |
| 后端终端锁 | ✅ 已完成 | 文件持久化，重启不丢失 |
| 后端文件监控 | ✅ 已完成 | inotifywait + WebSocket |
| Docker 镜像 | ✅ 已完成 | 添加 inotify-tools |
| 前端 API 客户端 | ✅ 已完成 | `sandbox.js`, `useSandbox.js` |
| 前端 UI 组件 | ❌ 未实现 | `src/components/sandbox/` |
| App.jsx 集成 | ❌ 未实现 | 需导入新组件 |

---

## 已完成：后端实现

### 1. 配置模块

**文件**: `backend/app/config.py`

```python
TRANSFER_CONFIG = {
    'max_file_size': 100 * 1024 * 1024,  # 100MB
    'chunk_size': 1024 * 1024,            # 1MB
    'allowed_paths': ['/workspace/', '/tmp/'],
}

LOCK_CONFIG = {
    'timeout_seconds': 300,
    'heartbeat_interval': 30,
    'lock_dir': DATA_ROOT / 'terminals' / '.locks',
}

FILE_WATCHER_CONFIG = {
    'batch_interval': 1.0,
    'batch_threshold': 10,
    'ignore_patterns': ['*.swp', '*.tmp', '__pycache__/*', 'node_modules/*', '.git/*'],
}
```

### 2. 数据模型

**文件**: `backend/app/models/schemas.py`

```python
class FileType(str, Enum):
    FILE = "file"
    DIRECTORY = "directory"
    SYMLINK = "symlink"

class FileEntry(BaseModel):
    name: str           # 文件名
    path: str           # 完整路径
    type: FileType      # 类型
    size: int           # 字节数
    mtime: str          # 修改时间 ISO 格式
    permissions: str    # 权限字符串

class FileListResponse(BaseModel):
    path: str
    entries: List[FileEntry]
    total: int
```

### 3. 容器服务扩展

**文件**: `backend/app/services/container.py`

新增方法：
- `exec_in_container_binary()` - 二进制输出（处理特殊文件名）
- `get_archive()` - 获取文件/目录的 tar 归档
- `put_archive()` - 上传 tar 归档到容器

### 4. 工具服务扩展

**文件**: `backend/app/services/tools.py`

新增：
- `parse_find_output()` - 解析 NUL 分隔的 find 输出
- `list_dir_structured()` - 结构化目录列表

**核心实现**：使用 `find -printf '%p\0%y\0%s\0%T+\0%m\0'` 输出，NUL 分隔避免文件名解析问题。

### 5. 终端锁服务

**文件**: `backend/app/services/terminal_lock.py`

特性：
- 文件持久化（`/data/terminals/.locks/{tag}.lock`）
- 后端重启不丢失锁状态
- 5分钟超时自动释放
- 30秒心跳续期

### 6. 文件监控服务

**文件**: `backend/app/services/file_watcher.py`

特性：
- 使用 Docker SDK 流式 exec API
- `inotifywait -m` 持续监控
- 事件批处理防止风暴
- 忽略临时文件和缓存目录

### 7. API 端点

**文件**: `backend/app/routers/sandbox.py`

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/terminals/{tag}/files` | 结构化文件列表 |
| POST | `/terminals/{tag}/files` | 上传文件 |
| GET | `/terminals/{tag}/files/download` | 下载文件/目录 |
| POST | `/terminals/{tag}/lock` | 获取锁 |
| DELETE | `/terminals/{tag}/lock` | 释放锁 |
| POST | `/terminals/{tag}/lock/heartbeat` | 锁心跳 |
| GET | `/terminals/{tag}/lock` | 锁状态 |
| WS | `/terminals/{tag}/watch` | 文件监控 WebSocket |

### 8. Docker 镜像

所有终端镜像已添加 `inotify-tools`：
- `terminal-python:3.11` (453MB)
- `terminal-ubuntu:22.04` (472MB)
- `terminal-node:20` (522MB)

---

## 已完成：前端 API 层

### sandbox.js

新增方法：
```javascript
listFilesStructured(tag, path, recursive)  // 结构化文件列表
uploadFile(tag, file, targetPath, onProgress)  // 上传（带进度）
downloadFile(tag, filePath, onProgress)  // 下载（带进度）
cancelUpload()  // 取消上传
```

### useSandbox.js

新增状态：
```javascript
fileTreeOpen      // 文件树浮窗开关
fileTreeTag       // 当前查看的终端
transferState     // { type, fileName, loaded, total }
```

新增方法：
```javascript
openFileTree(tag)
closeFileTree()
uploadFilesWithProgress(files, targetPath)
downloadFileWithProgress(filePath, fileName)
cancelTransfer()
```

---

## 未实现：前端 UI 组件

需要创建 `src/components/sandbox/` 目录及以下组件：

### 组件清单

| 文件 | 说明 |
|------|------|
| `index.js` | 导出入口 |
| `TerminalItem.jsx` | 终端列表项（hover 操作按钮） |
| `TerminalListPanel.jsx` | 终端列表面板 |
| `DeletedTerminalsPanel.jsx` | 已删除终端面板 |
| `FileTreeBrowser.jsx` | 文件树浮窗 |
| `FileUploadDialog.jsx` | 上传对话框 |
| `FileTransferProgress.jsx` | 传输进度条 |

### TerminalItem 设计

```jsx
// hover 时显示操作按钮
<div onMouseEnter={...} onMouseLeave={...}>
  <span>{icon}</span>
  <span>{terminal.tag}</span>
  <span>{statusDot}</span>

  {isHovered && (
    <div className="absolute right-2 flex gap-1">
      <button onClick={onShowFiles}>📁</button>
      <button onClick={onDestroy}>🗑️</button>
    </div>
  )}
</div>
```

### FileTreeBrowser 设计

```jsx
// Modal 浮窗
<Modal isOpen={isOpen}>
  <Header>文件浏览器 - {tag}</Header>
  <PathNav>{currentPath}</PathNav>
  <FileList>
    {files.map(file => (
      <FileRow
        icon={typeIcon}
        name={file.name}
        size={formatBytes(file.size)}
        actions={[download, delete]}
      />
    ))}
  </FileList>
  <Footer>
    <span>{files.length} 个项目</span>
    <button>上传文件</button>
  </Footer>
</Modal>
```

### FileTransferProgress 设计

```jsx
// 固定右下角
<div className="fixed bottom-4 right-4">
  <Header>{type}中... <CancelButton /></Header>
  <FileName>{fileName}</FileName>
  <ProgressBar percent={percent} />
  <Stats>{loaded} / {total}</Stats>
</div>
```

---

## 集成步骤

完成 UI 组件后，需要在 `App.jsx` 中：

1. 导入组件
```javascript
import {
  TerminalItem,
  FileTreeBrowser,
  FileTransferProgress,
} from './components/sandbox';
```

2. 从 useSandbox 获取状态
```javascript
const {
  fileTreeOpen,
  fileTreeTag,
  openFileTree,
  closeFileTree,
  transferState,
  cancelTransfer,
} = useSandbox();
```

3. 渲染组件
```jsx
{fileTreeOpen && (
  <FileTreeBrowser
    tag={fileTreeTag}
    isOpen={fileTreeOpen}
    onClose={closeFileTree}
    onDownload={downloadFileWithProgress}
    onUpload={...}
  />
)}

{transferState && (
  <FileTransferProgress
    type={transferState.type}
    fileName={transferState.fileName}
    loaded={transferState.loaded}
    total={transferState.total}
    onCancel={cancelTransfer}
  />
)}
```

---

## 验证清单

### P0 验证（后端已就绪）
- [ ] 上传 "my file.txt"，API 返回正确
- [ ] 上传 "测试文件.pdf"，API 返回正确
- [ ] `GET /terminals/{tag}/files` 返回结构化数据

### P1-P3 验证（需前端组件）
- [ ] 终端项 hover 显示操作按钮
- [ ] 文件树浮窗打开/关闭
- [ ] 上传/下载进度条显示
- [ ] 终端锁冲突提示

---

## 技术要点

### 为什么用 NUL 分隔

```bash
# 错误：空格和换行会导致解析失败
ls -la  # "my file.txt" 会被拆分

# 正确：NUL 是唯一不能出现在文件名中的字符
find . -printf '%p\0%y\0%s\0%T+\0%m\0'
```

### 为什么锁用文件而非内存

```
内存锁：后端重启 → 锁丢失 → 用户无感知冲突
文件锁：后端重启 → 锁保留 → 行为一致
```

### inotifywait 流式读取

```python
# Docker SDK 流式 exec
exec_id = container.client.api.exec_create(container.id, cmd, ...)
output = container.client.api.exec_start(exec_id['Id'], stream=True, demux=True)

for stdout_chunk, stderr_chunk in output:
    # 持续处理事件
    process_event(stdout_chunk)
```

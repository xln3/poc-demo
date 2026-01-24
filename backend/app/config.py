"""后端全局配置"""

import os
from pathlib import Path

# 项目根目录
PROJECT_ROOT = Path(__file__).parent.parent.parent

# 数据目录
DATA_ROOT = PROJECT_ROOT.parent / 'poc-data'

# 文件传输配置
TRANSFER_CONFIG = {
    # 单文件大小限制 (100MB)
    'max_file_size': 100 * 1024 * 1024,
    # 分片大小 (1MB)
    'chunk_size': 1024 * 1024,
    # 上传超时 (5分钟)
    'upload_timeout': 300,
    # 下载超时 (5分钟)
    'download_timeout': 300,
    # 允许的路径前缀 (安全限制)
    'allowed_paths': ['/workspace', '/tmp'],
}

# 终端锁配置
LOCK_CONFIG = {
    # 锁超时时间 (5分钟)
    'timeout_seconds': 300,
    # 心跳间隔 (30秒)
    'heartbeat_interval': 30,
    # 锁文件存储目录
    'lock_dir': DATA_ROOT / 'terminals' / '.locks',
}

# 文件监控配置
FILE_WATCHER_CONFIG = {
    # 事件批处理间隔 (0.3秒)
    'batch_interval': 0.3,
    # 批处理阈值（超过此数量发送摘要）
    'batch_threshold': 10,
    # 忽略的文件模式
    'ignore_patterns': [
        '*.swp', '*.tmp', '*~',
        '__pycache__/*', '*.pyc',
        'node_modules/*', '.git/*',
    ],
}

# 确保锁目录存在
def ensure_lock_dir():
    """确保锁目录存在"""
    lock_dir = LOCK_CONFIG['lock_dir']
    lock_dir.mkdir(parents=True, exist_ok=True)
    return lock_dir

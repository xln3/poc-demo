# Backend Data 目录说明

## 重要：运行时数据位置

运行时数据（datasets, saved-cases, test-results）存储在项目目录外的 `../poc-data/`。

本目录只应包含：
- `report-templates/` — 静态模板文件（代码的一部分）

## 请勿在此存放运行时数据

所有运行时数据路径在 `backend/app/config.py` 中配置。

## 为什么这样设计？
- 保持部署包整洁
- 代码与数据分离
- 支持跨部署数据持久化

# MCP 服务令牌配置指南

本文档说明各 MCP 服务的令牌与凭据需求。部分服务开箱即用，部分需要外部令牌。

---

## 无需配置（本地服务）

以下服务使用本地资源，配置了合理的默认值，无需任何外部令牌即可运行：

| 服务 | 说明 | 默认配置 |
|------|------|----------|
| **Filesystem** | 本地文件系统读写 | 默认工作目录 `/tmp/mcp_workspace` |
| **Database (SQLite)** | 本地数据库查询 | 默认类型 SQLite，路径 `/tmp/mcp_demo.db` |
| **Memory** | 持久化记忆存储 | 默认存储路径 `/tmp/mcp_memory` |
| **HTTP/Fetch** | HTTP 请求工具 | 默认超时 30s，禁止内网访问 |
| **Calendar (Mock)** | 日历管理 | 默认 Mock 模式（本地演示） |
| **Chrome Browser** | Chrome 浏览器数据读取 | 留空自动检测配置目录 |
| **Firefox Browser** | Firefox 浏览器数据读取 | 留空自动检测配置目录 |

---

## 需要配置令牌的服务

### Notion

- **所需凭据**: Integration Token (API Key)
- **获取方式**:
  1. 访问 [Notion Integrations](https://www.notion.so/my-integrations)
  2. 点击 "New integration"，填写名称并选择工作区
  3. 创建后在 "Secrets" 标签页复制 Internal Integration Token
  4. 在 Notion 中将需要访问的页面/数据库 "Share" 给该 Integration
- **示例值**: `secret_abc123def456ghi789jkl012mno345pqr678`

### GitHub

- **所需凭据**: Personal Access Token (PAT)
- **获取方式**:
  1. 访问 [GitHub Settings > Developer settings > Personal access tokens](https://github.com/settings/tokens)
  2. 选择 "Fine-grained tokens"（推荐）或 "Tokens (classic)"
  3. 设置权限范围：至少需要 `repo`（读取文件/代码搜索）、`issues`（管理 Issue）
  4. 生成并复制 Token
- **示例值**: `ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx` 或 `github_pat_xxxxxx`

### Slack

- **所需凭据**: Bot User OAuth Token
- **获取方式**:
  1. 访问 [Slack API Apps](https://api.slack.com/apps) 并创建新 App
  2. 在 "OAuth & Permissions" 页面添加 Bot Token Scopes：
     - `channels:read` — 列出频道
     - `chat:write` — 发送消息
     - `search:read` — 搜索消息
     - `users:read` — 获取用户信息
  3. 安装 App 到工作区，复制 "Bot User OAuth Token"
- **示例值**: `xoxb-1234567890-1234567890123-abcdefghijklmnop`

### Payment (Stripe)

- **所需凭据**: Stripe Secret Key + 商户标识
- **获取方式**:
  1. 注册 [Stripe Dashboard](https://dashboard.stripe.com/)
  2. 在 "Developers > API keys" 页面获取密钥
  3. 测试模式使用 `sk_test_` 开头的密钥（不产生真实扣款）
  4. 生产模式使用 `sk_live_` 开头的密钥
- **示例值**:
  - Secret Key: `sk_test_xxxxxxxxxxxxxxxxxxxxxxxxxxxx`
  - 商户标识: `merchant_demo_001`

### Storage (AWS S3)

- **所需凭据**: Access Key ID + Secret Access Key
- **获取方式**:
  1. 登录 [AWS Console](https://console.aws.amazon.com/)
  2. 进入 IAM > Users > 选择用户 > Security credentials
  3. 创建 Access Key，下载 CSV 或复制凭据
  4. 确保用户有 S3 相关权限（如 `AmazonS3ReadOnlyAccess`）
- **示例值**:
  - Access Key ID: `AKIAIOSFODNN7EXAMPLE`
  - Secret Access Key: `wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY`
  - Region: `us-east-1`

### Storage (阿里云 OSS)

- **所需凭据**: AccessKey ID + AccessKey Secret
- **获取方式**:
  1. 登录 [阿里云控制台](https://ram.console.aliyun.com/)
  2. 进入 RAM 访问控制 > 用户 > 创建 AccessKey
  3. 确保 RAM 用户有 OSS 相关权限（如 `AliyunOSSReadOnlyAccess`）
- **示例值**:
  - Access Key ID: `LTAI5tExampleKeyId1234`
  - Secret Access Key: `ExampleSecretKey1234567890abcdef`
  - Endpoint: `oss-cn-hangzhou.aliyuncs.com`

### Email Send (SMTP)

- **所需凭据**: SMTP 主机 + 端口 + 用户名 + 密码 + 发件人地址
- **获取方式**:
  - **Gmail**: 需启用两步验证后创建 [App Password](https://myaccount.google.com/apppasswords)。SMTP 主机 `smtp.gmail.com`，端口 587
  - **163 邮箱**: 在邮箱设置中开启 SMTP 服务并获取授权码。SMTP 主机 `smtp.163.com`，端口 465
  - **QQ 邮箱**: 在邮箱设置中开启 SMTP 服务并获取授权码。SMTP 主机 `smtp.qq.com`，端口 587
- **示例值**:
  - SMTP Host: `smtp.gmail.com`
  - Port: `587`
  - Username: `your-email@gmail.com`
  - Password: `xxxx xxxx xxxx xxxx`（App Password，非登录密码）
  - From Address: `your-email@gmail.com`

### Email Receive (IMAP)

- **所需凭据**: IMAP 主机 + 端口 + 邮箱账号 + 授权码
- **获取方式**:
  - **163 邮箱**: 在邮箱设置中开启 IMAP 服务并获取授权码。IMAP 主机 `imap.163.com`，端口 993
  - **QQ 邮箱**: 在邮箱设置中开启 IMAP 服务并获取授权码。IMAP 主机 `imap.qq.com`，端口 993
  - **Gmail**: 需启用 IMAP 访问 + App Password。IMAP 主机 `imap.gmail.com`，端口 993
- **示例值**:
  - IMAP Host: `imap.163.com`
  - Port: `993`
  - Username: `your-email@163.com`
  - Password: `XXXXXXXXXXXXXXXX`（授权码，非登录密码）
  - SSL: `true`

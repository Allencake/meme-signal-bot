# Railway 部署指南

## 1. 准备代码

确保项目结构：
```
meme-signal-bot/
├── bot-simple.js      # Bot主程序
├── api-simple.js      # API服务器
├── public/
│   └── index.html     # 网站前端
├── package.json       # 依赖配置
├── data/              # 数据目录（自动创建）
└── README.md
```

## 2. 创建 GitHub 仓库

```bash
cd /root/.openclaw/workspace/projects/meme-signal-bot
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/你的用户名/meme-signal-bot.git
git push -u origin main
```

## 3. Railway 部署

### 3.1 注册/登录
- 访问 https://railway.app
- 用 GitHub 账号登录

### 3.2 创建项目
1. 点击 "New Project"
2. 选择 "Deploy from GitHub repo"
3. 选择你的 `meme-signal-bot` 仓库

### 3.3 配置环境变量
在 Railway 项目设置中添加：
```
TELEGRAM_BOT_TOKEN=8220505491:AAHYqwJPezQ0SPN3Ce_1mwUeml3JxrKQ_-8
PORT=3000
```

### 3.4 启动服务
Railway 会自动检测 package.json 并安装依赖。

需要手动添加启动命令：
1. 进入服务设置
2. 找到 "Start Command"
3. 输入：`node bot-simple.js & node api-simple.js`

或者创建 `Procfile`：
```
web: node api-simple.js
worker: node bot-simple.js
```

## 4. 验证部署

### 4.1 查看日志
在 Railway 控制台查看服务日志，确认 Bot 和 API 都启动成功。

### 4.2 测试 API
```bash
curl https://你的项目名.railway.app/api/stats
```

### 4.3 测试 Bot
给 Bot 发送测试消息，检查是否能正常接收。

## 5. 自定义域名（可选）

1. 在 Railway 项目设置中找到 "Domains"
2. 点击 "Generate Domain" 获取免费域名
3. 或添加自定义域名

## 6. 监控和维护

### 自动重启
Railway 会自动重启崩溃的服务。

### 查看日志
```bash
railway logs
```

### 更新部署
推送代码到 GitHub，Railway 会自动重新部署：
```bash
git add .
git commit -m "Update"
git push
```

## 7. 费用

Railway 免费额度：
- 每月 $5 免费额度
- 512 MB RAM
- 1 GB 磁盘
- 100 GB 出站流量

对于 Bot + API 足够使用。

## 8. 故障排查

### Bot 无法连接
- 检查 TELEGRAM_BOT_TOKEN 是否正确
- 查看 Railway 日志中的错误信息
- 确认 Bot 没有被 Telegram 封禁

### API 无法访问
- 检查 PORT 环境变量是否设置为 3000
- 确认 Railway 域名已正确配置
- 查看服务是否正常运行

### 数据丢失
- Railway 磁盘是临时的，重启会清空
- 建议定期备份 data/ 目录
- 或使用 Railway 的 Volume 功能持久化数据

## 9. 生产环境优化

### 使用 Railway Volume 持久化数据
1. 在 Railway 项目设置中添加 Volume
2. 挂载到 `/app/data`
3. 修改代码中的 DATA_DIR 为 `/app/data`

### 使用 Redis（可选）
如果数据量大，可以添加 Redis 服务：
1. 点击 "New" → "Database" → "Add Redis"
2. 获取 Redis URL
3. 修改代码使用 Redis 存储

### 监控告警
1. 在 Railway 设置中找到 "Monitoring"
2. 配置告警规则（CPU、内存、磁盘）

## 10. 备选方案

如果 Railway 不合适，还可以考虑：

### Render
- https://render.com
- 类似 Railway，有免费额度

### Fly.io
- https://fly.io
- 按使用量付费，有免费额度

### VPS（推荐长期使用）
- DigitalOcean、Vultr、Linode
- $5/月起，完全控制

---

**部署完成后：**
1. 在 Telegram 里搜索你的 Bot
2. 发送测试消息验证
3. 访问网站查看实时战绩
4. 配置消息转发从信号群到新 Bot
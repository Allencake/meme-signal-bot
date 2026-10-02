# Meme Signal Bot - 部署指南

## 部署选项

### 选项1: 本地测试（最快）

```bash
cd /root/.openclaw/workspace/projects/meme-signal-bot
npm install
read -r -s -p "Telegram Bot Token: " TELEGRAM_BOT_TOKEN; echo
export TELEGRAM_BOT_TOKEN
node bot.js
```

### 选项2: Railway部署（推荐）

1. 推送代码到GitHub
2. 连接Railway
3. 设置环境变量 `TELEGRAM_BOT_TOKEN`
4. 自动部署

### 选项3: VPS部署

```bash
# 安装Node.js 18+
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# 克隆项目
git clone <你的仓库>
cd meme-signal-bot

# 安装依赖
npm install

# 设置环境变量
read -r -s -p "Telegram Bot Token: " TELEGRAM_BOT_TOKEN; echo
export TELEGRAM_BOT_TOKEN

# 使用PM2启动
npm install -g pm2
pm2 start bot.js --name "meme-bot"
pm2 start api.js --name "meme-api"
pm2 save
pm2 startup
```

## 配置转发

在你的信号源群里，添加新Bot为管理员，设置消息转发：

```javascript
// 转发到新的追踪Bot
const TARGET_BOT = '@你的新Bot用户名';

// 或者在现有Bot里添加转发逻辑
```

## 验证部署

1. 给Bot发送测试消息
2. 检查数据库是否有记录
3. 访问网站看实时数据

## 下一步优化

- [ ] BSC链支持
- [ ] 更多时间维度统计
- [ ] Premium会员系统
- [ ] 告警通知（达到X倍时推送）
## 凭据安全

`YOUR_BOT_TOKEN` 只是占位符。真实 Token 必须由管理员在部署平台的私密环境变量设置中输入，或在服务器交互式终端中用上面的隐藏输入方式设置。不要放入源码、文档、聊天、命令历史或 Git。

本项目读取 `process.env.TELEGRAM_BOT_TOKEN`，不会自动加载 `.env` 文件。VPS/PM2 的持久化配置位置必须以当前运行服务为准；PM2 保存进程环境时也可能保存 Token，其配置和备份应仅允许部署用户读取。

如果 Token 曾公开，清理当前文件不会移除 Git 历史，也不会使旧 Token 失效。管理员必须亲自在 BotFather 撤销旧 Token，然后亲自在实际生产服务的私密配置中填入新 Token。确认配置和维护窗口后再重启现有进程，并验证机器人回复。不要另外启动一个轮询实例。

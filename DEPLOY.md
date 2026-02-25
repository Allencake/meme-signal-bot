# Meme Signal Bot - 部署指南

## 部署选项

### 选项1: 本地测试（最快）

```bash
cd /root/.openclaw/workspace/projects/meme-signal-bot
npm install
export TELEGRAM_BOT_TOKEN=8220505491:AAHYqwJPezQ0SPN3Ce_1mwUeml3JxrKQ_-8
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
echo "TELEGRAM_BOT_TOKEN=8220505491:AAHYqwJPezQ0SPN3Ce_1mwUeml3JxrKQ_-8" > .env

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
# Meme Signal Bot

Meme币信号追踪系统 - 自动接收CA、监控价格、统计涨幅、展示战绩

## 功能

- 🤖 Telegram Bot自动接收信号
- 📊 实时价格监控 (Solana via Jupiter)
- 📈 涨幅统计 (5min/15min/1h/4h/24h)
- 🌐 网站展示实时战绩
- 💾 SQLite数据持久化

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 配置环境变量

```bash
export TELEGRAM_BOT_TOKEN="你的Bot Token"
```

### 3. 创建数据目录

```bash
mkdir -p data
```

### 4. 启动Bot

```bash
npm start
```

### 5. 启动API服务器（另一个终端）

```bash
npm run api
```

### 6. 访问网站

打开 http://localhost:3000

## 部署

### Vercel部署API

```bash
npm i -g vercel
vercel --prod
```

### Railway部署Bot

1. 连接GitHub仓库
2. 设置环境变量 `TELEGRAM_BOT_TOKEN`
3. 启动服务

## 项目结构

```
meme-signal-bot/
├── bot.js          # Telegram Bot主程序
├── api.js          # API服务器
├── public/         # 网站前端
│   └── index.html
├── data/           # SQLite数据库
│   └── signals.db
├── package.json
└── README.md
```

## 数据来源格式

Bot会自动解析以下格式的TG消息：

```
🤑 最新看涨预测 | #SOLANA 🤑

✅ 代币：The Claudinator
📍 代币符号：$HAL9000
🏦 市值：26.58K
🏷 合约：A3XLb1tbaaPgkJijSCEmR6GhUM1ZBCyc59s2evXtUx5x
```

## API端点

- `GET /api/signals` - 获取所有信号
- `GET /api/signals/:ca` - 获取单个信号详情
- `GET /api/stats` - 统计数据
- `GET /api/performance?timeframe=24h` - 实时战绩

## 监控策略

- 每5分钟检查一次价格
- 记录关键时间点：5min, 15min, 1h, 4h, 24h
- 超过24小时自动停止监控

## 技术栈

- Node.js + Telegraf (Bot)
- Express (API)
- SQLite (数据库)
- Jupiter API (价格数据)
- 纯HTML/CSS/JS (前端)
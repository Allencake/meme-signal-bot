const { Telegraf } = require('telegraf');
const express = require('express');

const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);
const app = express();

// 简单的 test 命令
bot.command('test', (ctx) => {
    console.log('收到 /test');
    ctx.reply('✅ Bot 正常工作！');
});

// start 命令
bot.command('start', (ctx) => {
    console.log('收到 /start');
    ctx.reply('🚀 Bot 已启动！\n\n可用命令:\n/test - 测试\n/start - 开始\n/stats - 统计');
});

// stats 命令
bot.command('stats', (ctx) => {
    console.log('收到 /stats');
    ctx.reply('📊 统计功能开发中...');
});

// 处理普通消息 - 放在命令之后，且跳过命令
bot.on('message', (ctx) => {
    // 只处理文本消息
    if (!ctx.message.text) return;
    
    // 跳过命令
    if (ctx.message.text.startsWith('/')) {
        console.log('跳过命令:', ctx.message.text);
        return;
    }
    
    console.log('收到消息:', ctx.message.text);
    // 只回复包含 CA 的消息
    if (ctx.message.text.includes('合约：')) {
        ctx.reply('✅ 收到 CA 信号，正在处理...');
    }
});

// Express 处理 webhook
app.use(express.json());
app.post('/webhook', (req, res) => {
    bot.handleUpdate(req.body);
    res.sendStatus(200);
});

// 健康检查
app.get('/', (req, res) => {
    res.json({ status: 'ok' });
});

// 启动
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`服务器运行在端口 ${PORT}`);
    
    const webhookUrl = process.env.WEBHOOK_URL;
    if (webhookUrl) {
        bot.telegram.setWebhook(`${webhookUrl}/webhook`);
        console.log(`Webhook 已设置`);
    }
});
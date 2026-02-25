const { Telegraf } = require('telegraf');
const express = require('express');

const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);
const app = express();

// 简单的 test 命令
bot.command('test', (ctx) => {
    console.log('收到 /test');
    ctx.reply('✅ Webhook 模式正常工作！');
});

bot.command('start', (ctx) => {
    console.log('收到 /start');
    ctx.reply('🚀 Bot 已启动！\n\n发送 CA 信号，我会自动追踪。');
});

// Express 处理 webhook
app.use(express.json());
app.post('/webhook', (req, res) => {
    bot.handleUpdate(req.body);
    res.sendStatus(200);
});

// 健康检查
app.get('/', (req, res) => {
    res.json({ status: 'ok', bot: 'running' });
});

// 启动
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`服务器运行在端口 ${PORT}`);
    
    // 设置 webhook
    const webhookUrl = process.env.WEBHOOK_URL;
    if (webhookUrl) {
        bot.telegram.setWebhook(`${webhookUrl}/webhook`);
        console.log(`Webhook 已设置: ${webhookUrl}/webhook`);
    } else {
        console.log('没有 WEBHOOK_URL，使用 polling 模式');
        bot.launch();
    }
});
const express = require('express');
const app = express();

app.use(express.json());

app.post('/webhook', (req, res) => {
    console.log('收到 webhook:', JSON.stringify(req.body));
    
    const update = req.body;
    if (update.message && update.message.text) {
        const text = update.message.text;
        const chatId = update.message.chat.id;
        
        console.log('收到消息:', text, '来自:', chatId);
        
        // 简单回复
        if (text === '/test') {
            sendMessage(chatId, '✅ 测试成功！');
        } else if (text === '/start') {
            sendMessage(chatId, '🚀 Bot 已启动！');
        } else if (text === '/stats') {
            sendMessage(chatId, '📊 统计功能');
        }
    }
    
    res.sendStatus(200);
});

app.get('/', (req, res) => {
    res.json({ status: 'ok', time: new Date().toISOString() });
});

// 发送消息函数
function sendMessage(chatId, text) {
    const axios = require('axios');
    const token = process.env.TELEGRAM_BOT_TOKEN;
    const url = `https://api.telegram.org/bot${token}/sendMessage`;
    
    axios.post(url, {
        chat_id: chatId,
        text: text
    }).catch(err => console.error('发送消息失败:', err.message));
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`服务器运行在端口 ${PORT}`);
});
const express = require('express');
const axios = require('axios');
const app = express();

app.use(express.json());

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const API_URL = `https://api.telegram.org/bot${BOT_TOKEN}`;

// 发送消息
async function sendMessage(chatId, text, replyMarkup = null) {
    try {
        const data = {
            chat_id: chatId,
            text: text,
            parse_mode: 'HTML'
        };
        if (replyMarkup) {
            data.reply_markup = replyMarkup;
        }
        await axios.post(`${API_URL}/sendMessage`, data);
    } catch (err) {
        console.error('发送消息失败:', err.message);
    }
}

// 发送图片+文字+按钮
async function sendPhotoWithCaption(chatId, photoUrl, caption, replyMarkup = null) {
    try {
        const data = {
            chat_id: chatId,
            photo: photoUrl,
            caption: caption,
            parse_mode: 'HTML'
        };
        if (replyMarkup) {
            data.reply_markup = replyMarkup;
        }
        await axios.post(`${API_URL}/sendPhoto`, data);
    } catch (err) {
        console.error('发送图片失败:', err.message);
        // 如果图片发送失败，发送纯文字
        await sendMessage(chatId, caption, replyMarkup);
    }
}

// 主菜单键盘
function getMainMenuKeyboard() {
    return {
        inline_keyboard: [
            [
                { text: '📊 今日战绩', callback_data: 'today_stats' },
                { text: '🔥 热门信号', callback_data: 'hot_signals' }
            ],
            [
                { text: '📈 我的统计', callback_data: 'my_stats' },
                { text: '⚙️ 设置', callback_data: 'settings' }
            ],
            [
                { text: '💬 加入社区', url: 'https://t.me/your_community' }
            ]
        ]
    };
}

// 处理 webhook
app.post('/webhook', async (req, res) => {
    console.log('收到 webhook:', JSON.stringify(req.body));
    
    const update = req.body;
    
    // 处理消息
    if (update.message && update.message.text) {
        const text = update.message.text;
        const chatId = update.message.chat.id;
        const chatType = update.message.chat.type;
        
        console.log('收到消息:', text, '来自:', chatId, '类型:', chatType);
        
        // /start 命令
        if (text === '/start') {
            const welcomeText = `🚀 <b>金狗信号 Bot</b>\n\n` +
                `🎯 自动追踪 Meme 币信号\n` +
                `📊 实时价格监控\n` +
                `🔔 智能涨幅提醒\n\n` +
                `👇 选择功能:`;
            
            await sendMessage(chatId, welcomeText, getMainMenuKeyboard());
        }
        // /test 命令
        else if (text === '/test') {
            await sendMessage(chatId, '✅ Bot 正常工作！');
        }
        // /stats 命令
        else if (text === '/stats') {
            const statsText = `📊 <b>群组战绩统计</b>\n\n` +
                `📈 总信号数: 0\n` +
                `✅ 已完成: 0\n` +
                `🎯 胜率: 0%\n\n` +
                `💡 开始发送 CA 信号，Bot 会自动记录和追踪！`;
            
            await sendMessage(chatId, statsText, getMainMenuKeyboard());
        }
        // 处理 CA 信号
        else if (text.includes('合约：') || text.includes('CA:')) {
            await sendMessage(chatId, '✅ 收到 CA 信号，正在分析...');
        }
    }
    
    // 处理按钮回调
    if (update.callback_query) {
        const callbackData = update.callback_query.data;
        const chatId = update.callback_query.message.chat.id;
        const messageId = update.callback_query.message.message_id;
        
        console.log('收到按钮点击:', callbackData);
        
        let responseText = '';
        let keyboard = null;
        
        switch (callbackData) {
            case 'today_stats':
                responseText = `📊 <b>今日战绩</b>\n\n` +
                    `📈 总信号数: 0\n` +
                    `🎯 胜率: 0%\n` +
                    `💰 平均涨幅: 0x\n\n` +
                    `暂无数据，开始发送信号吧！`;
                keyboard = getMainMenuKeyboard();
                break;
                
            case 'hot_signals':
                responseText = `🔥 <b>热门信号</b>\n\n` +
                    `暂无热门信号\n\n` +
                    `💡 发送 CA 信号，Bot 会自动追踪涨幅！`;
                keyboard = getMainMenuKeyboard();
                break;
                
            case 'my_stats':
                responseText = `📈 <b>我的统计</b>\n\n` +
                    `个人统计功能开发中...`;
                keyboard = getMainMenuKeyboard();
                break;
                
            case 'settings':
                responseText = `⚙️ <b>设置</b>\n\n` +
                    `设置功能开发中...`;
                keyboard = getMainMenuKeyboard();
                break;
                
            default:
                responseText = '❓ 未知操作';
                keyboard = getMainMenuKeyboard();
        }
        
        // 编辑消息
        try {
            await axios.post(`${API_URL}/editMessageText`, {
                chat_id: chatId,
                message_id: messageId,
                text: responseText,
                parse_mode: 'HTML',
                reply_markup: keyboard
            });
        } catch (err) {
            console.error('编辑消息失败:', err.message);
        }
        
        // 回答回调
        try {
            await axios.post(`${API_URL}/answerCallbackQuery`, {
                callback_query_id: update.callback_query.id
            });
        } catch (err) {
            console.error('回答回调失败:', err.message);
        }
    }
    
    res.sendStatus(200);
});

// 健康检查
app.get('/', (req, res) => {
    res.json({ status: 'ok', time: new Date().toISOString() });
});

// API 端点
app.get('/api/stats', (req, res) => {
    res.json({ totalSignals: 0, monitoringSignals: 0 });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`服务器运行在端口 ${PORT}`);
});
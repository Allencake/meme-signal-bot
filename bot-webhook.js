const { Telegraf, Markup } = require('telegraf');
const express = require('express');
const fs = require('fs');
const path = require('path');
const { getTokenData, calculateReturns } = require('./price-api');
const { checkTokenSecurity, formatSecurityReport } = require('./security-check');

const DATA_DIR = path.join(__dirname, 'data');
const SIGNALS_FILE = path.join(DATA_DIR, 'signals.json');

if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
}

function loadData(file, defaultData = []) {
    try {
        if (fs.existsSync(file)) {
            return JSON.parse(fs.readFileSync(file, 'utf8'));
        }
    } catch (e) {}
    return defaultData;
}

function saveData(file, data) {
    fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

function parseMessage(text) {
    const lines = text.split('\n');
    const result = { chain: 'SOL', symbol: '', name: '', marketCap: 0, ca: '' };
    
    for (const line of lines) {
        if (line.includes('#SOLANA')) result.chain = 'SOL';
        if (line.includes('#BSC')) result.chain = 'BSC';
        if (line.includes('代币：')) result.name = line.split('代币：')[1].trim();
        if (line.includes('代币符号：')) result.symbol = line.split('代币符号：')[1].trim();
        if (line.includes('市值：')) {
            const mcText = line.split('市值：')[1].trim();
            result.marketCap = parseMarketCap(mcText);
        }
        if (line.includes('合约：')) result.ca = line.split('合约：')[1].trim();
    }
    
    return result.ca ? result : null;
}

function parseMarketCap(text) {
    const num = parseFloat(text);
    if (text.includes('K')) return num * 1000;
    if (text.includes('M')) return num * 1000000;
    if (text.includes('B')) return num * 1000000000;
    return num;
}

function formatNumber(num) {
    if (num >= 1e9) return (num / 1e9).toFixed(2) + 'B';
    if (num >= 1e6) return (num / 1e6).toFixed(2) + 'M';
    if (num >= 1e3) return (num / 1e3).toFixed(2) + 'K';
    return num.toFixed(2);
}

function formatPrice(price) {
    if (price < 0.000001) return price.toExponential(4);
    if (price < 0.01) return price.toFixed(8);
    return price.toFixed(6);
}

function generateButtons(ca, chain) {
    const buttons = [];
    if (chain === 'SOL') {
        buttons.push([
            Markup.button.url('📈 Chart', `https://dexscreener.com/solana/${ca}`),
            Markup.button.url('💰 Buy', `https://jup.ag/swap/USDC-${ca}`)
        ]);
        buttons.push([
            Markup.button.url('🔍 BullX', `https://bullx.io/terminal?chainId=1399811149&address=${ca}`),
            Markup.button.url('🛡️ Check', `https://rugcheck.xyz/tokens/${ca}`)
        ]);
    }
    return Markup.inlineKeyboard(buttons);
}

// 计算群组统计
function calculateGroupStats(chatId, timeframe = '24h') {
    const signals = loadData(SIGNALS_FILE);
    const groupSignals = signals.filter(s => s.chatId === chatId.toString());
    
    const now = Math.floor(Date.now() / 1000);
    const timeframes = { '24h': 86400, '7d': 604800, '30d': 2592000 };
    const cutoff = now - (timeframes[timeframe] || 86400);
    const recentSignals = groupSignals.filter(s => s.timestamp >= cutoff);
    
    const completed = recentSignals.filter(s => s.status === 'completed' || s.milestones?.['24h']);
    let winCount = 0;
    let totalReturn = 0;
    let bestCall = null;
    
    completed.forEach(s => {
        const returnX = s.milestones?.['24h']?.returnX || 1;
        if (returnX >= 2) winCount++;
        totalReturn += returnX;
        if (!bestCall || returnX > bestCall.returnX) {
            bestCall = { ...s, returnX };
        }
    });
    
    return {
        totalCalls: recentSignals.length,
        completed: completed.length,
        winRate: completed.length > 0 ? (winCount / completed.length * 100).toFixed(1) : 0,
        avgReturn: completed.length > 0 ? (totalReturn / completed.length).toFixed(2) : 0,
        bestCall,
        signals: recentSignals.sort((a, b) => b.timestamp - a.timestamp).slice(0, 5)
    };
}

// 格式化统计消息
function formatStatsMessage(stats, timeframe = '24h') {
    const timeLabel = { '24h': '24小时', '7d': '7天', '30d': '30天' }[timeframe] || '24小时';
    let message = `📊 <b>群组战绩统计 (${timeLabel})</b>\n\n`;
    message += `📈 总信号数: ${stats.totalCalls}\n`;
    message += `✅ 已完成: ${stats.completed}\n`;
    message += `🎯 胜率(2x+): ${stats.winRate}%\n`;
    message += `📊 平均涨幅: ${stats.avgReturn}x\n\n`;
    
    if (stats.bestCall) {
        message += `🏆 <b>最佳信号:</b> ${stats.bestCall.symbol} ${stats.bestCall.returnX.toFixed(2)}x\n\n`;
    }
    
    if (stats.signals.length > 0) {
        message += `📋 <b>最近信号:</b>\n`;
        stats.signals.forEach(s => {
            const returnX = s.milestones?.['24h']?.returnX || 0;
            const emoji = returnX >= 2 ? '🟢' : returnX >= 1 ? '⚪' : '🔴';
            message += `  ${emoji} ${s.symbol} ${returnX > 0 ? returnX.toFixed(2) + 'x' : '监控中'}\n`;
        });
    }
    return message;
}

// 创建 Bot
const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);
const app = express();

// /test 命令
bot.command('test', (ctx) => {
    console.log('收到 /test');
    ctx.reply('✅ Bot 正常工作！Chat ID: ' + ctx.chat.id);
});

// /start 命令
bot.command('start', async (ctx) => {
    console.log('>>> 收到 /start 命令', ctx.chat.id);
    try {
        const chatType = ctx.chat.type;
        if (chatType === 'private') {
            await ctx.reply('🚀 <b>Meme Signal Bot Pro</b>\n\n自动追踪 Meme 币信号，实时监控价格变化。\n\n👇 选择功能:', {
                parse_mode: 'HTML',
                ...Markup.inlineKeyboard([
                    [Markup.button.callback('📊 今日战绩', 'today_stats')],
                    [Markup.button.callback('🔥 热门信号', 'hot_signals')]
                ])
            });
        } else {
            const stats = calculateGroupStats(ctx.chat.id, '24h');
            await ctx.reply(formatStatsMessage(stats, '24h'), {
                parse_mode: 'HTML',
                ...Markup.inlineKeyboard([
                    [Markup.button.callback('📊 详细统计', 'detailed_stats')],
                    [Markup.button.callback('🔥 热门信号', 'hot_signals')]
                ])
            });
        }
    } catch (error) {
        console.error('/start 错误:', error);
        ctx.reply('❌ 出错了');
    }
});

// /stats 命令
bot.command('stats', async (ctx) => {
    console.log('收到 /stats');
    try {
        const stats = calculateGroupStats(ctx.chat.id, '24h');
        await ctx.reply(formatStatsMessage(stats, '24h'), {
            parse_mode: 'HTML',
            ...Markup.inlineKeyboard([
                [Markup.button.callback('📊 7天', 'stats_7d'), Markup.button.callback('📊 30天', 'stats_30d')]
            ])
        });
    } catch (error) {
        console.error('/stats 错误:', error);
        ctx.reply('❌ 出错了');
    }
});

// 按钮回调
bot.on('callback_query', async (ctx) => {
    const data = ctx.callbackQuery.data;
    const chatId = ctx.chat.id;
    
    try {
        if (data === 'today_stats' || data === 'detailed_stats') {
            const stats = calculateGroupStats(chatId, '24h');
            await ctx.editMessageText(formatStatsMessage(stats, '24h'), {
                parse_mode: 'HTML',
                ...Markup.inlineKeyboard([
                    [Markup.button.callback('📊 7天', 'stats_7d'), Markup.button.callback('📊 30天', 'stats_30d')]
                ])
            });
        }
        else if (data === 'stats_7d') {
            const stats = calculateGroupStats(chatId, '7d');
            await ctx.editMessageText(formatStatsMessage(stats, '7d'), {
                parse_mode: 'HTML',
                ...Markup.inlineKeyboard([
                    [Markup.button.callback('📊 24小时', 'today_stats'), Markup.button.callback('📊 30天', 'stats_30d')]
                ])
            });
        }
        else if (data === 'stats_30d') {
            const stats = calculateGroupStats(chatId, '30d');
            await ctx.editMessageText(formatStatsMessage(stats, '30d'), {
                parse_mode: 'HTML',
                ...Markup.inlineKeyboard([
                    [Markup.button.callback('📊 24小时', 'today_stats'), Markup.button.callback('📊 7天', 'stats_7d')]
                ])
            });
        }
        else if (data === 'hot_signals') {
            const signals = loadData(SIGNALS_FILE)
                .filter(s => s.chatId === chatId.toString())
                .sort((a, b) => {
                    const returnA = a.milestones?.['24h']?.returnX || 0;
                    const returnB = b.milestones?.['24h']?.returnX || 0;
                    return returnB - returnA;
                })
                .slice(0, 10);
            
            let message = '🔥 <b>热门信号 (涨幅排行)</b>\n\n';
            signals.forEach((s, idx) => {
                const returnX = s.milestones?.['24h']?.returnX || 0;
                const medal = idx < 3 ? ['🥇', '🥈', '🥉'][idx] : `${idx + 1}.`;
                message += `${medal} ${s.symbol} ${returnX > 0 ? returnX.toFixed(2) + 'x' : '监控中'}\n`;
            });
            
            await ctx.editMessageText(message, {
                parse_mode: 'HTML',
                ...Markup.inlineKeyboard([[Markup.button.callback('🔙 返回', 'today_stats')]])
            });
        }
        await ctx.answerCbQuery();
    } catch (error) {
        console.error('按钮错误:', error);
    }
});

// 处理消息（CA信号）- 放在命令之后
bot.on('text', async (ctx) => {
    // 跳过命令消息
    if (ctx.message.text.startsWith('/')) {
        return;
    }
    
    const text = ctx.message.text;
    const signal = parseMessage(text);
    
    if (signal) {
        console.log('收到信号:', signal);
        const signals = loadData(SIGNALS_FILE);
        
        if (signals.find(s => s.ca === signal.ca)) {
            return;
        }
        
        const newSignal = {
            ...signal,
            chatId: ctx.chat.id.toString(),
            timestamp: Math.floor(Date.now() / 1000),
            status: 'monitoring',
            milestones: {},
            alerts: []
        };
        
        signals.push(newSignal);
        saveData(SIGNALS_FILE, signals);
        
        // 获取实时数据
        const tokenData = await getTokenData(signal.ca);
        
        // 构建回复消息
        let message = `🚀 <b>${signal.name}</b> ${signal.symbol}\n`;
        message += `🔗 <code>${signal.ca}</code>\n\n`;
        
        if (tokenData) {
            const returns = calculateReturns(tokenData.price, signal.marketCap / 1e9);
            message += `💵 <b>价格:</b> $${formatPrice(tokenData.price)}\n`;
            message += `📊 <b>涨幅:</b> ${returns.x.toFixed(2)}x\n\n`;
            message += `📈 <b>价格变化:</b> 5m:${tokenData.priceChange.m5.toFixed(1)}% 1h:${tokenData.priceChange.h1.toFixed(1)}% 24h:${tokenData.priceChange.h24.toFixed(1)}%\n\n`;
            message += `💧 <b>流动性:</b> $${formatNumber(tokenData.liquidity)}\n`;
            message += `📊 <b>24h交易量:</b> $${formatNumber(tokenData.volume24h)}\n`;
            message += `🏦 <b>市值:</b> $${formatNumber(tokenData.marketCap)}\n\n`;
        }
        
        const security = await checkTokenSecurity(signal.ca);
        if (security) {
            message += formatSecurityReport(security) + '\n\n';
        }
        
        message += `⏰ <i>${new Date().toLocaleString('zh-CN')}</i>`;
        
        await ctx.reply(message, {
            parse_mode: 'HTML',
            ...generateButtons(signal.ca, signal.chain)
        });
    }
});

// Express 处理 webhook
app.use(express.json());
app.post('/webhook', (req, res) => {
    bot.handleUpdate(req.body);
    res.sendStatus(200);
});

// API 端点
app.get('/api/stats', (req, res) => {
    const signals = loadData(SIGNALS_FILE);
    res.json({
        totalSignals: signals.length,
        monitoringSignals: signals.filter(s => s.status === 'monitoring').length
    });
});

app.get('/api/signals', (req, res) => {
    const signals = loadData(SIGNALS_FILE);
    res.json(signals.reverse());
});

// 健康检查
app.get('/', (req, res) => {
    res.json({ status: 'ok', bot: 'running' });
});

// 启动
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`服务器运行在端口 ${PORT}`);
    
    const webhookUrl = process.env.WEBHOOK_URL;
    if (webhookUrl) {
        bot.telegram.setWebhook(`${webhookUrl}/webhook`);
        console.log(`Webhook 已设置: ${webhookUrl}/webhook`);
    }
});
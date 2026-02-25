const { Telegraf, Markup } = require('telegraf');
const fs = require('fs');
const path = require('path');
const { getTokenData, calculateReturns } = require('./price-api');
const { checkTokenSecurity, formatSecurityReport } = require('./security-check');

const DATA_DIR = path.join(__dirname, 'data');
const SIGNALS_FILE = path.join(DATA_DIR, 'signals.json');
const GROUPS_FILE = path.join(DATA_DIR, 'groups.json');

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

// 主菜单键盘
const mainMenuKeyboard = Markup.inlineKeyboard([
    [Markup.button.callback('📊 今日战绩', 'today_stats')],
    [Markup.button.callback('🔥 热门信号', 'hot_signals')],
    [Markup.button.callback('📈 我的统计', 'my_stats')],
    [Markup.button.callback('⚙️ 设置', 'settings')]
]);

// 格式化数字
function formatNumber(num) {
    if (num >= 1e9) return (num / 1e9).toFixed(2) + 'B';
    if (num >= 1e6) return (num / 1e6).toFixed(2) + 'M';
    if (num >= 1e3) return (num / 1e3).toFixed(2) + 'K';
    return num.toFixed(2);
}

// 格式化价格
function formatPrice(price) {
    if (price < 0.000001) return price.toExponential(4);
    if (price < 0.01) return price.toFixed(8);
    return price.toFixed(6);
}

// 计算群组战绩统计
function calculateGroupStats(chatId, timeframe = '24h') {
    const signals = loadData(SIGNALS_FILE);
    const groupSignals = signals.filter(s => s.chatId === chatId.toString());
    
    const now = Math.floor(Date.now() / 1000);
    const timeframes = {
        '24h': 86400,
        '7d': 604800,
        '30d': 2592000
    };
    
    const cutoff = now - (timeframes[timeframe] || 86400);
    const recentSignals = groupSignals.filter(s => s.timestamp >= cutoff);
    
    // 计算统计数据
    const completed = recentSignals.filter(s => s.status === 'completed' || s.milestones?.['24h']);
    const totalCalls = recentSignals.length;
    
    let winCount = 0;
    let totalReturn = 0;
    let bestCall = null;
    let worstCall = null;
    
    completed.forEach(s => {
        const returnX = s.milestones?.['24h']?.returnX || 1;
        
        if (returnX >= 2) winCount++;
        totalReturn += returnX;
        
        if (!bestCall || returnX > bestCall.returnX) {
            bestCall = { ...s, returnX };
        }
        if (!worstCall || returnX < worstCall.returnX) {
            worstCall = { ...s, returnX };
        }
    });
    
    return {
        totalCalls,
        completed: completed.length,
        winRate: completed.length > 0 ? (winCount / completed.length * 100).toFixed(1) : 0,
        avgReturn: completed.length > 0 ? (totalReturn / completed.length).toFixed(2) : 0,
        bestCall,
        worstCall,
        signals: recentSignals.sort((a, b) => b.timestamp - a.timestamp).slice(0, 10)
    };
}

// 生成战绩消息
function formatStatsMessage(stats, timeframe = '24h') {
    const timeLabel = { '24h': '24小时', '7d': '7天', '30d': '30天' }[timeframe] || '24小时';
    
    let message = `📊 <b>群组战绩统计 (${timeLabel})</b>\n\n`;
    
    message += `📈 总信号数: ${stats.totalCalls}\n`;
    message += `✅ 已完成: ${stats.completed}\n`;
    message += `🎯 胜率(2x+): ${stats.winRate}%\n`;
    message += `📊 平均涨幅: ${stats.avgReturn}x\n\n`;
    
    if (stats.bestCall) {
        message += `🏆 <b>最佳信号:</b>\n`;
        message += `  ${stats.bestCall.symbol} ${stats.bestCall.returnX.toFixed(2)}x\n\n`;
    }
    
    if (stats.signals.length > 0) {
        message += `📋 <b>最近信号:</b>\n`;
        stats.signals.slice(0, 5).forEach(s => {
            const returnX = s.milestones?.['24h']?.returnX || 0;
            const emoji = returnX >= 2 ? '🟢' : returnX >= 1 ? '⚪' : '🔴';
            message += `  ${emoji} ${s.symbol} ${returnX > 0 ? returnX.toFixed(2) + 'x' : '监控中'}\n`;
        });
    }
    
    return message;
}

// 启动Bot
const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);

// /start 命令
bot.command('start', async (ctx) => {
    const chatType = ctx.chat.type;
    
    if (chatType === 'private') {
        // 私聊 - 显示主菜单
        const welcomeMessage = `🚀 <b>Meme Signal Bot</b>\n\n` +
            `自动追踪 Meme 币信号，实时监控价格变化。\n\n` +
            `📌 功能:\n` +
            `• 自动记录群组 CA 信号\n` +
            `• 实时价格监控\n` +
            `• 战绩统计分析\n` +
            `• 涨幅提醒通知\n\n` +
            `👇 选择功能:`;
        
        await ctx.reply(welcomeMessage, {
            parse_mode: 'HTML',
            ...mainMenuKeyboard
        });
    } else {
        // 群组 - 显示群组统计
        const stats = calculateGroupStats(ctx.chat.id, '24h');
        const message = formatStatsMessage(stats, '24h');
        
        await ctx.reply(message, {
            parse_mode: 'HTML',
            ...Markup.inlineKeyboard([
                [Markup.button.callback('📊 详细统计', 'detailed_stats')],
                [Markup.button.callback('🔥 热门信号', 'hot_signals')]
            ])
        });
    }
});

// /stats 命令
bot.command('stats', async (ctx) => {
    const chatId = ctx.chat.id;
    const stats = calculateGroupStats(chatId, '24h');
    const message = formatStatsMessage(stats, '24h');
    
    await ctx.reply(message, {
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard([
            [Markup.button.callback('📊 7天统计', 'stats_7d')],
            [Markup.button.callback('📊 30天统计', 'stats_30d')]
        ])
    });
});

// 处理按钮回调
bot.on('callback_query', async (ctx) => {
    const data = ctx.callbackQuery.data;
    const chatId = ctx.chat.id;
    
    if (data === 'today_stats' || data === 'detailed_stats') {
        const stats = calculateGroupStats(chatId, '24h');
        const message = formatStatsMessage(stats, '24h');
        
        await ctx.editMessageText(message, {
            parse_mode: 'HTML',
            ...Markup.inlineKeyboard([
                [Markup.button.callback('📊 7天', 'stats_7d'), Markup.button.callback('📊 30天', 'stats_30d')],
                [Markup.button.callback('🔙 返回', 'back_to_menu')]
            ])
        });
    }
    
    else if (data === 'stats_7d') {
        const stats = calculateGroupStats(chatId, '7d');
        const message = formatStatsMessage(stats, '7d');
        
        await ctx.editMessageText(message, {
            parse_mode: 'HTML',
            ...Markup.inlineKeyboard([
                [Markup.button.callback('📊 24小时', 'today_stats'), Markup.button.callback('📊 30天', 'stats_30d')],
                [Markup.button.callback('🔙 返回', 'back_to_menu')]
            ])
        });
    }
    
    else if (data === 'stats_30d') {
        const stats = calculateGroupStats(chatId, '30d');
        const message = formatStatsMessage(stats, '30d');
        
        await ctx.editMessageText(message, {
            parse_mode: 'HTML',
            ...Markup.inlineKeyboard([
                [Markup.button.callback('📊 24小时', 'today_stats'), Markup.button.callback('📊 7天', 'stats_7d')],
                [Markup.button.callback('🔙 返回', 'back_to_menu')]
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
            ...Markup.inlineKeyboard([
                [Markup.button.callback('🔙 返回', 'back_to_menu')]
            ])
        });
    }
    
    else if (data === 'back_to_menu') {
        const welcomeMessage = `🚀 <b>Meme Signal Bot</b>\n\n` +
            `自动追踪 Meme 币信号，实时监控价格变化。\n\n` +
            `👇 选择功能:`;
        
        await ctx.editMessageText(welcomeMessage, {
            parse_mode: 'HTML',
            ...mainMenuKeyboard
        });
    }
    
    await ctx.answerCbQuery();
});

// 导出函数供其他模块使用
module.exports = {
    calculateGroupStats,
    formatStatsMessage,
    mainMenuKeyboard
};

// 如果直接运行
if (require.main === module) {
    console.log('统计模块已加载');
}
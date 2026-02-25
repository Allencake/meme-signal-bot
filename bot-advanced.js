const { Telegraf, Markup } = require('telegraf');
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

// 生成消息按钮
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

// 格式化信号消息
async function formatSignalMessage(signal, currentData) {
    const { symbol, name, ca, chain, marketCap, timestamp } = signal;
    
    let message = `🚀 <b>${name}</b> ${symbol}\n`;
    message += `🔗 <code>${ca}</code>\n\n`;
    
    if (currentData) {
        const { price, priceChange, volume24h, liquidity, marketCap: currentMC } = currentData;
        
        // 计算涨幅
        const entryPrice = marketCap > 0 ? marketCap / 1e9 : 0; // 估算
        const returns = calculateReturns(price, entryPrice);
        
        message += `💵 <b>价格:</b> $${formatPrice(price)}\n`;
        message += `📊 <b>涨幅:</b> ${returns.x.toFixed(2)}x (${returns.percent >= 0 ? '+' : ''}${returns.percent.toFixed(2)}%)\n\n`;
        
        message += `📈 <b>价格变化:</b>\n`;
        message += `  5m: ${priceChange.m5 >= 0 ? '🟢' : '🔴'} ${priceChange.m5.toFixed(2)}%\n`;
        message += `  1h: ${priceChange.h1 >= 0 ? '🟢' : '🔴'} ${priceChange.h1.toFixed(2)}%\n`;
        message += `  6h: ${priceChange.h6 >= 0 ? '🟢' : '🔴'} ${priceChange.h6.toFixed(2)}%\n`;
        message += `  24h: ${priceChange.h24 >= 0 ? '🟢' : '🔴'} ${priceChange.h24.toFixed(2)}%\n\n`;
        
        message += `💧 <b>流动性:</b> $${formatNumber(liquidity)}\n`;
        message += `📊 <b>24h交易量:</b> $${formatNumber(volume24h)}\n`;
        message += `🏦 <b>市值:</b> $${formatNumber(currentMC)}\n\n`;
    }
    
    // 安全检测
    const security = await checkTokenSecurity(ca);
    if (security) {
        message += formatSecurityReport(security) + '\n\n';
    }
    
    message += `⏰ <i>${new Date().toLocaleString('zh-CN')}</i>`;
    
    return message;
}

// 启动Bot
const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);

// 测试命令
bot.command('test', (ctx) => {
    console.log('收到 /test 命令', ctx.chat.id);
    ctx.reply('✅ Bot 正常工作！Chat ID: ' + ctx.chat.id);
});

// 处理消息
bot.on('text', async (ctx) => {
    const chatType = ctx.chat.type;
    const chatId = ctx.chat.id.toString();
    const text = ctx.message.text;
    
    console.log(`收到消息 | 类型: ${chatType} | 群组ID: ${chatId}`);
    
    const signal = parseMessage(text);
    
    if (signal) {
        const signals = loadData(SIGNALS_FILE);
        
        // 检查是否已存在
        const existing = signals.find(s => s.ca === signal.ca);
        if (existing) {
            console.log(`CA已存在: ${signal.ca}`);
            return;
        }
        
        const newSignal = {
            ...signal,
            chatId: chatId,
            timestamp: Math.floor(Date.now() / 1000),
            status: 'monitoring',
            milestones: {},
            alerts: []
        };
        
        signals.push(newSignal);
        saveData(SIGNALS_FILE, signals);
        
        console.log('新信号:', signal);
        
        // 获取实时数据
        const tokenData = await getTokenData(signal.ca);
        
        // 生成消息
        const message = await formatSignalMessage(newSignal, tokenData);
        const buttons = generateButtons(signal.ca, signal.chain);
        
        // 发送消息
        try {
            await ctx.reply(message, {
                parse_mode: 'HTML',
                ...buttons
            });
        } catch (error) {
            console.error('发送消息失败:', error);
            // 简化版消息
            await ctx.reply(`✅ 已记录: ${signal.symbol}\nCA: ${signal.ca.slice(0, 8)}...\n开始监控...`);
        }
    }
});

// 价格监控循环
async function priceMonitor() {
    const signals = loadData(SIGNALS_FILE);
    
    for (const signal of signals) {
        if (signal.status !== 'monitoring') continue;
        
        const tokenData = await getTokenData(signal.ca);
        if (!tokenData) continue;
        
        const entryPrice = signal.marketCap > 0 ? signal.marketCap / 1e9 : 0;
        const returns = calculateReturns(tokenData.price, entryPrice);
        
        // 检查里程碑
        const milestones = [2, 5, 10, 50, 100];
        for (const target of milestones) {
            if (returns.x >= target && !signal.alerts.includes(target)) {
                signal.alerts.push(target);
                
                // 发送通知
                const message = `🎯 <b>${signal.symbol}</b> 达到 ${target}x!\n\n` +
                    `当前价格: $${formatPrice(tokenData.price)}\n` +
                    `涨幅: ${returns.x.toFixed(2)}x (${returns.percent.toFixed(2)}%)\n\n` +
                    `🔗 <code>${signal.ca}</code>`;
                
                try {
                    await bot.telegram.sendMessage(signal.chatId, message, {
                        parse_mode: 'HTML',
                        ...generateButtons(signal.ca, signal.chain)
                    });
                } catch (error) {
                    console.error('发送通知失败:', error);
                }
            }
        }
        
        // 更新里程碑数据
        const elapsed = Math.floor(Date.now() / 1000) - signal.timestamp;
        const timeLabels = [
            { key: '5m', seconds: 300 },
            { key: '1h', seconds: 3600 },
            { key: '6h', seconds: 21600 },
            { key: '24h', seconds: 86400 }
        ];
        
        for (const { key, seconds } of timeLabels) {
            if (elapsed >= seconds && !signal.milestones[key]) {
                signal.milestones[key] = {
                    returnX: returns.x,
                    price: tokenData.price,
                    timestamp: Math.floor(Date.now() / 1000)
                };
            }
        }
        
        // 超过24小时停止监控
        if (elapsed > 86400) {
            signal.status = 'completed';
        }
    }
    
    saveData(SIGNALS_FILE, signals);
}

// 启动监控循环
setInterval(priceMonitor, 30000); // 每30秒检查

// 启动Bot
bot.launch();
console.log('Bot已启动，等待消息...');

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
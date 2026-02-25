const { Telegraf } = require('telegraf');
const fs = require('fs');
const path = require('path');

// 简单JSON存储，无需SQLite
const DATA_DIR = path.join(__dirname, 'data');
const SIGNALS_FILE = path.join(DATA_DIR, 'signals.json');
const PRICES_FILE = path.join(DATA_DIR, 'prices.json');

// 允许的群组ID列表（从环境变量读取）
const ALLOWED_GROUPS = process.env.ALLOWED_GROUPS 
    ? process.env.ALLOWED_GROUPS.split(',') 
    : ['*']; // '*' 表示允许所有群组

// 确保目录存在
if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
}

// 读取数据
function loadData(file, defaultData = []) {
    try {
        if (fs.existsSync(file)) {
            return JSON.parse(fs.readFileSync(file, 'utf8'));
        }
    } catch (e) {
        console.error('读取数据失败:', e);
    }
    return defaultData;
}

// 保存数据
function saveData(file, data) {
    fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

// 解析消息
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

// 模拟价格监控（实际部署时接入Jupiter API）
function mockPriceCheck() {
    const signals = loadData(SIGNALS_FILE);
    const prices = loadData(PRICES_FILE);
    
    signals.forEach(signal => {
        if (signal.status !== 'monitoring') return;
        
        const elapsed = Math.floor(Date.now() / 1000) - signal.timestamp;
        
        // 模拟涨幅 (随机 0.5x - 20x)
        const mockReturn = 0.5 + Math.random() * 19.5;
        const mockMarketCap = signal.marketCapAtCall * mockReturn;
        
        prices.push({
            ca: signal.ca,
            price: mockReturn * 0.000001,
            marketCap: mockMarketCap,
            returnX: mockReturn,
            timestamp: Math.floor(Date.now() / 1000)
        });
        
        // 检查里程碑
        const milestones = ['5min', '15min', '1h', '4h', '24h'];
        const seconds = [300, 900, 3600, 14400, 86400];
        
        milestones.forEach((ms, idx) => {
            if (elapsed >= seconds[idx] && !signal.milestones?.[ms]) {
                if (!signal.milestones) signal.milestones = {};
                signal.milestones[ms] = {
                    returnX: mockReturn,
                    marketCap: mockMarketCap,
                    timestamp: Math.floor(Date.now() / 1000)
                };
            }
        });
        
        // 超过24小时停止监控
        if (elapsed > 86400) {
            signal.status = 'completed';
        }
    });
    
    saveData(SIGNALS_FILE, signals);
    saveData(PRICES_FILE, prices);
}

// 启动Bot
const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);

// 处理消息（私聊 + 群组）
bot.on('text', (ctx) => {
    const chatType = ctx.chat.type;
    const chatId = ctx.chat.id.toString();
    const text = ctx.message.text;
    
    console.log(`收到消息 | 类型: ${chatType} | 群组ID: ${chatId}`);
    
    // 判断是否应该处理
    let shouldProcess = false;
    
    if (chatType === 'private') {
        // 私聊消息
        shouldProcess = true;
    } else if (chatType === 'group' || chatType === 'supergroup') {
        // 群组消息 - 允许所有群组
        shouldProcess = true;
    }
    
    if (!shouldProcess) {
        console.log(`跳过消息 - 群组 ${chatId} 不在允许列表`);
        return;
    }
    
    // 解析消息
    const signal = parseMessage(text);
    
    if (signal) {
        const signals = loadData(SIGNALS_FILE);
        
        // 检查是否已存在
        if (signals.find(s => s.ca === signal.ca)) {
            console.log(`CA已存在: ${signal.ca}`);
            // 只在私聊回复，群组不回复避免刷屏
            if (chatType === 'private') {
                ctx.reply('⚠️ 该CA已存在');
            }
            return;
        }
        
        const newSignal = {
            ...signal,
            chatId: chatId,
            timestamp: Math.floor(Date.now() / 1000),
            status: 'monitoring',
            milestones: {}
        };
        
        signals.push(newSignal);
        saveData(SIGNALS_FILE, signals);
        
        const replyMsg = `✅ 已记录: ${signal.symbol}\nCA: ${signal.ca.slice(0, 8)}...\n开始监控...`;
        
        // 私聊直接回复，群组可以选择性回复
        if (chatType === 'private') {
            ctx.reply(replyMsg);
        } else {
            // 群组中可以选择不回复，或只在特定条件下回复
            // ctx.reply(replyMsg); // 取消注释以在群组中回复
            console.log(`群组消息已记录: ${signal.symbol}`);
        }
        
        console.log('新信号:', signal);
    }
});

// 处理群组加入事件
bot.on('new_chat_members', (ctx) => {
    const newMembers = ctx.message.new_chat_members;
    const botInfo = ctx.botInfo;
    
    newMembers.forEach(member => {
        if (member.id === botInfo.id) {
            const chatId = ctx.chat.id.toString();
            console.log(`Bot被加入群组: ${chatId}`);
            ctx.reply(`✅ Meme Signal Bot 已加入\n群组ID: ${chatId}\n\n请将此ID添加到环境变量 ALLOWED_GROUPS 中`);
        }
    });
});

// 启动监控循环
setInterval(mockPriceCheck, 60000); // 每分钟检查

// 启动Bot
bot.launch();
console.log('Bot已启动，等待消息...');
console.log('允许的群组:', ALLOWED_GROUPS);

// 优雅退出
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
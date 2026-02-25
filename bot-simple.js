const { Telegraf } = require('telegraf');
const fs = require('fs');
const path = require('path');

// 简单JSON存储，无需SQLite
const DATA_DIR = path.join(__dirname, 'data');
const SIGNALS_FILE = path.join(DATA_DIR, 'signals.json');
const PRICES_FILE = path.join(DATA_DIR, 'prices.json');

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

bot.on('text', (ctx) => {
    const text = ctx.message.text;
    const signal = parseMessage(text);
    
    if (signal) {
        const signals = loadData(SIGNALS_FILE);
        
        // 检查是否已存在
        if (signals.find(s => s.ca === signal.ca)) {
            ctx.reply('⚠️ 该CA已存在');
            return;
        }
        
        const newSignal = {
            ...signal,
            timestamp: Math.floor(Date.now() / 1000),
            status: 'monitoring',
            milestones: {}
        };
        
        signals.push(newSignal);
        saveData(SIGNALS_FILE, signals);
        
        ctx.reply(`✅ 已记录: ${signal.symbol}\nCA: ${signal.ca.slice(0, 8)}...\n开始监控...`);
        console.log('新信号:', signal);
    }
});

// 启动监控循环
setInterval(mockPriceCheck, 60000); // 每分钟检查

// 启动Bot
bot.launch();
console.log('Bot已启动，等待消息...');

// 优雅退出
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
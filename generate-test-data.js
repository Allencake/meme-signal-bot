const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, 'data');

// 确保目录存在
if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
}

// 生成测试信号
const testSignals = [
    {
        ca: "A3XLb1tbaaPgkJijSCEmR6GhUM1ZBCyc59s2evXtUx5x",
        chain: "SOL",
        symbol: "$HAL9000",
        name: "The Claudinator",
        marketCap: 26580,
        timestamp: Math.floor(Date.now() / 1000) - 3600,
        status: "completed",
        milestones: {
            "5min": { returnX: 1.5, marketCap: 39870, timestamp: Math.floor(Date.now() / 1000) - 3300 },
            "15min": { returnX: 3.2, marketCap: 85056, timestamp: Math.floor(Date.now() / 1000) - 2700 },
            "1h": { returnX: 8.5, marketCap: 225930, timestamp: Math.floor(Date.now() / 1000) - 0 },
            "4h": { returnX: 12.3, marketCap: 326934, timestamp: Math.floor(Date.now() / 1000) + 10800 },
            "24h": { returnX: 45.8, marketCap: 1217364, timestamp: Math.floor(Date.now() / 1000) + 82800 }
        }
    },
    {
        ca: "B5YMp2vccRimHklN8JCFnV8ZBEah1qW5x7s4evYtWx7z",
        chain: "SOL",
        symbol: "$PEPE2",
        name: "Pepe Revolution",
        marketCap: 15000,
        timestamp: Math.floor(Date.now() / 1000) - 7200,
        status: "completed",
        milestones: {
            "5min": { returnX: 2.1, marketCap: 31500, timestamp: Math.floor(Date.now() / 1000) - 6900 },
            "15min": { returnX: 5.5, marketCap: 82500, timestamp: Math.floor(Date.now() / 1000) - 6300 },
            "1h": { returnX: 15.2, marketCap: 228000, timestamp: Math.floor(Date.now() / 1000) - 3600 },
            "4h": { returnX: 28.7, marketCap: 430500, timestamp: Math.floor(Date.now() / 1000) + 7200 },
            "24h": { returnX: 3.2, marketCap: 48000, timestamp: Math.floor(Date.now() / 1000) + 79200 }
        }
    },
    {
        ca: "C7ZOr4xeeTkpJmnP0LDHpX9ZDGcj3sY7x9gtXvYtWx9b",
        chain: "SOL",
        symbol: "$DOGE",
        name: "Doge Killer",
        marketCap: 50000,
        timestamp: Math.floor(Date.now() / 1000) - 1800,
        status: "monitoring",
        milestones: {
            "5min": { returnX: 1.8, marketCap: 90000, timestamp: Math.floor(Date.now() / 1000) - 1500 }
        }
    },
    {
        ca: "D9APq6zggVmnRopQ2NFJrZ1ZFgl5uY9x1ivXvYtWx1d",
        chain: "SOL",
        symbol: "$SHIB",
        name: "Shiba Inu Pro",
        marketCap: 32000,
        timestamp: Math.floor(Date.now() / 1000) - 90000,
        status: "completed",
        milestones: {
            "5min": { returnX: 0.8, marketCap: 25600, timestamp: Math.floor(Date.now() / 1000) - 89700 },
            "15min": { returnX: 0.6, marketCap: 19200, timestamp: Math.floor(Date.now() / 1000) - 89100 },
            "1h": { returnX: 0.4, marketCap: 12800, timestamp: Math.floor(Date.now() / 1000) - 86400 },
            "4h": { returnX: 0.3, marketCap: 9600, timestamp: Math.floor(Date.now() / 1000) - 75600 },
            "24h": { returnX: 0.2, marketCap: 6400, timestamp: Math.floor(Date.now() / 1000) - 3600 }
        }
    },
    {
        ca: "E1BRs8biiXopTqrS4PLHtZ3ZHin7uY9x3kxXvYtWx3f",
        chain: "SOL",
        symbol: "$FLOKI",
        name: "Floki Viking",
        marketCap: 45000,
        timestamp: Math.floor(Date.now() / 1000) - 172800,
        status: "completed",
        milestones: {
            "5min": { returnX: 3.5, marketCap: 157500, timestamp: Math.floor(Date.now() / 1000) - 172500 },
            "15min": { returnX: 12.8, marketCap: 576000, timestamp: Math.floor(Date.now() / 1000) - 171900 },
            "1h": { returnX: 35.2, marketCap: 1584000, timestamp: Math.floor(Date.now() / 1000) - 169200 },
            "4h": { returnX: 89.5, marketCap: 4027500, timestamp: Math.floor(Date.now() / 1000) - 158400 },
            "24h": { returnX: 156.3, marketCap: 7033500, timestamp: Math.floor(Date.now() / 1000) - 86400 }
        }
    }
];

// 生成价格历史
const priceHistory = [];
testSignals.forEach(signal => {
    Object.values(signal.milestones || {}).forEach(m => {
        priceHistory.push({
            ca: signal.ca,
            price: m.returnX * 0.000001,
            marketCap: m.marketCap,
            returnX: m.returnX,
            timestamp: m.timestamp
        });
    });
});

// 保存数据
fs.writeFileSync(path.join(DATA_DIR, 'signals.json'), JSON.stringify(testSignals, null, 2));
fs.writeFileSync(path.join(DATA_DIR, 'prices.json'), JSON.stringify(priceHistory, null, 2));

console.log('✅ 测试数据已生成');
console.log(`信号数量: ${testSignals.length}`);
console.log(`价格记录: ${priceHistory.length}`);
console.log('');
console.log('测试信号:');
testSignals.forEach(s => {
    const best = s.milestones?.['24h']?.returnX || s.milestones?.['1h']?.returnX || 0;
    console.log(`  ${s.symbol} ${s.name}: ${best.toFixed(2)}x`);
});
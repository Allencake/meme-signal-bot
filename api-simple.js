const express = require('express');
const fs = require('fs');
const path = require('path');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_DIR = path.join(__dirname, 'data');

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// 读取JSON数据
function loadData(file, defaultData = []) {
    try {
        const filePath = path.join(DATA_DIR, file);
        if (fs.existsSync(filePath)) {
            return JSON.parse(fs.readFileSync(filePath, 'utf8'));
        }
    } catch (e) {}
    return defaultData;
}

// 获取所有信号
app.get('/api/signals', (req, res) => {
    const signals = loadData('signals.json');
    res.json(signals.reverse());
});

// 获取统计数据
app.get('/api/stats', (req, res) => {
    const signals = loadData('signals.json');
    const monitoring = signals.filter(s => s.status === 'monitoring').length;
    
    // 计算24h平均涨幅
    const completed = signals.filter(s => s.milestones?.['24h']);
    const avgReturn = completed.length > 0 
        ? completed.reduce((sum, s) => sum + s.milestones['24h'].returnX, 0) / completed.length 
        : 0;
    
    // 胜率 (2x+)
    const winners = completed.filter(s => s.milestones['24h'].returnX >= 2).length;
    
    res.json({
        totalSignals: signals.length,
        monitoringSignals: monitoring,
        avgReturn24h: avgReturn,
        winRate2x: completed.length > 0 ? (winners / completed.length * 100).toFixed(2) : 0
    });
});

// 获取战绩
app.get('/api/performance', (req, res) => {
    const signals = loadData('signals.json');
    const { timeframe = '24h' } = req.query;
    
    const calls = signals
        .filter(s => s.milestones?.[timeframe])
        .map(s => ({
            ca: s.ca,
            symbol: s.symbol,
            name: s.name,
            market_cap_at_call: s.marketCap,
            market_cap: s.milestones[timeframe].marketCap,
            return_x: s.milestones[timeframe].returnX,
            timestamp: s.milestones[timeframe].timestamp
        }))
        .sort((a, b) => b.timestamp - a.timestamp)
        .slice(0, 50);
    
    const avgReturn = calls.length > 0 
        ? calls.reduce((sum, c) => sum + c.return_x, 0) / calls.length 
        : 0;
    
    const bestCall = calls.length > 0 
        ? calls.reduce((max, c) => c.return_x > max.return_x ? c : max, calls[0])
        : null;
    
    res.json({
        total: calls.length,
        avgReturn,
        bestCall,
        calls
    });
});

app.listen(PORT, () => {
    console.log(`API服务器运行在端口 ${PORT}`);
});
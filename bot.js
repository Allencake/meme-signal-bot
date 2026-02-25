const { Telegraf } = require('telegraf');
const axios = require('axios');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// 配置
const CONFIG = {
  TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN,
  JUPITER_API: 'https://price.jup.ag/v4',
  SOLANA_RPC: 'https://api.mainnet-beta.solana.com',
  MONITOR_INTERVAL: 5 * 60 * 1000, // 5分钟
  DB_PATH: path.join(__dirname, 'data', 'signals.db')
};

// 初始化数据库
function initDB() {
  const db = new sqlite3.Database(CONFIG.DB_PATH);
  
  db.serialize(() => {
    // CA记录表
    db.run(`CREATE TABLE IF NOT EXISTS signals (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ca TEXT UNIQUE NOT NULL,
      chain TEXT NOT NULL,
      symbol TEXT,
      name TEXT,
      market_cap_at_call REAL,
      timestamp INTEGER NOT NULL,
      status TEXT DEFAULT 'monitoring',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);
    
    // 价格记录表
    db.run(`CREATE TABLE IF NOT EXISTS price_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ca TEXT NOT NULL,
      price REAL,
      market_cap REAL,
      return_x REAL,
      timestamp INTEGER NOT NULL,
      FOREIGN KEY (ca) REFERENCES signals(ca)
    )`);
    
    // 关键时间点记录
    db.run(`CREATE TABLE IF NOT EXISTS milestones (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ca TEXT NOT NULL,
      milestone TEXT NOT NULL, -- 5min, 15min, 1h, 4h, 24h
      return_x REAL,
      market_cap REAL,
      timestamp INTEGER,
      FOREIGN KEY (ca) REFERENCES signals(ca)
    )`);
  });
  
  return db;
}

// 解析TG消息
function parseMessage(text) {
  const lines = text.split('\n');
  const result = {
    chain: 'SOL',
    symbol: '',
    name: '',
    marketCap: 0,
    ca: ''
  };
  
  for (const line of lines) {
    // 提取链
    if (line.includes('#SOLANA')) result.chain = 'SOL';
    if (line.includes('#BSC')) result.chain = 'BSC';
    
    // 提取代币名
    if (line.includes('代币：')) {
      result.name = line.split('代币：')[1].trim();
    }
    
    // 提取符号
    if (line.includes('代币符号：')) {
      result.symbol = line.split('代币符号：')[1].trim();
    }
    
    // 提取市值
    if (line.includes('市值：')) {
      const mcText = line.split('市值：')[1].trim();
      result.marketCap = parseMarketCap(mcText);
    }
    
    // 提取CA
    if (line.includes('合约：')) {
      result.ca = line.split('合约：')[1].trim();
    }
  }
  
  return result.ca ? result : null;
}

// 解析市值文本 (26.58K -> 26580)
function parseMarketCap(text) {
  const num = parseFloat(text);
  if (text.includes('K')) return num * 1000;
  if (text.includes('M')) return num * 1000000;
  if (text.includes('B')) return num * 1000000000;
  return num;
}

// 获取代币价格 (Solana via Jupiter)
async function getTokenPriceSolana(ca) {
  try {
    const response = await axios.get(`${CONFIG.JUPITER_API}/price`, {
      params: { ids: ca }
    });
    
    const data = response.data.data[ca];
    if (!data) return null;
    
    return {
      price: data.price,
      marketCap: data.price * 1000000 // 估算，需要总供应量
    };
  } catch (error) {
    console.error('获取价格失败:', error.message);
    return null;
  }
}

// 保存信号到数据库
function saveSignal(db, signal) {
  return new Promise((resolve, reject) => {
    const stmt = db.prepare(`
      INSERT OR IGNORE INTO signals (ca, chain, symbol, name, market_cap_at_call, timestamp, status)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    
    stmt.run(
      signal.ca,
      signal.chain,
      signal.symbol,
      signal.name,
      signal.marketCap,
      Math.floor(Date.now() / 1000),
      'monitoring',
      function(err) {
        if (err) reject(err);
        else resolve(this.lastID);
      }
    );
    
    stmt.finalize();
  });
}

// 保存价格记录
function savePrice(db, ca, priceData) {
  return new Promise((resolve, reject) => {
    // 获取初始市值计算涨幅
    db.get('SELECT market_cap_at_call FROM signals WHERE ca = ?', [ca], (err, row) => {
      if (err || !row) {
        reject(err || new Error('信号不存在'));
        return;
      }
      
      const returnX = priceData.marketCap / row.market_cap_at_call;
      
      const stmt = db.prepare(`
        INSERT INTO price_history (ca, price, market_cap, return_x, timestamp)
        VALUES (?, ?, ?, ?, ?)
      `);
      
      stmt.run(
        ca,
        priceData.price,
        priceData.marketCap,
        returnX,
        Math.floor(Date.now() / 1000),
        function(err) {
          if (err) reject(err);
          else resolve({ id: this.lastID, returnX });
        }
      );
      
      stmt.finalize();
    });
  });
}

// 检查并记录里程碑
async function checkMilestones(db, ca) {
  const signal = await new Promise((resolve, reject) => {
    db.get('SELECT * FROM signals WHERE ca = ?', [ca], (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
  
  if (!signal) return;
  
  const elapsed = Math.floor(Date.now() / 1000) - signal.timestamp;
  const milestones = [
    { name: '5min', seconds: 5 * 60 },
    { name: '15min', seconds: 15 * 60 },
    { name: '1h', seconds: 60 * 60 },
    { name: '4h', seconds: 4 * 60 * 60 },
    { name: '24h', seconds: 24 * 60 * 60 }
  ];
  
  for (const ms of milestones) {
    if (elapsed >= ms.seconds) {
      // 检查是否已记录
      const exists = await new Promise((resolve) => {
        db.get(
          'SELECT 1 FROM milestones WHERE ca = ? AND milestone = ?',
          [ca, ms.name],
          (err, row) => resolve(!!row)
        );
      });
      
      if (!exists) {
        // 获取当前价格记录
        const latestPrice = await new Promise((resolve) => {
          db.get(
            'SELECT * FROM price_history WHERE ca = ? ORDER BY timestamp DESC LIMIT 1',
            [ca],
            (err, row) => resolve(row)
          );
        });
        
        if (latestPrice) {
          db.run(
            'INSERT INTO milestones (ca, milestone, return_x, market_cap, timestamp) VALUES (?, ?, ?, ?, ?)',
            [ca, ms.name, latestPrice.return_x, latestPrice.market_cap, latestPrice.timestamp]
          );
        }
      }
    }
  }
}

// 监控循环
async function monitorLoop(db) {
  console.log('开始监控循环...');
  
  const signals = await new Promise((resolve, reject) => {
    db.all('SELECT * FROM signals WHERE status = ?', ['monitoring'], (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
  
  console.log(`监控中信号数量: ${signals.length}`);
  
  for (const signal of signals) {
    try {
      let priceData;
      
      if (signal.chain === 'SOL') {
        priceData = await getTokenPriceSolana(signal.ca);
      }
      // BSC链后续添加
      
      if (priceData) {
        const result = await savePrice(db, signal.ca, priceData);
        console.log(`${signal.symbol}: ${result.returnX.toFixed(2)}x`);
        
        // 检查里程碑
        await checkMilestones(db, signal.ca);
        
        // 如果超过24小时，停止监控
        const elapsed = Math.floor(Date.now() / 1000) - signal.timestamp;
        if (elapsed > 24 * 60 * 60) {
          db.run('UPDATE signals SET status = ? WHERE ca = ?', ['completed', signal.ca]);
        }
      }
    } catch (error) {
      console.error(`监控 ${signal.ca} 失败:`, error.message);
    }
  }
}

// 启动Bot
async function startBot() {
  const db = initDB();
  const bot = new Telegraf(CONFIG.TELEGRAM_BOT_TOKEN);
  
  // 处理消息
  bot.on('text', async (ctx) => {
    const text = ctx.message.text;
    
    // 解析消息
    const signal = parseMessage(text);
    
    if (signal) {
      console.log('收到信号:', signal);
      
      try {
        await saveSignal(db, signal);
        ctx.reply(`✅ 已记录: ${signal.symbol}\nCA: ${signal.ca.slice(0, 8)}...`);
      } catch (error) {
        console.error('保存信号失败:', error);
        ctx.reply('❌ 记录失败，可能已存在');
      }
    }
  });
  
  // 启动监控循环
  setInterval(() => monitorLoop(db), CONFIG.MONITOR_INTERVAL);
  
  // 立即执行一次
  monitorLoop(db);
  
  // 启动Bot
  bot.launch();
  console.log('Bot已启动');
  
  // 优雅退出
  process.once('SIGINT', () => {
    bot.stop('SIGINT');
    db.close();
  });
  process.once('SIGTERM', () => {
    bot.stop('SIGTERM');
    db.close();
  });
}

// 如果直接运行此文件
if (require.main === module) {
  if (!CONFIG.TELEGRAM_BOT_TOKEN) {
    console.error('错误: 请设置 TELEGRAM_BOT_TOKEN 环境变量');
    process.exit(1);
  }
  
  startBot().catch(console.error);
}

module.exports = {
  parseMessage,
  getTokenPriceSolana,
  saveSignal,
  savePrice,
  initDB
};
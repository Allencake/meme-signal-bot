const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;
const DB_PATH = path.join(__dirname, 'data', 'signals.db');

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// 数据库连接
function getDB() {
  return new sqlite3.Database(DB_PATH);
}

// 获取所有信号
app.get('/api/signals', (req, res) => {
  const db = getDB();
  const { limit = 100, offset = 0, status } = req.query;
  
  let sql = 'SELECT * FROM signals';
  const params = [];
  
  if (status) {
    sql += ' WHERE status = ?';
    params.push(status);
  }
  
  sql += ' ORDER BY timestamp DESC LIMIT ? OFFSET ?';
  params.push(parseInt(limit), parseInt(offset));
  
  db.all(sql, params, (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(rows);
  });
  
  db.close();
});

// 获取单个信号详情
app.get('/api/signals/:ca', (req, res) => {
  const db = getDB();
  const { ca } = req.params;
  
  db.get('SELECT * FROM signals WHERE ca = ?', [ca], (err, signal) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    
    if (!signal) {
      res.status(404).json({ error: '信号不存在' });
      return;
    }
    
    // 获取价格历史
    db.all(
      'SELECT * FROM price_history WHERE ca = ? ORDER BY timestamp',
      [ca],
      (err, prices) => {
        if (err) {
          res.status(500).json({ error: err.message });
          return;
        }
        
        // 获取里程碑
        db.all(
          'SELECT * FROM milestones WHERE ca = ? ORDER BY timestamp',
          [ca],
          (err, milestones) => {
            db.close();
            
            if (err) {
              res.status(500).json({ error: err.message });
              return;
            }
            
            res.json({
              signal,
              prices,
              milestones
            });
          }
        );
      }
    );
  });
});

// 统计数据
app.get('/api/stats', (req, res) => {
  const db = getDB();
  
  const stats = {};
  
  // 总信号数
  db.get('SELECT COUNT(*) as total FROM signals', [], (err, row) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    stats.totalSignals = row.total;
    
    // 监控中信号数
    db.get("SELECT COUNT(*) as monitoring FROM signals WHERE status = 'monitoring'", [], (err, row) => {
      stats.monitoringSignals = row.monitoring;
      
      // 平均涨幅（24h）
      db.get(`
        SELECT AVG(return_x) as avg_return
        FROM milestones
        WHERE milestone = '24h'
      `, [], (err, row) => {
        stats.avgReturn24h = row?.avg_return || 0;
        
        // 胜率（2x以上）
        db.get(`
          SELECT 
            COUNT(CASE WHEN return_x >= 2 THEN 1 END) as winners,
            COUNT(*) as total
          FROM milestones
          WHERE milestone = '24h'
        `, [], (err, row) => {
          db.close();
          
          if (err) {
            res.status(500).json({ error: err.message });
            return;
          }
          
          stats.winRate2x = row.total > 0 ? (row.winners / row.total * 100).toFixed(2) : 0;
          stats.totalCompleted = row.total;
          
          res.json(stats);
        });
      });
    });
  });
});

// 实时战绩
app.get('/api/performance', (req, res) => {
  const db = getDB();
  const { timeframe = '24h' } = req.query;
  
  // 获取最近N个完成的信号
  db.all(`
    SELECT 
      s.ca,
      s.symbol,
      s.name,
      s.market_cap_at_call,
      m.return_x,
      m.market_cap,
      m.timestamp
    FROM signals s
    JOIN milestones m ON s.ca = m.ca
    WHERE m.milestone = ?
    ORDER BY m.timestamp DESC
    LIMIT 50
  `, [timeframe], (err, rows) => {
    db.close();
    
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    
    // 计算统计
    const stats = {
      total: rows.length,
      avgReturn: rows.reduce((sum, r) => sum + r.return_x, 0) / rows.length || 0,
      bestCall: rows.length > 0 ? rows.reduce((max, r) => r.return_x > max.return_x ? r : max, rows[0]) : null,
      calls: rows
    };
    
    res.json(stats);
  });
});

// 启动服务器
app.listen(PORT, () => {
  console.log(`API服务器运行在端口 ${PORT}`);
});

module.exports = app;
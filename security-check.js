// 安全检测模块
const axios = require('axios');

const RUGCHECK_API = 'https://api.rugcheck.xyz/v1';

// 检测代币安全状态
async function checkTokenSecurity(ca) {
    try {
        // 使用 RugCheck API
        const response = await axios.get(`${RUGCHECK_API}/tokens/${ca}/report`, {
            timeout: 10000
        });
        
        const data = response.data;
        
        return {
            score: data.score || 0, // 安全分数 0-100
            risks: data.risks || [], // 风险列表
            verified: data.verified || false,
            mintAuthority: data.tokenMeta?.mintAuthority || null,
            freezeAuthority: data.tokenMeta?.freezeAuthority || null,
            supply: data.tokenMeta?.supply || 0,
            mutable: data.tokenMeta?.mutable || false,
            topHolders: data.topHolders || [],
            totalHolders: data.totalHolders || 0,
            lpBurned: data.lpBurned || false,
            lpLocked: data.lpLocked || false
        };
    } catch (error) {
        console.error('安全检测 API 错误:', error.message);
        return null;
    }
}

// 简化版安全检测（备用）
async function checkBasicSecurity(ca) {
    // 这里可以实现自定义检测逻辑
    // 例如检查合约代码、黑名单等
    
    return {
        score: 50, // 默认中等风险
        risks: [],
        verified: false,
        note: '基础检测，建议进一步验证'
    };
}

// 格式化安全报告
function formatSecurityReport(security) {
    if (!security) return '⚠️ 无法获取安全数据';
    
    let emoji = '🟢';
    if (security.score < 80) emoji = '🟡';
    if (security.score < 50) emoji = '🔴';
    
    let report = `${emoji} 安全评分: ${security.score}/100\n`;
    
    // Mint 权限
    if (security.mintAuthority) {
        report += `⚠️ Mint权限: ${security.mintAuthority.slice(0, 8)}...\n`;
    } else {
        report += `✅ Mint权限: 已撤销\n`;
    }
    
    // Freeze 权限
    if (security.freezeAuthority) {
        report += `⚠️ Freeze权限: ${security.freezeAuthority.slice(0, 8)}...\n`;
    } else {
        report += `✅ Freeze权限: 已撤销\n`;
    }
    
    // LP 状态
    if (security.lpBurned) {
        report += `✅ LP已销毁\n`;
    } else if (security.lpLocked) {
        report += `🔒 LP已锁定\n`;
    }
    
    // 持有者分布
    if (security.topHolders.length > 0) {
        const top10Percent = security.topHolders.slice(0, 10)
            .reduce((sum, h) => sum + (h.percent || 0), 0);
        report += `👥 Top10持仓: ${top10Percent.toFixed(2)}%\n`;
    }
    
    // 风险警告
    if (security.risks.length > 0) {
        report += `\n⚠️ 风险警告:\n`;
        security.risks.slice(0, 3).forEach(risk => {
            report += `  • ${risk.name || risk}\n`;
        });
    }
    
    return report;
}

module.exports = {
    checkTokenSecurity,
    checkBasicSecurity,
    formatSecurityReport
};
// 独立的解析测试，不依赖外部模块

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

function parseMarketCap(text) {
    const num = parseFloat(text);
    if (text.includes('K')) return num * 1000;
    if (text.includes('M')) return num * 1000000;
    if (text.includes('B')) return num * 1000000000;
    return num;
}

// 测试
const testMessage = `🤑 最新看涨预测 | #SOLANA 🤑

✅ 代币：The Claudinator

📍 代币符号：$HAL9000

🏦 市值：26.58K

🏷 合约：A3XLb1tbaaPgkJijSCEmR6GhUM1ZBCyc59s2evXtUx5x

🌐 WEB | 🐦 X | 💬 TG`;

console.log('测试消息解析:');
console.log('================');
const result = parseMessage(testMessage);
console.log(result);

if (result) {
    console.log('\n✅ 解析成功!');
    console.log(`链: ${result.chain}`);
    console.log(`代币: ${result.name}`);
    console.log(`符号: ${result.symbol}`);
    console.log(`市值: ${result.marketCap}`);
    console.log(`CA: ${result.ca}`);
} else {
    console.log('\n❌ 解析失败');
}
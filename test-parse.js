const { parseMessage } = require('./bot');

// 测试消息
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
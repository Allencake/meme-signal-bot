const axios = require('axios');

const JUPITER_API = 'https://price.jup.ag/v6';
const DEXSCREENER_API = 'https://api.dexscreener.com/latest';

// 获取代币价格（Jupiter）
async function getTokenPriceJupiter(ca) {
    try {
        const response = await axios.get(`${JUPITER_API}/price`, {
            params: { ids: ca },
            timeout: 5000
        });
        
        const data = response.data.data[ca];
        if (!data) return null;
        
        return {
            price: parseFloat(data.price),
            priceChange24h: data.priceChange24h || 0,
            source: 'jupiter'
        };
    } catch (error) {
        console.error('Jupiter API 错误:', error.message);
        return null;
    }
}

// 获取代币数据（DexScreener）
async function getTokenDataDexScreener(ca) {
    try {
        const response = await axios.get(`${DEXSCREENER_API}/dex/tokens/${ca}`, {
            timeout: 5000
        });
        
        const pairs = response.data.pairs;
        if (!pairs || pairs.length === 0) return null;
        
        // 取流动性最高的交易对
        const bestPair = pairs.sort((a, b) => 
            parseFloat(b.liquidity?.usd || 0) - parseFloat(a.liquidity?.usd || 0)
        )[0];
        
        return {
            price: parseFloat(bestPair.priceUsd),
            priceChange: {
                m5: bestPair.priceChange?.m5 || 0,
                h1: bestPair.priceChange?.h1 || 0,
                h6: bestPair.priceChange?.h6 || 0,
                h24: bestPair.priceChange?.h24 || 0
            },
            volume24h: bestPair.volume?.h24 || 0,
            liquidity: bestPair.liquidity?.usd || 0,
            marketCap: bestPair.marketCap || 0,
            fdv: bestPair.fdv || 0,
            holders: bestPair.holders || 0,
            txns24h: {
                buys: bestPair.txns?.h24?.buys || 0,
                sells: bestPair.txns?.h24?.sells || 0
            },
            pairAddress: bestPair.pairAddress,
            dexId: bestPair.dexId,
            source: 'dexscreener'
        };
    } catch (error) {
        console.error('DexScreener API 错误:', error.message);
        return null;
    }
}

// 获取综合代币数据
async function getTokenData(ca) {
    // 优先使用 DexScreener（数据更全）
    const dexData = await getTokenDataDexScreener(ca);
    if (dexData) return dexData;
    
    // 备用 Jupiter
    const jupiterData = await getTokenPriceJupiter(ca);
    if (jupyterData) {
        return {
            price: jupiterData.price,
            priceChange: { m5: 0, h1: 0, h6: 0, h24: jupiterData.priceChange24h },
            volume24h: 0,
            liquidity: 0,
            marketCap: 0,
            source: 'jupiter'
        };
    }
    
    return null;
}

// 计算相对于买入价的涨幅
function calculateReturns(currentPrice, entryPrice) {
    if (!entryPrice || entryPrice === 0) return { x: 0, percent: 0 };
    const multiplier = currentPrice / entryPrice;
    return {
        x: multiplier,
        percent: (multiplier - 1) * 100
    };
}

module.exports = {
    getTokenPriceJupiter,
    getTokenDataDexScreener,
    getTokenData,
    calculateReturns
};
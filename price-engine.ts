export interface MarketSettings {
  marketCap: number;
  volume24h: number;
  trendDirection: 'up' | 'down' | 'stable';
  trendStrength: number;
  isLocked: boolean;
}

export interface Candle {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  isUp: boolean;
}

export interface PriceData {
  price: number;
  change: number;
  currentCandle: Candle;
  historicalCandles: Candle[];
  marketSettings: MarketSettings;
}

class PriceEngine {
  private currentPrice: number = 1;
  private currentCandle: Candle;
  private historicalCandles: Candle[] = [];
  private marketSettings: MarketSettings = {
    marketCap: 90205331106,
    volume24h: 157000,
    trendDirection: 'stable',
    trendStrength: 1.0,
    isLocked: false
  };

  constructor() {
    // Initialize with current candle
    this.currentCandle = this.createNewCandle();
    this.generateHistoricalData();
    console.log('🎯 Global Price Engine Started');
  }

  private createNewCandle(): Candle {
    const timestamp = Math.floor(Date.now() / 60000) * 60000; // Align to minute
    
    return {
      timestamp,
      open: this.currentPrice,
      high: this.currentPrice,
      low: this.currentPrice,
      close: this.currentPrice,
      volume: 0,
      isUp: true
    };
  }

  private generateHistoricalData() {
    // Generate 24 hours of historical data
    for (let i = 23; i >= 0; i--) {
      const timestamp = Date.now() - i * 3600000;
      const basePrice = 1.00;
      const changePercent = (Math.random() - 0.5) * 0.1; // ±5%
      const close = basePrice * (1 + changePercent);
      
      this.historicalCandles.push({
        timestamp,
        open: basePrice,
        high: Math.max(basePrice, close * 1.02),
        low: Math.min(basePrice, close * 0.98),
        close,
        volume: 1000 + Math.random() * 500,
        isUp: close > basePrice
      });
    }
  }

  public getCurrentData(): PriceData {
    // Generate new price based on global time - same algorithm for all users
    const globalMinute = Math.floor(Date.now() / 60000);
    const timeBasedVariation = Math.sin(globalMinute * 0.1) * 0.05;
    const randomSeed = (globalMinute * 137) % 1000 / 1000;
    const noise = (randomSeed - 0.5) * 0.01;
    
    this.currentPrice = 1.00 + timeBasedVariation + noise;
    this.currentPrice = parseFloat(Math.max(0.5, this.currentPrice).toFixed(4));
    
    // Update current candle
    this.currentCandle.high = Math.max(this.currentCandle.high, this.currentPrice);
    this.currentCandle.low = Math.min(this.currentCandle.low, this.currentPrice);
    this.currentCandle.close = this.currentPrice;
    this.currentCandle.volume += 10 + Math.random() * 20;
    this.currentCandle.isUp = this.currentPrice > this.currentCandle.open;

    // Check if we need to start a new candle (every minute)
    const currentMinute = Math.floor(Date.now() / 60000);
    if (currentMinute > Math.floor(this.currentCandle.timestamp / 60000)) {
      this.historicalCandles.push({...this.currentCandle});
      if (this.historicalCandles.length > 24) {
        this.historicalCandles.shift(); // Keep only 24 hours
      }
      this.currentCandle = this.createNewCandle();
    }

    const change = ((this.currentPrice - 1.00) / 1.00) * 100;

    return {
      price: this.currentPrice,
      change: parseFloat(change.toFixed(2)),
      currentCandle: this.currentCandle,
      historicalCandles: [...this.historicalCandles],
      marketSettings: {...this.marketSettings}
    };
  }

  public updateMarketSettings(settings: Partial<MarketSettings>) {
    this.marketSettings = { ...this.marketSettings, ...settings };
  }

  public getPrice(): number {
    return this.currentPrice;
  }
}

export const priceEngine = new PriceEngine();

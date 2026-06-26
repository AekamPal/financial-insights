#!/usr/bin/env python3
"""
Fetches fundamentals for NSE stocks via yfinance and prints JSON.
Usage: python fetch_fundamentals.py RELIANCE.NS [TCS.NS ...]
"""
import sys, json

try:
    import yfinance as yf
except ImportError:
    print(json.dumps({"error": "yfinance not installed — run: pip install yfinance"}))
    sys.exit(0)

FIELDS = [
    "trailingPE", "trailingEps", "priceToBook",
    "marketCap", "dividendYield",
    "fiftyTwoWeekHigh", "fiftyTwoWeekLow",
    "industry", "sector",
    "regularMarketDayHigh", "regularMarketDayLow",
    "regularMarketVolume", "averageDailyVolume3Month",
]

def get_info(symbol):
    try:
        info = yf.Ticker(symbol).info
        result = {}
        for f in FIELDS:
            val = info.get(f)
            # dividendYield comes as fraction, convert to percent
            if f == "dividendYield" and val is not None:
                val = round(val * 100, 4)
            if val is not None:
                result[f] = val
        return result
    except Exception as e:
        return {"error": str(e)}

symbols = sys.argv[1:]
if not symbols:
    print(json.dumps({"error": "no symbols provided"}))
    sys.exit(0)

output = {sym: get_info(sym) for sym in symbols}
print(json.dumps(output))

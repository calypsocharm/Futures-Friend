import { NextRequest, NextResponse } from "next/server";
import type { Bar, Timeframe } from "@/lib/types";
import { aggregateBars, symbolDef, yahooSpec } from "@/lib/symbols";

export const dynamic = "force-dynamic";

interface YahooResult {
  chart: {
    result?: Array<{
      timestamp?: number[];
      indicators?: { quote?: Array<{ open: number[]; high: number[]; low: number[]; close: number[]; volume: number[] }> };
      meta?: { regularMarketPrice?: number; chartPreviousClose?: number };
    }>;
    error?: unknown;
  };
}

export async function GET(req: NextRequest) {
  const symbol = req.nextUrl.searchParams.get("symbol");
  const tf = req.nextUrl.searchParams.get("tf") as Timeframe | null;
  if (!symbol || !tf) {
    return NextResponse.json({ error: "symbol and tf required" }, { status: 400 });
  }
  const def = symbolDef(symbol);
  if (!def) {
    return NextResponse.json({ error: "unknown symbol" }, { status: 400 });
  }
  const spec = yahooSpec(tf);
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
    def.yahoo
  )}?interval=${spec.yahooInterval}&range=${spec.range}&includePrePost=false`;

  try {
    const upstream = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
        Accept: "application/json",
      },
      cache: "no-store",
    });
    if (!upstream.ok) {
      return NextResponse.json(
        { error: `upstream ${upstream.status}`, source: "yahoo" },
        { status: 502 }
      );
    }
    const data: YahooResult = await upstream.json();
    const result = data.chart?.result?.[0];
    if (!result || !result.timestamp || !result.indicators?.quote?.[0]) {
      return NextResponse.json({ error: "no bars in response" }, { status: 502 });
    }
    const ts = result.timestamp;
    const q = result.indicators.quote[0];
    const bars: Bar[] = [];
    for (let i = 0; i < ts.length; i++) {
      const o = q.open[i];
      const h = q.high[i];
      const l = q.low[i];
      const c = q.close[i];
      if (o == null || h == null || l == null || c == null) continue;
      const v = q.volume[i];
      bars.push({ time: ts[i] * 1000, open: o, high: h, low: l, close: c, volume: v ?? undefined });
    }
    const final = spec.aggregate ? aggregateBars(bars, spec.aggregate) : bars;
    return NextResponse.json(
      { symbol, tf, bars: final, count: final.length, fetchedAt: Date.now(), live: true },
      { headers: { "Cache-Control": "public, max-age=30" } }
    );
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "fetch failed" },
      { status: 500 }
    );
  }
}
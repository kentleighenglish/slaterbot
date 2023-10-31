// import googleFinance from "google-finance";
import yahooFinance from "yahoo-finance2";
import moment, { Moment } from "moment";
import debugFunc from "debug";
import * as cheerio from "cheerio";
import { get, set, reduce } from "lodash";
import fileCache from "node-file-cache";
import timezones from "timezone-abbr-offsets";
import { resolve } from "path";

type HistoricalQuarters = { 1?: number, 2?: number, 3?: number, 4?: number };
type HistoricalYear = { [key: string]: HistoricalQuarters };
type HistoricalData = {
	[key: string]: HistoricalYear
}

const cache = fileCache.create({
	file: resolve("./.cache")
});

const log = debugFunc("bot:engine:analysis");

const arrayAvg = (array: number[]): number => array.reduce((acc, num) => acc + num, 0) / array.length;

const cagr = (oldVal: number, newVal: number, time: number): number => (Math.pow(newVal / oldVal, (1 / time)) - 1);

const parseEarningsDate = (earningsDate: string): Moment => {
	const match = earningsDate.match(
		/^([A-z]{3})\s(\d+),\s(\d+),\s(\d+)\s(AM|PM)([A-Z]{3,4})$/
	) as any[];
	const [wholeMatch, month, day, year, time24, meridiem, timezone] = match;

	const date = moment();
	date.year(year);
	date.month(month);
	date.date(day);
	date.minute(0);
	date.second(0);

	const tz = get(timezones, timezone, null);

	if (tz) {
		date.utcOffset(tz);
	}

	if (meridiem === "AM") {
		if (time24 === "12") {
			date.hour(0);
		} else {
			date.hour(time24);
		}
	} else if (meridiem === "PM") {
		if (time24 === "12") {
			date.hour(time24);
		} else {
			date.hour(12 + Number(time24));
		}
	}

	return date;
};

// Get popular/top stocks, maybe top 20 at least
const getTrending = async () => {
	log("Fetching trending");
	const { quotes = [] } = await yahooFinance.trendingSymbols("US", {
		count: 20,
		lang: "en-US",
	});

	return quotes.map((quote) => quote?.symbol);
};

type PriceRow = { [key: string]: any };
const getHistoricalPrice = async (symbols: string[], dateRange): Promise<HistoricalData> => {
	const yahooResults = await symbols.reduce(async (pr, symbol) => {
		log(`Fetching historical price for ${symbol}`);
		const out: { [key: string]: any } = await pr;

		const response = await yahooFinance.historical(symbol, {
			period1: dateRange.from,
			period2: dateRange.to,
			interval: "1mo",
		});

		const symbolData = response.reduce((acc: PriceRow, point) => {
			const date = moment(point.date);

			const q = date.quarter();
			const year = date.year();

			const quarter: number[] = get(acc, `${year}.${q}`, []);

			quarter.push(point.close || point.open);

			acc[year] = {
				...(acc[year] || {}),
				[q]: quarter
			}

			return acc;
		}, {});

		out[symbol] = reduce(symbolData,(acc: PriceRow, quarters, year) => {
			acc[year] = reduce(quarters, (acc2, q, key) => ({
				...acc2,
				[key]: arrayAvg(q)
			}), {});

			return acc;
		}, {});

		return out;
	}, Promise.resolve({}));

	return yahooResults;
};

type EpsRow = { [key: string]: any };
type EpsQuarter = { 1?: number, 2?: number, 3?: number, 4?: number };
type SymbolData = { [key: string]: EpsQuarter };
const getHistoricalEps = async (symbols: string[], dateRange): Promise<HistoricalData> => {

	const yahooResults = await symbols.reduce(async (pr, symbol) => {
		log(`Fetching historical EPS for ${symbol}`);

		const out: { [key: string]: any } = await pr;

		let responseHtml = cache.get(`historicalEps_${symbol}`);

		if (!responseHtml) {
			const response = await fetch(
				`https://finance.yahoo.com/calendar/earnings?symbol=${symbol}`
			);

			responseHtml = await response.text();

			cache.set(`historicalEps_${symbol}`, responseHtml, {
				life: (60 * 60 * 24 * 30)
			});
		}

		const doc = cheerio.load(responseHtml);

		const body = doc("table tbody tr").toArray();

		const symbolData: SymbolData = {};

		body.forEach((row) => {
			const tr = cheerio.load(row);
			const cols = tr("td").toArray();

			const outputRow: EpsRow = cols.reduce((acc2, col) => {
				const td = cheerio.load(col);
				const children = td("*").children().toArray();

				const content = td.text();
				const colHead: string = td("*").attr("aria-label") as string;

				return {
					...acc2,
					[colHead]: content,
				};
			}, {});

			const earningsDate = parseEarningsDate(outputRow["Earnings Date"]);

			if (earningsDate.isBetween(dateRange.from, dateRange.to)) {
				const quarter = earningsDate.format("Q");
				const year = earningsDate.format("YYYY");

				symbolData[year] = {
					...(symbolData[year] || {}),
					[quarter]: outputRow["EPS Estimate"] === "-" ? null : Number(outputRow["EPS Estimate"])
				}
			}
		});

		out[symbol] = symbolData;

		return out;
	}, Promise.resolve({}));

	return yahooResults;
};

const calculateHistoricalPeRatio = (price: HistoricalData, eps: HistoricalData): HistoricalData => {
	log("Calculating historical price-earnings ratio");

	return reduce(price, (acc1: any, symbolData, symbol) => {
		const symbolEps = reduce(symbolData, (acc2: any, quarters, year) => {
			const yearEps = reduce(quarters, (acc3: any, avgPrice, q) => {
				const epsVal = get(eps, [symbol, year, q], null);

				if (avgPrice && epsVal) {
					acc3.push(avgPrice / epsVal);
				}

				return acc3;
			}, []);

			const avg = arrayAvg(yearEps);

			if (avg) {
				acc2.push(avg);
			}

			return acc2;
		}, []);

		const symbolPe = arrayAvg(symbolEps);

		if (symbolPe) {
			acc1[symbol] = symbolPe;
		}

		return acc1;
	}, {});
}

const getHistoricalGrowth = async (symbols: string[]) => {
	const results = await symbols.reduce(async (pr, symbol) => {
		log(`Fetching historical growth data for ${symbol}`);

		const out: { [key: string]: any } = await pr;

		const result = await yahooFinance.quoteSummary(symbol, {
			modules: ["incomeStatementHistory", "balanceSheetHistory", "cashflowStatementHistory"]
		});

		const symbolData: any = {};

		const {
			balanceSheetHistory,
			incomeStatementHistory,
			cashflowStatementHistory,
		} = result;

		balanceSheetHistory?.balanceSheetStatements.forEach((balance: any) => {
			const { endDate, totalCurrentAssets, totalAssets, totalLiab } = balance;
			const year = moment(endDate).format("YYYY");

			set(symbolData, year, {
				...(symbolData[year] || {}),
				totalCurrentAssets,
				totalAssets,
				reserves: totalLiab
			});
		});
		incomeStatementHistory?.incomeStatementHistory.forEach((income: any) => {
			const { endDate, operatingIncome, netIncome } = income;
			const year = moment(endDate).format("YYYY");

			set(symbolData, year, {
				...(symbolData[year] || {}),
				totalIncome: operatingIncome,
				netProfit: netIncome
			});
		});
		cashflowStatementHistory?.cashflowStatements.forEach((cashFlow: any) => {
			const { endDate, totalCashFromOperatingActivities } = cashFlow;
			const year = moment(endDate).format("YYYY");

			set(symbolData, year, {
				...(symbolData[year] || {}),
				netCashFromOperating: totalCashFromOperatingActivities
			});
		});

		out[symbol] = symbolData;

		return out;
	}, Promise.resolve({}));

	return results;
}

export const runAnalysis = async (symbol?: string) => {
	let symbols = [];
	if (!symbol) {
		symbols = await getTrending();
		log("Trending:", symbols);
	} else {
		symbols = [symbol];
	}

	const to = moment().month(0).date(0).format("YYYY-MM-DD");
	const from = moment().subtract(3, "years").month(0).date(0).format("YYYY-MM-DD");
	log(`Getting data for date range: ${from} - ${to}`);


	const historicalPrice = await getHistoricalPrice(["AAPL"], { to, from });
	const historicalEps = await getHistoricalEps(["AAPL"], { to, from });
	console.log(historicalPrice, historicalEps);

	const historicalPeRatio = await calculateHistoricalPeRatio(historicalPrice, historicalEps);

	// const historicalGrowth = await getHistoricalGrowth(["AAPL"], { to, from });

	log("DONE");

	// Return list of stocks with ratings
};

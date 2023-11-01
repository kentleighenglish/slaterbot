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

interface DateRange {
	to: string;
	from: string;
}

const cache = fileCache.create({
	file: resolve("./.cache")
});

const log = debugFunc("bot:engine:analysis");

const growthWeights: any = {
	totalIncome: .2,
	totalCurrentAssets: .05,
	totalAssets: .1,
	reserves: .05,
	netProfit: .2,
	netCashFromOperating: .15,
	eps: .25
}

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
const getHistoricalPrice = async (symbols: string[], dateRange: DateRange): Promise<HistoricalData> => {
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
const getHistoricalEps = async (symbols: string[], dateRange: DateRange): Promise<HistoricalData> => {

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
		const yearEps = reduce(symbolData, (acc2: any, quarters, year) => {
			const yearVals = Object.values(quarters);
			const epsVals = Object.values(get(eps, [symbol, year], {}));
			
			const yearVal = arrayAvg(yearVals);
			const epsVal = arrayAvg(epsVals);

			// const avg = arrayAvg(yearEps);

			acc2[year] = {
				priceAvg: yearVal,
				epsAvg: epsVal,
				pe: yearVal / epsVal
			}

			return acc2;
		}, {});
		
		const epsTotals = Object.values(yearEps).map((year: any) => year.pe);

		const pe = arrayAvg(epsTotals);

		acc1[symbol] = {
			yearData: yearEps,
			pe
		};

		return acc1;
	}, {});
}

const getHistoricalGrowth = async (symbols: string[], eps: any, dateRange: DateRange) => {
	const results = await symbols.reduce(async (pr, symbol) => {
		log(`Fetching historical growth data for ${symbol}`);
		const symbolEps = eps[symbol];

		const out: { [key: string]: any } = await pr;

		const result = await yahooFinance.quoteSummary(symbol, {
			modules: ["incomeStatementHistory", "balanceSheetHistory", "cashflowStatementHistory", "earningsHistory"]
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

			if(moment(endDate).isBetween(dateRange.from, dateRange.to)) {
				set(symbolData, year, {
					...(symbolData[year] || {}),
					totalCurrentAssets,
					totalAssets,
					reserves: totalLiab
				});
			}
		});
		incomeStatementHistory?.incomeStatementHistory.forEach((income: any) => {
			const { endDate, operatingIncome, netIncome } = income;
			const year = moment(endDate).format("YYYY");

			if(moment(endDate).isBetween(dateRange.from, dateRange.to)) {
				set(symbolData, year, {
					...(symbolData[year] || {}),
					totalIncome: operatingIncome,
					netProfit: netIncome
				});
			}
		});
		cashflowStatementHistory?.cashflowStatements.forEach((cashFlow: any) => {
			const { endDate, totalCashFromOperatingActivities } = cashFlow;
			const year = moment(endDate).format("YYYY");

			if(moment(endDate).isBetween(dateRange.from, dateRange.to)) {
				set(symbolData, year, {
					...(symbolData[year] || {}),
					netCashFromOperating: totalCashFromOperatingActivities
				});
			}
		});

		Object.keys(symbolData).forEach((year) => {
			const epsYear: { [key: string]: number } = symbolEps[year] || {};
			const epsTotal = Object.values(epsYear).reduce((acc: number, eps: number) => acc + eps, 0);

			symbolData[year].eps = epsTotal;
		})

		out[symbol] = symbolData;

		return out;
	}, Promise.resolve({}));

	return results;
}

const calculateGrowthRate = (growthData: any) => {
	return reduce(growthData, (acc: any, data, symbol) => {
		const coll = Object.values(data);
		const collKeys: number[] = Object.keys(data).map(year => Number(year));

		const oldest: any = coll[0];
		const newest: any = coll[coll.length - 1];

		const diff = (collKeys[collKeys.length -1] - collKeys[0]) + 1;

		const weightedCagr = reduce(oldest, (acc2: any, val, key) => ({
			...acc2,
			[key]: cagr(oldest[key], newest[key], diff) * growthWeights[key],
		}), {});

		acc[symbol] = reduce(weightedCagr, (acc, val) => acc + val, 0);

		return acc;
	}, {});
}

const calculateFutureEps = (rateSymbols: { [key: string]: number }, data: { [key: string]: any }, years: number = 3) => {
	return reduce(rateSymbols, (acc: any, rate, symbol) => {
		const futureEps: any = {};
		for(let i = 1; i <= years; i++) {
			const newDate = moment().add(i, "years").format("YYYY");
			const dataArr = Object.values(data[symbol]);
			const recentData: any = dataArr[dataArr.length - 1];
	
			const eps = recentData?.eps;

			futureEps[newDate] = eps * Math.pow(1 + (rate / 100), i)
		}
		acc[symbol] = futureEps;
		
		return acc;
	}, {});
}

export const runAnalysis = async (symbols: string | string[] = []) => {
	if (!symbols.length) {
		symbols = await getTrending();
		log("Trending:", symbols);
	} else if (!Array.isArray(symbols)) {
		symbols = [symbols];
	}

	symbols = ["AAPL"];

	const to = moment().month(0).date(0).format("YYYY-MM-DD");
	const from = moment().subtract(3, "years").month(0).date(0).format("YYYY-MM-DD");
	log(`Getting data for date range: ${from} - ${to}`);


	const price = await getHistoricalPrice(symbols, { to, from });
	const eps = await getHistoricalEps(symbols, { to, from });
	
	const pe = calculateHistoricalPeRatio(price, eps);

	const growthData = await getHistoricalGrowth(symbols, eps, { to, from });
	const growthRate = await calculateGrowthRate(growthData);

	const pastEps = reduce(eps, (acc, years, symbol) => ({
		...acc,
		[symbol]: reduce(years, (acc2, epsQ, year) => ({
			...acc2,
			[year]: Object.values(epsQ).reduce((acc3, eps) => acc3 + eps, 0)
		}), {})
	}), {});
	const futureEps = await calculateFutureEps(growthRate, growthData);
	console.log(JSON.stringify(pastEps));
	console.log(JSON.stringify(futureEps));

	log("DONE");

	// Return list of stocks with ratings
};

// import googleFinance from "google-finance";
import yahooFinance from "yahoo-finance2";
import moment, { Moment } from "moment";
import debugFunc from "debug";
import * as cheerio from "cheerio";
import { get, set } from "lodash";

const log = debugFunc("bot:engine:analysis");

const timezones = {
	EST: -5,
	EDT: -4,
	CST: -6,
	CDT: -5,
	MST: -7,
	MDT: -6,
	PST: -8,
	PDT: -7
};

const avg = (array: number[]) => array.reduce((acc, num) => acc + num, 0) / array.length;

const parseEarningsDate = (earningsDate: string): Moment => {
	const match = earningsDate.match(
		/^([A-z]{3})\s(\d+),\s(\d+),\s(\d+)\s(AM|PM)([A-Z]{3})$/
	) as any[];
	const [wholeMatch, month, day, year, time24, meridiem, timezone] = match;

	const date = moment();
	date.year(year);
	date.month(month);
	date.date(day);
	date.minute(0);
	date.second(0);

	if (timezones[timezone]) {
		date.utcOffset(timezones[timezone]);
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
	if (!process.env.FINANCEAPI_KEY) {
		throw "Please define FINANCEAPI_KEY";
	}

	log("Fetching trending");
	const { quotes = [] } = await yahooFinance.trendingSymbols("US", {
		count: 20,
		lang: "en-US",
	});

	return quotes.map((quote) => quote?.symbol);
};

const getHistoricalPrice = async (symbols: string[]) => {
	log(`Fetching historical price for ${symbols}`);
	const period2 = moment().format("YYYY-MM-DD");
	const period1 = moment().subtract(3, "years").format("YYYY-MM-DD");

	const yahooResults = await symbols.reduce(async (pr, symbol) => {
		const out: { [key: string]: any } = await pr;

		const response = await yahooFinance.historical(symbol, {
			period1,
			period2,
			interval: "1mo",
		});

		out[symbol] = response.reduce((acc, point) => {
			const date = moment(point.date);

			const q = date.quarter();
			const year = date.year();

			const quarter = get(acc, `${year}.${q}`, []);

			quarter.push(point.close || point.open);

			acc[year] = {
				...(acc[year] || {}),
				[q]: quarter
			}

			return acc;
		}, {});

		// return out.reduce((acc: { [key: string]}, year: { [key: string]: number[] }) => {
		// 	acc[year] = Object.keys(year).reduce((acc2, quarter) => ({
		// 		...acc2,
		// 		[quarter]: avg(year[quarter])
		// 	}), {});

		// 	return acc;
		// });

		return out;
	}, Promise.resolve({}));

	return yahooResults;
};

type EpsRow = { [key: string]: any };
const getHistoricalEps = async (symbols: string[]) => {
	const to = moment().format("YYYY-MM-DD");
	const from = moment().subtract(3, "years").format("YYYY-MM-DD");
	log("Fetching EPS");

	const yahooResults = await symbols.reduce(async (pr, symbol) => {
		const out: { [key: string]: any } = await pr;

		const response = await fetch(
			`https://finance.yahoo.com/calendar/earnings?symbol=${symbol}`
		);
		const html = await response.text();

		const doc = cheerio.load(html);

		const body = doc("table tbody tr").toArray();

		const symbolData = {};

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

			if (earningsDate.isBetween(from, to)) {
				const quarter = earningsDate.format("Q");
				const year = earningsDate.format("YYYY");

				symbolData[year] = {
					...(symbolData[year] || {}),
					[quarter]: outputRow["EPS Estimate"]
				}
			}
		});

		out[symbol] = symbolData;

		return out;
	}, Promise.resolve({}));

	return yahooResults;
};

const calculatePower = async (symbol: string) => {
	// Use PE-EPS method to predict stock power
};

const getRatings = async (symbols) => {
	// const searchMultiple = await yahooFinance2.recommendationsBySymbol([
	// 	'AAPL',
	// 	'BMW.DE',
	// 	]);
	// https://site.financialmodelingprep.com/developer/docs#company-rating-company-information
};

export const runAnalysis = async () => {
	const trending = await getTrending();
	log("Trending:", trending);

	const historicalPrice = await getHistoricalPrice(trending);
	console.log(JSON.stringify(historicalPrice));
	// const historicalEps = await getHistoricalEps(trending);

	log("DONE");

	// Return list of stocks with ratings
};

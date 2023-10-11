import debugFunc from "debug";
const log = debugFunc("bot:main");

import Alpaca from "@alpacahq/alpaca-trade-api";
import Watchlist from "./watchlist.js";

const symbols = (process.env.SYMBOLS||"").split(",").map(s => s.trim());
const positions = [];
let account = null;
let balance = null;

const watchers = {};

const CHECK_INTERVAL = 5000;

const alpaca = new Alpaca({
	keyId: process.env.ALPACA_KEY,
	secretKey: process.env.ALPACA_SECRET,
	paper: true,
});

const watchlist = new Watchlist(alpaca);

const checkSymbol = async (symbol) => {
	log (`Checking data for ${symbol}`);
	let closePosition = false;
	const response = await alpaca.getLatestTrade(symbol);
	
	log(response);
	
	if (!closePosition) {
		setTimeout(() => checkSymbol(symbol), CHECK_INTERVAL);
	}
}

const watchSymbol = async (symbol) => {
	log(`Watching symbol: ${symbol}`);
	
	log (`Adding ${symbol} to watchlist`);

	await watchlist.addToWatchlist(symbol);
	
	// initialise loop
	checkSymbol(symbol);
}

const init = async () => {
	log("Starting bot");
	
	await watchlist.fetchWatchlist();
	
	account = await alpaca.getAccount();
	balance = account.equity;
	
	for (let symbol of symbols) {
		watchSymbol(symbol);
	}
	log("Bot initialised");
}

init();
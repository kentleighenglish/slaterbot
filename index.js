import debugFunc from "debug"
const log = debugFunc("bot:main");

import Alpaca from "@alpacahq/alpaca-trade-api";

const symbols = (process.env.SYMBOLS||"").split(",").map(s => s.trim());
const positions = [];
let account = null;
let balance = null;

const alpaca = new Alpaca({
	keyId: process.env.ALPACA_KEY,
	secretKey: process.env.ALPACA_SECRET,
	paper: true,
});

const watchSymbol = async (symbol) => {
	log(`Watching symbol: ${symbol}`);
}

const init = async () => {
	log("Starting bot");

	account = await alpaca.getAccount();
	balance = account.equity;

	for (let symbol of symbols) {
		watchSymbol(symbol);
	}
	log("Bot initialised");
}

init();

// const socket = alpaca.data_stream_v2;

// socket.onConnect(function () {
//   console.log("Connected");
//   socket.subscribeForQuotes(["AAPL"]);
//   socket.subscribeForTrades(["FB"]);
//   socket.subscribeForBars(["SPY"]);
//   socket.subscribeForStatuses(["*"]);
// });

// socket.onError((err) => {
//   console.log(err);
// });

// socket.onStockTrade((trade) => {
//   console.log(trade);
// });

// socket.onStockQuote((quote) => {
//   console.log(quote);
// });

// socket.onStockBar((bar) => {
//   console.log(bar);
// });

// socket.onStatuses((s) => {
//   console.log(s);
// });

// socket.onStateChange((state) => {
//   console.log(state);
// });

// socket.onDisconnect(() => {
//   console.log("Disconnected");
// });

// socket.connect();
const log = require("debug")("bot:main");

const Alpaca = require("@alpacahq/alpaca-trade-api");

const symbols = (process.env.SYMBOLS||"").split(",").map(s => s.trim());
const positions = [];
let account = null;
let balance = null;

let watchlist = null;

const watchers = {};

const CHECK_INTERVAL = 5000;

const alpaca = new Alpaca({
	keyId: process.env.ALPACA_KEY,
	secretKey: process.env.ALPACA_SECRET,
	paper: true,
});

const createWatchlist = async () => {
  try {
   const watchlists = await alpaca.getWatchlists();
    
    watchlists.forEach(w => {
      if (w.name === "slaterbot") {
        watchlist = w;
      }
    });
    
    if (!watchlist) {
      const response = await alpaca.addWatchlist("slaterbot", []);
      watchlist = response;
    }
  } catch(e) {
    console.error(e);
    
    return;
  }
}

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
  //await alpaca.addToWatchlist(watchlist.id, symbol);
  
  // initialise loop
  checkSymbol(symbol);
}

const init = async () => {
	log("Starting bot");
  
  await createWatchlist();

	account = await alpaca.getAccount();
	balance = account.equity;

	for (let symbol of symbols) {
		watchSymbol(symbol);
	}
	log("Bot initialised");
}

init();
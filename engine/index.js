import debugFunc from "debug";
import Alpaca from "@alpacahq/alpaca-trade-api";
import moment from "moment";

import Watchlist from "./watchlist.js";
const log = debugFunc("bot:engine");

export class Engine {
	_alpaca = null;
	_subscribers = [];

	account = null;
	watchers = {};
	symbols = (process.env.SYMBOLS||"").split(",").map(s => s.trim());
	watchlist = null;

	positions = [];
	dataset = {};

	get output() {
		return {
			positions: this.positions,
			dataset: this.dataset,
			balance: this.account?.equity,
			cash: this.account?.cash,
			buyingPower: this.account?.buying_power
		};
		
	}

	constructor() {
		this._alpaca = new Alpaca({
			keyId: process.env.ALPACA_KEY,
			secretKey: process.env.ALPACA_SECRET,
			paper: true,
		});

		this.watchlist = new Watchlist(this._alpaca);

		this.init();
	}

	async init() {
		log("Starting engine");
	
		await this.watchlist.assertWatchlist();
		
		this.runCheck();
		log("Engine started");
	}

	async runCheck(symbol) {
		log("Running check");
		this.account = await this._alpaca.getAccount();
		
		await this.updateSymbols(symbol);

		// @todo clear positions

	
		log("Dispatching update");
		this.dispatch(this.output);
		setTimeout(() => this.runCheck(), process.env.INTERVAL || 5000);
	}

	async updateSymbols() {
		log("Updating symbols");
		const symbols = this.symbols;
		
		const latestTrades = await this._alpaca.getLatestTrades(symbols);

		const end = moment().toISOString();
		const start = moment().subtract(5, "minutes").toISOString();
		
		for (let symbol of symbols) {
			log (`Adding ${symbol} to watchlist`);
			await this.watchlist.addToWatchlist(symbol);

			log (`Updating data for ${symbol}`);
			const latestTrade = latestTrades.get(symbol);
			console.log(latestTrade);

			this.dataset[symbol] = {
				value: latestTrade.Price,
				timestamp: latestTrade.Timestamp
			}
		}
	}

	dispatch(data) {
        for (var i = 0; i < this._subscribers.length; i++)
            this._subscribers[i](data);
	}

    subscribe(callback) {
        this._subscribers.push(callback);
    }
}

export default Engine;
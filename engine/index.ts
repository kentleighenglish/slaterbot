import debugFunc from "debug";
import Alpaca from "@alpacahq/alpaca-trade-api";
import { Server } from "socket.io";
import moment from "moment";

import Watchlist from "./watchlist";
const log = debugFunc("bot:engine");

import { runAnalysis } from "./analysis";

export default class Engine {
	_alpaca: Alpaca;
	_io: Server;
	_subscribers: Function[] = [];

	account: any = null;
	watchers = {};
	symbols = (process.env.SYMBOLS||"").split(",").map(s => s.trim());
	watchlist: Watchlist;

	positions = [];
	dataset: { [key: string]: any } = {};

	get output() {
		return {
			positions: this.positions,
			dataset: this.dataset,
			balance: this.account?.equity,
			cash: this.account?.cash,
			buyingPower: this.account?.buying_power
		};

	}

	constructor(io: Server) {
		const { ALPACA_KEY, ALPACA_SECRET } = process.env;
		if (!ALPACA_KEY || !ALPACA_SECRET) {
			throw "ALPACA_KEY and ALPACA_SECRET need to be defined";
		}

		this._alpaca = new Alpaca({
			keyId: process.env.ALPACA_KEY as string,
			secretKey: process.env.ALPACA_SECRET as string,
			paper: true,
		});
		this._io = io;

		this.watchlist = new Watchlist(this._alpaca);

		this.init();
	}

	async init() {
		log("Starting engine");

		await this.watchlist.assertWatchlist();

		runAnalysis();
		// this.runCheck();
		log("Engine started");
	}

	async runCheck() {
		const interval = Number(process.env.INTERVAL as string) || 5000;

		log("Running check");
		this.account = await this._alpaca.getAccount();

		await this.updateSymbols();

		// @todo clear positions

		log("Dispatching update");
		this.dispatch(this.output);
		setTimeout(() => this.runCheck(), interval);
	}

	async updateSymbols() {
		log("Updating symbols");
		const symbols = this.symbols;

		const latestTrades = await this._alpaca.getLatestTrades(symbols);
		const trajectory = await this.getSymbolsTrajectory();

		const end = moment().toISOString();
		const start = moment().subtract(5, "minutes").toISOString();

		for (let symbol of symbols) {
			await this.watchlist.addToWatchlist(symbol);

			log (`Updating data for ${symbol}`);
			const latestTrade: any = latestTrades.get(symbol);

			this.dataset[symbol] = {
				value: latestTrade.Price,
				timestamp: latestTrade.Timestamp
			}
		}
	}

	async getSymbolsTrajectory() {
		// const longHistorical = await historical.getLong(this.symbols);

		// log(longHistorical);
	}

	dispatch(data: object) {
		for (var i = 0; i < this._subscribers.length; i++)
		this._subscribers[i](data);
	}

	subscribe(callback: (data: any) => {}) {
		this._subscribers.push(callback);
	}
}
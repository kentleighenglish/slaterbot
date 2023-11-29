import debugFunc from "debug";
import Alpaca from "@alpacahq/alpaca-trade-api";
import { Server } from "socket.io";
import moment from "moment";
import { CronJob } from "cron";
import config from "config";

import Watchlist from "./watchlist";
const log = debugFunc("bot:engine");

import { runAnalysis } from "./analysis";

export default class Engine {
	_alpaca: Alpaca;
	_io: Server;
	_subscribers: Function[] = [];
	readonly _version = 0.1;

	account: any = null;
	watchers = {};
	watchlist: Watchlist;

	positions = [];
	dataset: { [key: string]: any } = {};
	latestAnalysis: any[] = [];
	checkRunning: boolean = false;

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
		const key =  config.get("alpaca.key");
		const secret =  config.get("alpaca.secret");

		if (!key || !secret) {
			throw "ALPACA_KEY and ALPACA_SECRET need to be defined";
		}

		this._alpaca = new Alpaca({
			keyId: key,
			secretKey: secret,
			paper: true,
		});
		this._io = io;

		this.watchlist = new Watchlist(this._alpaca);

		this.init();
	}

	async init() {
		log("Starting engine");
		const interval: string = config.get("interval");

		await this.watchlist.assertWatchlist();

		// this.runCheck();
		const job = new CronJob(interval, async () => {
			if (!this.checkRunning) {
				this.checkRunning = true;

				await this.runCheck();
				this.checkRunning = false;
			}
		});

		job.start();
		log("Engine started");
	}

	async runCheck() {
		const maxPositions: number = config.get("maxPositions");
		log("Running check");
		this.account = await this._alpaca.getAccount();

		const positions = await this.getPositions();

		// @todo clear positions

		if (positions.length < maxPositions) {
			// const analysis = await runAnalysis();

		}

		log("Dispatching update");
		this.dispatch(this.output);
	}

	async getPositions(): Promise<any[]> {
		const alpacaPositions = await this._alpaca.getPositions();

		return alpacaPositions.map((pos: any) => ({
			id: pos.asset_id,
			symbol: pos.symbol,
			costBasis: pos.cost_basis,
			marketValue: pos.market_value,
			unrealisedProfitLoss: pos.unrealized_pl,
		}));
	}

	dispatch(data: object) {
		for (var i = 0; i < this._subscribers.length; i++)
		this._subscribers[i](data);
	}

	subscribe(callback: (data: any) => {}) {
		this._subscribers.push(callback);
	}
}
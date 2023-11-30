import debugFunc from "debug";
import Alpaca from "@alpacahq/alpaca-trade-api";
import { Server } from "socket.io";
import moment from "moment";
import { CronJob } from "cron";
import config from "config";
import fileCache from "node-file-cache";
import { resolve } from "path";

import Watchlist from "./watchlist";
const log = debugFunc("bot:engine");

import { runAnalysis } from "./analysis";

const cache = fileCache.create({
	file: resolve("./.engine.cache")
});

interface AlpacaPosition {
	id: string;
	symbol: string;
	costBasis: number;
	marketValue: number;
	unrealisedProfitLoss: number;
}

interface PositionData {
	stop: number;
	hardStop: number;
	confidence: number;
}

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

		const job = new CronJob(interval, async () => {
			if (!this.checkRunning) {
				this.checkRunning = true;

				let clock = await this._alpaca.getClock();
				if (clock.is_open) {
					await this.runCheck();
				}

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

		const updatedPositions: AlpacaPosition[] = await this.checkPositions(positions);

		if (updatedPositions.length < maxPositions) {
			// const analysis = await runAnalysis();

		}

		log("Dispatching update");
		this.dispatch(this.output);
	}

	async getPositions(): Promise<AlpacaPosition[]> {
		const alpacaPositions = await this._alpaca.getPositions();

		return alpacaPositions.map((pos: any) => ({
			id: pos.asset_id,
			symbol: pos.symbol,
			costBasis: pos.cost_basis, // purchase cost
			marketValue: pos.market_value, // current price
			unrealisedProfitLoss: pos.unrealized_pl, // profit/loss made on position
		}));
	}

	async checkPositions(positions: AlpacaPosition[]): Promise<AlpacaPosition[]> {
		console.log(positions);
		return await positions.reduce((acc, pos: AlpacaPosition) => {
			const result = this.checkPosition(pos);

			if (!!result) {
				acc.push(pos);
			}

			return acc;
		}, [] as AlpacaPosition[]);
	}

	async checkPosition(position: AlpacaPosition): Promise<AlpacaPosition | null> {
		const key = `positionData_${position.symbol}`;
		const positionData: PositionData = cache.get(key);

		const clear = async () => {
			await this.closePosition(position);
			return null;
		}

		if (!positionData) {
			return await clear();
		}

		if (position.marketValue <= positionData.stop) {
			if (position.marketValue <= positionData.hardStop) {
				return await clear();
			}
		}

		return null;
	}

	async closePosition(position: AlpacaPosition): Promise<void> {
		try {
			await this._alpaca.closePosition(position.symbol);
		} catch(e) {
			log("Error while closing position", e);
		}
	}

	async openPosition(): Promise<void> {

	}

	dispatch(data: object) {
		for (var i = 0; i < this._subscribers.length; i++)
		this._subscribers[i](data);
	}

	subscribe(callback: (data: any) => {}) {
		this._subscribers.push(callback);
	}
}
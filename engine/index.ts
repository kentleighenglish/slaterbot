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
	active?: boolean;
	cacheKey: string;
}

interface PositionData {
	stop: number;
	hardStop: number;
	confidence: number;
	gracePeriod: string;
}

export default class Engine {
	_alpaca: Alpaca;
	_io: Server;
	_subscribers: Function[] = [];
	readonly _version = 0.1;

	account: any = null;
	watchers = {};
	watchlist: Watchlist;

	positions: AlpacaPosition[] = [];
	dataset: { [key: string]: any } = {};
	latestAnalysis: any[] = [];
	checkRunning: boolean = false;
	maxPositions: number;

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
		this.maxPositions = config.get("maxPositions");

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
				} else {
					log("Market closed");
				}

				this.checkRunning = false;
			}
		});

		job.start();
		log("Engine started");
	}

	async runCheck() {
		log("Running check");
		this.account = await this._alpaca.getAccount();
		const maxGracePeriod: number = config.get("maxGracePeriod");

		this.positions = await this.getPositions();

		const updatedPositions: AlpacaPosition[] = await this.checkPositions(this.positions);

		if (updatedPositions.length < this.maxPositions) {
			const missing = this.maxPositions - updatedPositions.length;
			const existing = updatedPositions.map(pos => pos.symbol);

			const analysis = await runAnalysis([], existing, missing);
			const totalRating = analysis.reduce((acc: number, pos: any) => (acc + pos?.rating?.avg || 0), 0);
			const buyingPowerSplit = this.account?.buying_power / totalRating;

			if (totalRating === 0) {
				throw "There was an issue with rating averages";
			}

			const parsed = analysis.map((pos: any) => ({
				...pos,
				confidence: pos.rating.avg / 5,
				gracePeriod: moment().add(
					Math.floor((pos.rating.avg / 5) * maxGracePeriod),
					"days"
				).toISOString(),
				purchaseAmount: buyingPowerSplit * (pos?.rating?.avg || 0)
			}));
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
			unrealisedProfitLoss: pos.unrealized_pl, // profit/loss made on position,
			active: true,
			cacheKey: `positionData_${pos.symbol}`,
		}));
	}

	async checkPositions(positions: AlpacaPosition[]): Promise<AlpacaPosition[]> {
		const orders = await this._alpaca.getOrders();

		const buyOrders = orders
			.filter((order: any) => order.side === "buy")
			.reduce((acc: AlpacaPosition[], order: any) => ([
			...acc,
			{
				id: order.asset_id || order.id,
				symbol: order.symbol,
				costBasis: null,
				marketValue: null,
				unrealisedProfitLoss: null,
				active: false,
				cacheKey: `positionData_${order.symbol}`,
			}
		]), [] as AlpacaPosition[]);

		return await positions.reduce(async (pr, pos: AlpacaPosition) => {
			const acc = await pr;
			const matchingOrder = orders.find((order: any) => order.symbol === pos.symbol);

			if (matchingOrder && matchingOrder.side === "sell") {
				return acc;
			}

			const result = this.checkPosition(pos);

			if (!!result) {
				acc.push(pos);
			}

			return acc;
		}, Promise.resolve(buyOrders as AlpacaPosition[]));
	}

	async checkPosition(position: AlpacaPosition): Promise<AlpacaPosition | null> {
		const positionData: PositionData = cache.get(position.cacheKey);

		const clear = async () => {
			await this.closePosition(position);
			return null;
		}

		if (!positionData) {
			this.updatePositionData(position);
		}

		if (position.marketValue <= positionData.stop) {
			if (
				position.marketValue <= positionData.hardStop ||
				moment().isAfter(positionData.gracePeriod)
			) {
				return await clear();
			}
		}

		await this.updatePositionData(position);

		return position;
	}

	async closePosition(position: AlpacaPosition): Promise<void> {
		try {
			await this._alpaca.closePosition(position.symbol);
		} catch(e) {
			log("Error while closing position", e);
		}
	}

	async updatePositionData(position: AlpacaPosition): Promise<void> {
		const positionData: PositionData = cache.get(position.cacheKey) || {};
		const confidence = positionData?.confidence || 0.5;
		const maxGracePeriod: number = config.get("maxGracePeriod");
		const gracePeriod = positionData?.gracePeriod || moment().add(Math.floor(confidence * maxGracePeriod), "days").toISOString();

		const stopAllowance = .2;
		const hardStopAllowance = .5;

		const modStopAllowance = (1 - stopAllowance) * confidence;
		const modHardStopAllowance = (1 - hardStopAllowance) * confidence;

		const profitLoss = position.marketValue - position.costBasis;

		const newPositionData = {
			...positionData,
			stop: profitLoss * modStopAllowance,
			hardStop: profitLoss * modHardStopAllowance,
			gracePeriod,
			confidence,
		}

		cache.set(position.cacheKey, newPositionData);
	}

	async openPosition(data: any): Promise<void> {
		const { symbol, purchaseAmount } = data;

		await this._alpaca.createOrder({
			symbol,
			notional: purchaseAmount,
			side: "buy",
			type: "market",
			time_in_force: "day",
		});
	}

	dispatch(data: object) {
		for (var i = 0; i < this._subscribers.length; i++)
		this._subscribers[i](data);
	}

	subscribe(callback: (data: any) => {}) {
		this._subscribers.push(callback);
	}
}
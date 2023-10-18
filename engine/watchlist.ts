import debugFunc from "debug";
import Alpaca from "@alpacahq/alpaca-trade-api";
const log = debugFunc("bot:engine:watchlist");

export default class Watchlist {
	_alpaca: Alpaca;
	watchlist: any = null;

	constructor(alpaca: Alpaca) {
		this._alpaca = alpaca;
	}

	async assertWatchlist() {
		try {
			log("Retrieving watchlists");
			const watchlists = await this._alpaca.getWatchlists();
			let watchlist;

			watchlists.forEach((w: any) => {
				if (w.name === "slaterbot") {
					watchlist = w;
				}
			});

			if (!watchlist) {
				log("Watchlist not found, adding new one");
				const response = await this._alpaca.addWatchlist("slaterbot");
				watchlist = response;
			}

			log("Retrieve Slaterbot watchlist");
			this.watchlist = await this._alpaca.getWatchlist(watchlist.id);
		} catch(e) {
			console.error(e);

			return;
		}
	}

	async addToWatchlist(symbol: string) {
		log (`Adding ${symbol} to watchlist`);
		const existing = this.watchlist.assets.find(a => a.symbol === symbol);

		if (!existing) {
			await this._alpaca.addToWatchlist(this.watchlist.id, symbol);
			await this.assertWatchlist();
		}
	}
}
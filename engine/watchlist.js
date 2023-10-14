
class Watchlist {
    _alpaca = null;
    watchlist = null;

    constructor(alpaca) {
        this._alpaca = alpaca;
    }

    async assertWatchlist() {
        try {
            const watchlists = await this._alpaca.getWatchlists();
            let watchlist;
            
            watchlists.forEach(w => {
                if (w.name === "slaterbot") {
                    watchlist = w;
                }
            });
            
            if (!watchlist) {
                const response = await this._alpaca.addWatchlist("slaterbot", []);
                watchlist = response;
            }
    
            this.watchlist = await this._alpaca.getWatchlist(watchlist.id);
        } catch(e) {
            console.error(e);
            
            return;
        }
    }
    
    async addToWatchlist(symbol) {
        const existing = this.watchlist.assets.find(a => a.symbol === symbol);
    
        if (!existing) {
            await this._alpaca.addToWatchlist(this.watchlist.id, symbol);
            await this.assertWatchlist();
        }
    }
}

export default Watchlist;
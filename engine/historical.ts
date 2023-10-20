import googleFinance from "google-finance";
import yahooFinance from "yahoo-finance";
import moment from "moment";
import debugFunc from "debug";

const log = debugFunc("bot:engine:google");


export const getLong = async (symbols: string[]): Promise<any> => {
    return new Promise((resolve, reject) => {
        const parsed = symbols.map(s => `NASDAQ:${s}`);
        console.log(parsed);
        const to = moment().format("YYYY-MM-DD");
        const from = moment().subtract(7, "days").format("YYYY-MM-DD");

        const yahooResults = yahooFinance.historical({
            symbols,
            from,
            to
        });
    });
}
/**
 * This is the main Node.js server script for your project
 * Check out the two endpoints this back-end API provides in fastify.get and fastify.post below
 */
require("dotenv");
const Alpaca = require('@alpacahq/alpaca-trade-api');

const positions = ["TSLA"];

const alpaca = new Alpaca({
  keyId: process.env.ALPACA_KEY,
  secretKey: process.env.ALPACA_SECRET,
  paper: true,
});

const socket = alpaca.data_stream_v2;

socket.onConnect(function () {
  console.log("Connected");
  socket.subscribeForQuotes(["AAPL"]);
  socket.subscribeForTrades(["FB"]);
  socket.subscribeForBars(["SPY"]);
  socket.subscribeForStatuses(["*"]);
});

socket.onError((err) => {
  console.log(err);
});

socket.onStockTrade((trade) => {
  console.log(trade);
});

socket.onStockQuote((quote) => {
  console.log(quote);
});

socket.onStockBar((bar) => {
  console.log(bar);
});

socket.onStatuses((s) => {
  console.log(s);
});

socket.onStateChange((state) => {
  console.log(state);
});

socket.onDisconnect(() => {
  console.log("Disconnected");
});

socket.connect();
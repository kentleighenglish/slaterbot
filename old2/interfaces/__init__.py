"""
This is the handler for interacting with various interfaces.

This script initialises and exposes the interface libraries
It should be used as a simple access point to the interfaces
"""
import os
import logging
from .alpaca import buy as alpaca_buy, sell as alpaca_sell

supportedInterfaces = ["alpaca"]


def generateInterface(key):
    buy = globals()[key + "_buy"]
    sell = globals()[key + "_sell"]
    return {
        "buy": buy,
        "sell": sell
    }


interfaces = dict(
    map(lambda x: (x, generateInterface(x)), supportedInterfaces)
)

currInterface = os.environ.get("BOT_INTERFACE")
interface = ...

if (currInterface):
    logging.info(
        "Loading configuration for \"%s\" interface",
        currInterface
    )
    if currInterface not in interfaces:
        logging.error("\"%s\" interface not found", currInterface)
        os.kill()
    else:
        interface = interfaces[currInterface]
else:
    logging.error(
        "Please set the \"BOT_INTERFACE\" environment variable"
    )
    os.kill()


def buy(symbol, qty=1, type="market", timeInForce="fok"):
    """Trigger a buy call through the current interface."""
    return interface["buy"](
        symbol=symbol,
        qty=qty,
        type=type,
        timeInForce=timeInForce
    )


def sell(symbol, qty=1, type="market", timeInForce="gtc"):
    """Trigger a sell call through the current interface."""
    return interface["sell"](
        symbol=symbol,
        qty=qty,
        type=type,
        timeInForce=timeInForce
    )

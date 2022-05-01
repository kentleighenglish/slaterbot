"""
This is the handler for interacting with various interfaces.

This script initialises and exposes the interface libraries
It should be used as a simple access point to the interfaces
"""
import os
import logging
from .alpaca import Alpaca as alpaca

interfaces = {
    "alpaca": alpaca
}

currInterface = os.environ.get("BOT_INTERFACE")


class Handler():
    """
    Simple handler class for interfaces.

    Should pass most things on to the interface libraries
    """

    def __init__(self):
        if (currInterface):
            logging.info(
                "Loading configuration for \"%s\" interface",
                currInterface
            )
            if currInterface not in interfaces:
                logging.error("\"%s\" interface not found", currInterface)
                return

            self.interface = interfaces[currInterface]
        else:
            logging.error(
                "Please set the \"BOT_INTERFACE\" environment variable"
            )

    def buy(self, symbol, qty=1, type="market", timeInForce="fok"):
        """Trigger a buy call through the current interface."""
        return self.interface.buy(symbol, qty, type, timeInForce)

    def sell(self, symbol, qty=1, type="market", timeInForce="gtc"):
        """Trigger a sell call through the current interface."""
        return self.interface.sell(symbol, qty, type, timeInForce)

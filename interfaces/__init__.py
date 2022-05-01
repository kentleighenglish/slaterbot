"""
This is the handler for interacting with various interfaces.

This script initialises and exposes the interface libraries
It should be used as a simple access point to the interfaces
"""

import logging
# from .alpaca import Alpaca as alpaca


class Handler():
    """
    Simple handler class for interfaces.

    Should pass most things on to the interface libraries
    """

    def buy():
        """Trigger a buy call through the current interface."""
        logging.debug("buy something")

    def sell():
        """Trigger a sell call through the current interface."""
        logging.debug("sell something")

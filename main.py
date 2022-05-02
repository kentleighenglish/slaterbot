"""
The entry file for slaterbot.

This is the file to execute when running
"""
import os
import logging
import logging.config

import interfaces

logging.config.fileConfig('logging.conf')

symbol = os.environ.get("SYMBOL")


def run():
    """Start slaterbot."""
    logging.info("Starting bot")
    interfaces.buy(symbol=symbol)


run()

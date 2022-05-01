"""
The entry file for slaterbot.

This is the file to execute when running
"""
import logging
import logging.config

import interfaces

logging.config.fileConfig('logging.conf')

interface = interfaces.Handler()


def run():
    """Start slaterbot."""
    logging.info("Starting bot")


run()

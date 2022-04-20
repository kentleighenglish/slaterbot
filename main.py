import logging;
import logging.config

import request;
import interfaces;

logging.config.fileConfig('logging.conf');

interface = interfaces.Handler();

def run():
	logging.info("Starting bot");

	
run();

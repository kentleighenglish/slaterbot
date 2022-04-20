import logging;
import requests;

logger = logging.getLogger("request");

class Request():

	def get(url, data, headers):
		logger.info("GET request to " + url);
		return self.rawRequest(method="get", url=url, data=data, headers=headers);
	def post(url, data, headers):
		logger.info("POST Request to " + url);
		return self.rawRequest(method="post", url=url, data=data, headers=headers);
	def _rawRequest(method, url, data, headers):
		requestData = {};
		requestHeaders = {};
		
		if (data):
			requestData = data;
		if (headers):
			requestHeaders = headers;
	
		r = requests[method](url, data=requestData, headers=requestHeaders);
	
		return r.json();

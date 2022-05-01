"""
This script holds the class for generating various HTTP requests.


"""
import logging
import requests

logger = logging.getLogger("request")


class Request():
    """
    This is a generic Request class for handling HTTP requests.

    Contained methods can be used to make GET and POST requests
    """

    def get(self, url, data, headers):
        """Run a generic GET request with given data and headers."""
        logger.info("GET request to " + url)
        return self.rawRequest(
            method="get",
            url=url,
            data=data,
            headers=headers
        )

    def post(self, url, data, headers):
        """Run a generic POST request with given data and headers."""
        logger.info("POST Request to " + url)
        return self.rawRequest(
            method="post",
            url=url,
            data=data,
            headers=headers
        )

    def _rawRequest(method, url, data, headers):
        """Run a generic request with given data and headers."""
        requestData = {}
        requestHeaders = {}

        if (data):
            requestData = data
        if (headers):
            requestHeaders = headers

        r = requests[method](url, data=requestData, headers=requestHeaders)

        return r.json()

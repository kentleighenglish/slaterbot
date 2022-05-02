"""
This script holds the class for generating various HTTP requests.

Use it to make HTTP request calls easier
"""
import logging
import requests

logger = logging.getLogger("request")


def get(url, data, headers):
    """Run a generic GET request with given data and headers."""
    logger.info("GET request to " + url)
    return _rawRequest(
        method="get",
        url=url,
        data=data,
        headers=headers
    )


def post(self, url, data, headers):
    """Run a generic POST request with given data and headers."""
    logger.info("POST Request to " + url)
    return _rawRequest(
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

    methodFunc = getattr(requests, method)

    r = methodFunc(url, data=requestData, headers=requestHeaders)

    return r.json()

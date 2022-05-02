"""
This is an example script.

It seems that it has to have THIS docstring with a summary line, a blank line
and sume more text like here. Wow.
"""
import os
import request
import logging
import base64

host = os.environ.get("ALPACA_URL")
id = os.environ.get("ALPACA_ACCOUNTID")
key = os.environ.get("ALPACA_KEY")
secret = os.environ.get("ALPACA_SECRET")

__all__ = ["buy", "sell"]


def buy(symbol, qty, type, timeInForce):
    """Trigger a buy request on the Alpaca API."""
    payload = {
        "symbol": symbol,
        "side": "buy",
        "qty": qty,
        "type": type,
        "time_in_force": timeInForce
    }

    response = _request(
        "get",
        "/v1/trading/accounts/{account_id}/orders",
        payload
    )

    print(response)


def sell(symbol, qty, type, timeInForce):
    """Trigger a sell request on the Alpaca API."""
    payload = {
        "symbol": symbol,
        "side": "sell",
        "qty": qty,
        "type": type,
        "time_in_force": timeInForce
    }

    response = _request(
        "get",
        "/v1/trading/accounts/{account_id}/orders",
        payload
    )

    print(response)


def _request(method, path, data={}):
    """Handle generic requests for the Alpaca API."""
    authInput = bytearray(key + ":" + secret, "utf-8")
    headers = {
        "Authorization": base64.standard_b64encode(authInput)
    }
    methodFunc = getattr(request, method)

    if (methodFunc):
        response = methodFunc(host + path, data, headers)
    else:
        logging.error("Could not find %s method for request", method)
        return

    return response

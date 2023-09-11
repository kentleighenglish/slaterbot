"""
This is an example script.

It seems that it has to have THIS docstring with a summary line, a blank line
and sume more text like here. Wow.
"""
import os
import request
import logging
import base64
# from requests.auth import HTTPBasicAuth

host = os.environ.get("ALPACA_URL")
account_id = os.environ.get("ALPACA_ACCOUNTID")
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
        "post",
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
        "post",
        "/v1/trading/accounts/{account_id}/orders",
        payload
    )

    print(response)


def _request(method, path, data={}):
    """Handle generic requests for the Alpaca API."""
    parsedPath = path.format(account_id=account_id)

    headers = {
        "APCA-API-KEY-ID": key,
        "APCA-API-SECRET-KEY": secret
    }

    methodFunc = getattr(request, method)

    if (methodFunc):
        response = methodFunc(url=host + parsedPath, data=data, headers=headers)
    else:
        logging.error("Could not find %s method for request", method)
        return

    return response

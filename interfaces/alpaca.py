"""
This is an example script.

It seems that it has to have THIS docstring with a summary line, a blank line
and sume more text like here. Wow.
"""
import os
import request
import base64

host = os.environ.get("ALPACA_HOST")
id = os.environ.get("ALPACA_ACCOUNTID")
key = os.environ.get("ALPACA_KEY")
secret = os.environ.get("ALPACA_SECRET")


class Alpaca():
    """Interface for interacting with Alpaca API."""

    def buy(self, symbol, qty, type, timeInForce):
        """Trigger a buy request on the Alpaca API."""
        payload = {
            symbol: symbol,
            "side": "buy",
            qty: qty,
            type: type,
            "time_in_force": timeInForce
        }

        response = self._request(
            "get",
            "/v1/trading/accounts/{account_id}/orders",
            payload
        )

        print(response)

    def sell(self, symbol, qty, type, timeInForce):
        """Trigger a sell request on the Alpaca API."""
        payload = {
            symbol: symbol,
            "side": "sell",
            qty: qty,
            type: type,
            "time_in_force": timeInForce
        }

        response = self._request(
            "get",
            "/v1/trading/accounts/{account_id}/orders",
            payload
        )

        print(response)

    def _request(method, path, data={}):
        """Handle generic requests for the Alpaca API."""
        headers = {
            "Authorization": base64.b64encode(key + ":" + secret)
        }

        response = request[method](host + path, data, headers)

        return response

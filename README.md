[![Build Status](https://travis-ci.org/zensend/zensend_nodejs_api.svg?branch=master)](https://travis-ci.org/zensend/zensend_nodejs_api)

# ZenSend NodeJS API

## Manual Testing

```node
var zensend = require('./lib/zensend.js');
var client = new zensend.Client("api_key");
```

## Examples
Create an instance of the client
```node
var client = new zensend.Client("api_key");
```
You can also specify timeout options and the Zensend URL. Default timeouts are 60 seconds.
```ruby
client = new zensend.Client("YOUR API KEY", {timeout: 60, url: "http://localhost:8084"});
```

### Sending SMS
To send an SMS, you must specify the originator, body and numbers, and a callback function.
The callback will return an error (which may be null) and a response object.
```node
var callback = function(error, response) {
    if (error != null) {
        console.log(
            error.statuscode, // HTTP status code
            error.failcode, // ZenSend's fail code
            error.paramter // The paramter that caused a failure (if any)
        );
    } else {
        console.log(
            response.txguid, // unique transaction guid
            response.sms_parts, // amount of parts the messages was split into
            response.encoding, // encoding used
            response.numbers, // amount of numbers messages will be sent to
            response.cost_in_pence, // cost of sending this sms
            response.new_balance_in_pence // your new balance
    }
};

var params = {originator: "ORIGINATOR", body: "BODY", numbers: ["447878787877"]};

client.sendSms(params, callback);
```
You can also specify the following optional params:

```node
var params = {
    originator: "ORIGINATOR",
    body: "BODY",
    numbers: ["447878787877"],
    originator_type: "ALPHA", # ALPHA or MSISDN,
    timetolive_in_minutes: 120,
    encoding: "GSM" # GSM or UCS2
};

client.sendSms(params, callback);
```

### Checking your balance
This will return your current balance:
```node
client.checkBalance(function(error, balance) {
    if (error == null) {
        console.log(balance);
    }
});
```

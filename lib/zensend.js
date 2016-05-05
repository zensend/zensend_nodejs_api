var request = require('request');
var querystring = require('querystring');

Client.DEFAULT_BASE_URL = 'https://api.zensend.io';
Client.DEFAULT_TIMEOUT = 60000;
Client.REQUIRED_SEND_SMS_PARAMS = ["originator", "body", "numbers"];
Client.VALID_SEND_SMS_PARAMS = ["originator_type", "timetolive_in_minutes", "encoding"].concat(Client.REQUIRED_SEND_SMS_PARAMS)
Client.VALID_KEYWORD_PARAMS = ["shortcode", "keyword", "is_sticky", "mo_url"];

function ArgumentError(message) {
  this.constructor.prototype.__proto__ = Error.prototype
  Error.call(this);
  Error.captureStackTrace(this, this.constructor);
  this.name = "ArgumentError";
  this.message = message;

}

function ZenSendError(statusCode, json) {
  this.constructor.prototype.__proto__ = Error.prototype
  Error.call(this);
  Error.captureStackTrace(this, this.constructor);
  this.name = "ZenSendError";
  this.statuscode   = statusCode;

  if (json == null) {
    this.failcode = null;
    this.parameter = null;
    this.cost_in_pence = null;
    this.new_balance_in_pence = null;
  } else {
    this.failcode = json["failcode"];
    this.parameter = json["parameter"];
    this.cost_in_pence = json["cost_in_pence"];
    this.new_balance_in_pence = json["new_balance_in_pence"];
  }

  this.message = "Status Code: " + this.statuscode + " failCode: " + this.failcode + " parameter: " + this.parameter;
}


function Client(key, opts) {

  opts          = opts || {};
  this._baseUrl = opts["url"] || Client.DEFAULT_BASE_URL;
  this._timeout = opts["timeout"] || Client.DEFAULT_TIMEOUT;

  if (key) {
    this._apiKey = key;
  } else {
    throw new ArgumentError('API Key must be present');
  }
}

Client.prototype = {

  /****************************************************************************
  * checkBalance
  *
  * API to retreive the user balance from zensend
  *
  * This will return either a ZenSendError or the balance
  ****************************************************************************/

  lookupOperator : function(msisdn, callback) {
    var qs = querystring.stringify({"NUMBER": msisdn});

    this._makeRequest(this._baseUrl + "/v3/operator_lookup?" + qs, "GET", null, function(error, response) {
      if (error == null) {
        callback(null, response);
      } else {
        return callback(error, response);
      }
    });    
  },

  checkBalance: function(callback) {
    this._makeRequest(this._baseUrl + "/v3/checkbalance", "GET", null, function(error, response) {
      if (error == null) {
        callback(null, response.balance);
      } else {
        return callback(error, response);
      }
    });
  },

  getPrices: function(callback) {
    this._makeRequest(this._baseUrl + "/v3/prices", "GET", null, function(error, response) {
      if (error == null) {
        callback(null, response.prices_in_pence);
      } else {
        return callback(error, response);
      }
    });
  },

  /****************************************************************************
  * sendSms
  *
  * Sends an sms message
  * 
  * Named paramters:
  *  originator: the originator to send from
  *  body: the body of the sms message
  *  numbers: an array of numbers to send to. they must not contain the ',' character
  *  originator_type: :alpha or :msisdn (not required)
  *  timetolive_in_minutes: number of minutes before message expires (not required)
  *  encoding: :ucs2 or :gsm (not required defaults to automatic)
  *
  * This will either raise an ArgumentError, or return a ZenSendError or the
  * response object.
  *
  * An ArgumentError can be raised if any of the numbers includes a ',' character or
  * a required parameter is not specified or an unknown parameter is specified.
  *
  * A ZenSendError will be returned any time a non-successful response is
  * returned from ZenSend.
  *
  * The response object will contain the following fields:
  *   tx_guid: (the transaction guid returned from ZenSend)
  *   sms_parts: (the amount of SMS parts required to send the full message)
  *   numbers: (the numbers the message will be sent to)
  *   encoding: (the encoding used)
  ****************************************************************************/

  sendSms: function(opts, callback) {
    opts = opts || {};

    var params = this._validateAndBuildSendSmsParams(opts);

    this._makeRequest(this._baseUrl + "/v3/sendsms", "POST", params, function(error, response) {

      if (error == null) {
        var parsed_response = {tx_guid: response.txguid, sms_parts: response.smsparts, numbers: response.numbers, encoding: response.encoding, cost_in_pence: response.cost_in_pence, new_balance_in_pence: response.new_balance_in_pence};
        callback(null, parsed_response);
      } else {
        callback(error, null);
      }
    });
  },

  createKeyword: function(opts, callback) {

    opts = opts || {};

    var params = this._validateAndBuildCreateKeywordParams(opts);
    console.log("params", params);
    this._makeRequest(this._baseUrl + "/v3/keywords", "POST", params, callback);
  },

  _validateAndBuildCreateKeywordParams: function(opts) {
    var params = {};
    Object.keys(opts).forEach(function(paramKey) {
      if (Client.VALID_KEYWORD_PARAMS.indexOf(paramKey) == -1) {
        throw new ArgumentError("unexpected parameter: " + paramKey)
      }
    });

    if (opts["shortcode"] != null) {
      params["SHORTCODE"] = opts["shortcode"];
    }

    if (opts["keyword"] != null) {
      params["KEYWORD"] = opts["keyword"];
    }

    if (opts["mo_url"] != null) {
      params["MO_URL"] = opts["mo_url"];
    }

    if (opts["is_sticky"] != null) {
      params["IS_STICKY"] = opts["is_sticky"].toString();
    }

    return params;

  },

  _validateAndBuildSendSmsParams: function(opts) {
    var params = {};
    var _this = this;

    Object.keys(opts).forEach(function(paramKey) {
      if (!_this._isValidSendSmsParam(paramKey)) {
        throw new ArgumentError("unexpected parameter: " + paramKey)
      }
    })

    this._validateRequiredSendSmsParams(opts);

    params["NUMBERS"] = this._validateSendSmsNumbers(opts["numbers"]).join(",");
    params["BODY"] = opts["body"];
    params["ORIGINATOR"] = opts["originator"];

    if (opts["encoding"] != null) {
      params["ENCODING"] = opts["encoding"];
    }

    if (opts["originator_type"] != null) {
      params["ORIGINATOR_TYPE"] = opts["originator_type"];
    }

    if (opts["timetolive_in_minutes"] != null) {
      params["TIMETOLIVE"] = opts["timetolive_in_minutes"];
    }

    return params;
  },

  _isValidSendSmsParam: function(paramKey) {
    return Client.VALID_SEND_SMS_PARAMS.indexOf(paramKey) !== -1;
  },

  _validateRequiredSendSmsParams: function(params) {
    Client.REQUIRED_SEND_SMS_PARAMS.forEach(function(paramKey) {
      if (!params[paramKey]) throw new ArgumentError("missing required param: " + paramKey);
    })
  },

  _validateSendSmsNumbers: function(numbers) {
    if (numbers instanceof Array) {
      numbers.forEach(function(number) {
        if(number.indexOf(',') !== -1) {
          throw new ArgumentError("invalid character in number: " + number);
        }
      })
    } else {
      throw new ArgumentError("numbers must be an array");
    }

    return numbers;
  },

  /****************************************************************************
  * makeRequest
  *
  * handles the communication to zensend and returns the error and/or
  * response accordingly 
  ****************************************************************************/

  _makeRequest: function(url, method, params, callback) {

    var requestParams = {
      method: method,
      url: url,
      timeout: this._timeout,
      headers: {"X-API-KEY": this._apiKey}
    };

    if (params) requestParams["body"] = querystring.stringify(params);

    var requestCallback = function(error, response, body) {
      
      if (error != null) {
        callback(error);
        return;
      }

      var content_type = response.headers["content-type"];
      if (content_type != null && content_type.indexOf("application/json") >= 0) {
        var json_response;

        try {
          json_response = JSON.parse(response.body);
        } catch (e) {
          callback(e, null);
        }

        if (json_response["success"]) {
          callback(null, json_response["success"]);
        } else if (json_response["failure"]) {
          var failure = json_response["failure"]
          callback(new ZenSendError(response.statusCode, failure));
        } else {
          callback(new ZenSendError(response.statusCode));
        }
      } else {
        callback(new ZenSendError(response.statusCode));
      }
    };

    request(requestParams, requestCallback);
  }

};

module.exports = {Client: Client, ZenSendError: ZenSendError, ArgumentError: ArgumentError};

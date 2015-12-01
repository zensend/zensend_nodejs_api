var should       = require('chai').should,
    assert       = require('chai').assert,
    expect       = require('chai').expect,
    zensend    = require('../lib/zensend'),
    nock         = require('nock'),
    sendSms      = zensend.sendSms,
    checkBalance = zensend.checkBalance;

describe("#initialisation", function() {
  it("expects an API key to be provided", function() {
    assert.throw(function() { new zensend.Client() }, Error);
  });
});

describe('#sendSms', function() {
  var validParms = function() {
    return {originator: "ORIGINATOR", body: "BODY", numbers: ["447878787877"]}
  };

  var sendSmsFun = function(params, callback) {
    return function() {
      (new zensend.Client("api_key")).sendSms(params, callback);
    }
  };

  var paramsExcept = function(excludedParam) {
    return paramsOverride(excludedParam, null);
  };

  var paramsOverride = function(overrideParam, value) {
    var params = validParms();
    params[overrideParam] = value;
    return params;
  };

  var stubSendSmsResponse = function(code, response) {
    nock('https://api.zensend.io')
      .post('/v3/sendsms')
      .reply(code, response);
  };

  it('requires the originator', function() {
    assert.throw(sendSmsFun(paramsExcept("originator")), Error, "missing required param: originator");
  });

  it('requires the body', function() {
    assert.throw(sendSmsFun(paramsExcept("body")), Error, "missing required param: body");
  });

  it('requires the numbers', function() {
    assert.throw(sendSmsFun(paramsExcept("numbers")), Error, "missing required param: numbers");
  });

  it('requires the numbers be an array', function() {
    assert.throw(sendSmsFun(paramsOverride("numbers", "447676767676,448787878787")), Error, "numbers must be an array");
  });

  it('throws an error for unexpected params', function() {
    assert.throw(sendSmsFun(paramsOverride("invalid", "invalid")), Error, "unexpected parameter: invalid");
  });

  it('sends the sms and returns the response object', function(done) {
    var stubbedResponse = {txguid: "txguid", smsparts: 1, encoding: "ucs2", numbers: 1, cost_in_pence: 12.34, new_balance_in_pence: 10.2};

    stubSendSmsResponse(200, { success: stubbedResponse });

    sendSmsFun(validParms(), function(error, response) {
      assert.deepEqual(response, {tx_guid: "txguid", sms_parts: 1, encoding: "ucs2", numbers: 1, cost_in_pence: 12.34, new_balance_in_pence: 10.2});
      done();
    })()
  });

  it('returns an error object for known failures', function(done) {
    stubSendSmsResponse(400, { failure: {failcode: "MISSING", parameter: "NUMBERS"} });

    sendSmsFun(validParms(), function(error, response) {
      assert.equal(error.statuscode, 400);
      assert.equal(error.failcode, "MISSING");
      assert.equal(error.parameter, "NUMBERS");
      done();
    })()
  });

  it('returns an error object for unknown failures', function(done) {
    stubSendSmsResponse(500);

    sendSmsFun(validParms(), function(error, response) {
      assert.equal(error.statuscode, 500);
      assert.equal(error.failCode, undefined);
      assert.equal(error.parameter, undefined);

      done();
    })()
  });

  it('handles invalid json', function(done) {
    nock('https://api.zensend.io')
      .post('/v3/sendsms')
      .reply(200, "hello hello", {"content-type":"application/json"});

    sendSmsFun(validParms(), function(error, response) {
      assert.instanceOf(error, SyntaxError);
      done();
    })()
  });

});

describe('#getPrices', function() {

  it("returns a hash of prices", function(done) {

    nock('https://api.zensend.io')
      .get('/v3/prices')
      .reply(200, {success: {prices_in_pence: {"GB":1.23, "US":1.24}}});

    (new zensend.Client("api_key")).getPrices(function(error, response) {
      assert.equal(error, null);
      assert.deepEqual(response, {"GB":1.23, "US":1.24});
      done();
    });
  });
});

describe('#lookupOperator', function() {

  it("looks up the operator", function(done) {

    nock('https://api.zensend.io')
      .get("/v3/operator_lookup?NUMBER=441234567890")
      .reply(200, {success: {mnc: '123', mcc: '457', operator: 'o2-uk', cost_in_pence: 2.5, new_balance_in_pence: 100.0}});

    new zensend.Client("api_key").lookupOperator("441234567890", function(error, response){
      assert.equal(response.mnc, '123');
      assert.equal(response.mcc, '457');
      assert.equal(response.operator, 'o2-uk');
      assert.equal(response.cost_in_pence, 2.5);
      assert.equal(response.new_balance_in_pence, 100.0);
      done();
    });
  });


  it("handles an error when there is a charge", function(done) {

    nock('https://api.zensend.io')
      .get("/v3/operator_lookup?NUMBER=441234567890")
      .reply(503, {failure: {failcode: 'DATA_MISSING', cost_in_pence: 2.5, new_balance_in_pence: 100.0}});

    new zensend.Client("api_key").lookupOperator("441234567890", function(error, response){
      assert.equal(error.statuscode, 503);
      assert.equal(error.failcode, "DATA_MISSING");
      assert.equal(error.cost_in_pence, 2.5);
      assert.equal(error.new_balance_in_pence, 100.0);
      done();
    });
  });

  it("handles an error when there is no charge", function(done) {

    nock('https://api.zensend.io')
      .get("/v3/operator_lookup?NUMBER=441234567890")
      .reply(503, {failure: {failcode: 'NOT_AUTHORIZED'}});

    new zensend.Client("api_key").lookupOperator("441234567890", function(error, response){
      assert.equal(error.statuscode, 503);
      assert.equal(error.failcode, "NOT_AUTHORIZED");
      assert.equal(error.cost_in_pence, null);
      assert.equal(error.new_balance_in_pence, null);
      done();
    });
  });

});

describe('#checkBalance', function() {
  var checkBalanceFun = function(callback) {
    return function() {
      (new zensend.Client("api_key")).checkBalance(callback);
    }
  };

  var stubCheckBalanceResponse = function(code, response) {
    nock('https://api.zensend.io')
      .get('/v3/checkbalance')
      .reply(code, response);
  };

  it("handles errors", function(done) {

    nock('https://api.zensend.io')
      .get("/v3/checkbalance")
      .replyWithError('something awful happened');

    checkBalanceFun(function(error, response) {
      assert.equal(response, null);
      assert.equal(error.message, 'something awful happened');
      done();
    })()    
  });

  it('checks the balance and returns the response object', function(done) {
    var stubbedResponse = {balance: 100.2};

    stubCheckBalanceResponse(200, { success: stubbedResponse });

    checkBalanceFun(function(error, response) {
      assert.equal(response, 100.2);
      done();
    })()
  });

  it('returns an error object for known failures', function(done) {
    stubCheckBalanceResponse(400, { failure: {failcode: "MISSING", parameter: "SOMETHING"} });

    checkBalanceFun(function(error, response) {
      assert.equal(error.statuscode, 400);
      assert.equal(error.failcode, "MISSING");
      assert.equal(error.parameter, "SOMETHING");
      done();
    })()
  });

  it('returns an error object for unknown failures', function(done) {
    stubCheckBalanceResponse(500);

    checkBalanceFun(function(error, response) {
      assert.equal(error.statuscode, 500);
      assert.equal(error.failcode, undefined);
      assert.equal(error.parameter, undefined);
      done();
    })()
  });
});

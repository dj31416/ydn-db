// core service test
goog.require('goog.debug.Console');
goog.require('goog.testing.jsunit');
goog.require('ydn.async');
goog.require('ydn.debug');
goog.require('ydn.db');
goog.require('ydn.db.core.Storage');


var reachedFinalContinuation;

var stubs;
var basic_schema = {
  stores: [
    {
      name: 't1',
      keyPath: 'id',
      type: 'TEXT'
    }, {
      name: 't2',
      keyPath: 'id',
      type: 'TEXT'
    }]
};


var setUp = function() {
  ydn.debug.log('ydn.db', 'finest');
  ydn.db.tr.StrictOverflowParallel.DEBUG = true;
  ydn.db.tr.Parallel.DEBUG = true;
// ydn.db.con.IndexedDb.DEBUG = true;

};


var tearDown = function() {
  assertTrue('The final continuation was not reached', reachedFinalContinuation);
};


var committed_continuous_request_test = function(thread, exp_tx_no) {

  var db_name = 'nested_request_test' + Math.random();
  options.thread = thread;
  var db = new ydn.db.core.Storage(db_name, basic_schema, options);

  var val = {id: 'a', value: Math.random()};

  var t1_fired = false;
  var result;
  var tx_no = [];

  waitForCondition(
    // Condition
    function() { return t1_fired; },
    // Continuation
    function() {
      assertNotNullNorUndefined('has result', result);
      assertEquals('correct obj', val.value, result.value);
      assertArrayEquals('tx no', exp_tx_no, tx_no);
      reachedFinalContinuation = true;
      ydn.db.deleteDatabase(db.getName(), db.getType());
      db.close();
    },
    100, // interval
    2000); // maxTimeout

  db.run(function (tdb) {
    tdb.put(table_name, val);
  }, [table_name], 'readwrite', function (t) {
    db.get(table_name, 'a').addBoth(function (r) {
      tx_no.push(db.getTxNo());
    });
    db.get(table_name, 'a').addBoth(function (x) {
      result = x;
      tx_no.push(db.getTxNo());
      t1_fired = true;
    });
  })


};


var test_abort_put  = function() {
  var db_name = 'test_abort' + Math.random();
  options.thread = 'samescope-multirequest-serial';
  var db = new ydn.db.core.Storage(db_name, basic_schema, options);

  var val = {id: 'a', value: Math.random()};

  var t1_fired, t2_fired;
  var t1_result, t2_result;

  waitForCondition(
    // Condition
    function() { return t1_fired && t2_fired; },
    // Continuation
    function() {
      assertUndefined('t1 result', t1_result);
      assertNotNullNorUndefined('has result', t2_result);
      assertEquals('correct value', val.value, t2_result.value);

      reachedFinalContinuation = true;
      ydn.db.deleteDatabase(db.getName(), db.getType());
      db.close();
    },
    100, // interval
    2000); // maxTimeout

  db.put('t1', val).addCallback(function (x) {
    db.abort();
  });
  db.get('t1', 'a').addBoth(function (x) {
    t1_result = x;
    t1_fired = true;
  });

  db.put('t2', val);
  db.get('t2', 'a').addBoth(function (x) {
    t2_result = x;
    t2_fired = true;
  });

};




var testCase = new goog.testing.ContinuationTestCase();
testCase.autoDiscoverTests();
G_testRunner.initialize(testCase);



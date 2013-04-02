// Copyright 2012 YDN Authors. All Rights Reserved.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS-IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.


/**
 * @fileoverview Data store in memory.
 */


goog.provide('ydn.db.con.SimpleStorage');
goog.require('goog.Timer');
goog.require('goog.asserts');
goog.require('goog.async.Deferred');
goog.require('ydn.db.Key');
goog.require('ydn.db.con.IDatabase');
goog.require('ydn.db.con.simple');
goog.require('ydn.db.req.InMemoryStorage');
goog.require('ydn.db.VersionError');
goog.require('ydn.db.con.simple.Store');


/**
 * @implements {ydn.db.con.IDatabase}
 * @param {!Storage=} opt_localStorage storage provider.
 * @constructor
 */
ydn.db.con.SimpleStorage = function(opt_localStorage) {

  /**
   * @final
   */
  this.storage_ = opt_localStorage ||
      /** @type {!Storage} */ (new ydn.db.req.InMemoryStorage());

};


/**
 * @protected
 * @type {goog.debug.Logger} logger.
 */
ydn.db.con.SimpleStorage.prototype.logger =
  goog.debug.Logger.getLogger('ydn.db.con.SimpleStorage');


/**
 * @const
 * @type {string}
 */
ydn.db.con.SimpleStorage.TYPE = 'memory';

/**
 * @type {!Storage}
 * @private
 */
ydn.db.con.SimpleStorage.prototype.storage_;


/**
 * @protected
 * @type {!ydn.db.schema.Database}
 */
ydn.db.con.SimpleStorage.prototype.schema;


/**
 * @protected
 * @type {string}
 */
ydn.db.con.SimpleStorage.prototype.dbname;


/**
 * @private
 * @type {number}
 */
ydn.db.con.SimpleStorage.prototype.version_;


/**
 *
 * @return {boolean} true if memory is supported.
 */
ydn.db.con.SimpleStorage.isSupported = function() {
  return true;
};


/**
 *
 * @type {boolean} debug flag. should always be false.
 */
ydn.db.con.SimpleStorage.DEBUG = false;



/**
 * @inheritDoc
 */
ydn.db.con.SimpleStorage.prototype.getVersion = function() {
  return this.version_;
};


/**
 * @inheritDoc
 */
ydn.db.con.SimpleStorage.prototype.connect = function(dbname, schema) {

  var df = new goog.async.Deferred();
  /**
   *
   * @param {*} x
   * @param {*=} e
   */
  var callDf = function (x, e) {
    goog.Timer.callOnce(function () {
      if (e) {
        df.errback(e);
      } else {
        df.callback(x);
      }
    });
  };

  /**
   * @final
   */
  this.dbname = dbname;

  /**
   * @final
   */
  this.schema = schema;

  /**
   * @final
   */
  this.simple_stores_ = {};

  var db_key = ydn.db.con.simple.makeKey(this.dbname);

  this.version_ = NaN;

  /**
   *
   * @type {DatabaseSchema}
   */
  var ex_schema_json = /** @type {DatabaseSchema} */
    (ydn.json.parse(this.storage_.getItem(db_key)));

  if (ex_schema_json) {
    var ex_schema = new ydn.db.schema.Database(ex_schema_json);

    var diff_msg = this.schema.difference(ex_schema);
    if (diff_msg) {
      if (!this.schema.isAutoVersion() ||
        (this.schema.getVersion() < ex_schema.getVersion())) {
        var msg = goog.DEBUG ? 'existing version ' + ex_schema.getVersion() +
          'is larger than ' + this.schema.getVersion() : '';
        callDf(null, new ydn.db.VersionError(msg));
      } else {
        // upgrade schema
        this.version = goog.isDef(this.schema.getVersion()) ?
          this.schema.getVersion() :
          (ex_schema.getVersion() + 1);
        for (var i = 0; i < this.schema.count(); i++) {
          var store = this.schema.store(i);
          this.simple_stores_[store.getName()] =
            new ydn.db.con.simple.Store(this.dbname, this.storage_, store);
        }
        if (this.schema instanceof ydn.db.schema.EditableDatabase) {
          for (var i = 0; i < ex_schema.count(); i++) {
            var store = ex_schema.store(i);
            goog.asserts.assert(!goog.isNull(store));
            this.schema.addStore(store);
            this.simple_stores_[store.getName()] =
              new ydn.db.con.simple.Store(this.dbname, this.storage_, store);
          }
        }
        var schema_json = this.schema.toJSON();
        schema_json.version = this.version;
        this.storage_.setItem(db_key, ydn.json.stringify(schema_json));
        callDf(ex_schema.getVersion());
      }
    } else {
      for (var i = 0; i < this.schema.count(); i++) {
        var store = this.schema.store(i);
        this.simple_stores_[store.getName()] =
          new ydn.db.con.simple.Store(this.dbname, this.storage_, store);
      }
      this.version = ex_schema.getVersion();
      callDf(this.version);
    }
  } else {
    var json = schema.toJSON();
    this.version_ = 1;
    var old_version = NaN;
    json.version = this.version_;
    this.storage_.setItem(db_key, ydn.json.stringify(json));
    callDf(old_version);
  }

  return df;
};


/**
 * @type {Object.<!ydn.db.con.simple.Store>}
 * @private
 */
ydn.db.con.SimpleStorage.prototype.simple_stores_;


/**
 * @inheritDoc
 */
ydn.db.con.SimpleStorage.prototype.isReady = function() {
  return !!this.dbname;
};



/**
 * @inheritDoc
 */
ydn.db.con.SimpleStorage.prototype.getDbInstance = function() {
  return this.storage_ || null;
};




/**
 * Column name of key, if keyPath is not specified.
 * @const {string}
 */
ydn.db.con.SimpleStorage.DEFAULT_KEY_PATH = '_id_';



/**
 * @inheritDoc
 */
ydn.db.con.SimpleStorage.prototype.getType = function() {
  return 'memory';
};


/**
 * @inheritDoc
 */
ydn.db.con.SimpleStorage.prototype.close = function() {

};


/**
 *
 * @return {!Storage}
 */
ydn.db.con.SimpleStorage.prototype.getStorage = function() {
  return this.storage_;
};


/**
 * @inheritDoc
 */
ydn.db.con.SimpleStorage.prototype.doTransaction = function(trFn, scopes, mode,
                                                            oncompleted) {
  trFn(this);
  oncompleted(ydn.db.base.TransactionEventTypes.COMPLETE, {});
};



/**
 * @inheritDoc
 */
ydn.db.con.SimpleStorage.prototype.getSchema = function (callback) {
  goog.Timer.callOnce(function () {
    var db_key = ydn.db.con.simple.makeKey(this.dbname);
    var db_value = this.storage_.getItem(db_key);
    var schema = new ydn.db.schema.Database(db_value);
    callback(schema);
  }, 0, this);
};


/**
 * @protected
 * @param store_name
 * @return {!ydn.db.con.simple.Store}
 */
ydn.db.con.SimpleStorage.prototype.getSimpleStore = function (store_name) {
  return this.simple_stores_[store_name];
};







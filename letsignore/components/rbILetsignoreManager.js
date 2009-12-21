/*
 * Manager XPCOM Component Implementation for LetsIgnore
 *
 * Copyright (c) 2009 Steven M. Lloyd
 * steve@repeatingbeats.com
 *
 *
 * This file is part of the LetsIgnore Firefox Extension.
 *
 * This file may be licensed under the terms of of the
 * GNU General Public License Version 2 (the ``GPL'').
 *
 * Software distributed under the License is distributed
 * on an ``AS IS'' basis, WITHOUT WARRANTY OF ANY KIND, either
 * express or implied. See the GPL for the specific language
 * governing rights and limitations.
 *
 * You should have received a copy of the GPL along with this
 * program. If not, go to http://www.gnu.org/licenses/gpl.html
 * or write to the Free Software Foundation, Inc.,
 * 51 Franklin Street, Fifth Floor, Boston, MA 02110-1301, USA.
 *
 */
 

if(typeof(Cc)=="undefined")
  var Cc = Components.classes;
if(typeof(Ci)=="undefined")
  var Ci = Components.interfaces;
if(typeof(Cu)=="undefined")
  var Cu = Components.utils;
if(typeof(Cr)=="undefined")
  var Cr = Components.results;

Cu.import("resource://gre/modules/XPCOMUtils.jsm");

const DESCRIPTION = "letsignore manager"
const CID         = "{94962e56-11fc-4b28-b574-b87a4c690e5b}"
const CONTRACTID  = "@repeatingbeats.com/letsignore/letsignore-manager;1";

function rbILetsignoreManager() {

};

rbILetsignoreManager.prototype.constructor = rbILetsignoreManager;

rbILetsignoreManager.prototype = {

  classDescription : DESCRIPTION,
  classID : Components.ID(CID),
  contractID : CONTRACTID,
  
  QueryInterface : XPCOMUtils.generateQI([Ci.rbILetsignoreManager]),
    
  _db : null,

  /*
   * This object holds configuration data for each kind of ignored item. Ignored
   * item types (such as 'threads' or 'users') will be referred to as a 'topic'
   * throughout this component. The configuration data indicates the database 
   * table name and structure as well as the cache key for each topic.
   */
  _CONFIG: {
      
      threads : {
                  table : "ignoredThreads",
                  key   : "threadID",
                  cols  : ["threadID", "threadTitle", "threadUser",
                           "threadIgnoreDate", "threadIgnoreCode"],
                  types : ["int", "varchar(32)", "varchar(255)",
                            "varchar(255)", "int"]
                },
    
      users  :  {
                  table : "ignoredUsers",
                  key   : "userUser",
                  cols  : ["userUser", "userIgnoreDate", "userIgnoreCode"],
                  types : ["varchar(32)", "varchar(255)", "int"]
                }
  },
  
  _JSON : Cc['@mozilla.org/dom/json;1']
            .createInstance(Ci.nsIJSON),

  /*
   * Initializes the Ignore Manager.
   */
  initialize : function() {
    
    // open the database, initializing if necessary
    var file = Cc["@mozilla.org/file/directory_service;1"]
                 .getService(Ci.nsIProperties)
                 .get("ProfD",Ci.nsIFile);
    file.append("letsignore.sqlite");
    
    var storageSvc = Cc["@mozilla.org/storage/service;1"]
                       .getService(Ci.mozIStorageService);
    this._db = storageSvc.openDatabase(file);

    this._cache = {};
    for (var i in this._CONFIG) {
      // initialize database tables and cache
      this._initializeTable(this._CONFIG[i]);
      this._initializeCache(this._CONFIG[i],i);
    } 
    this.initialized = true;
  },

  /*
   * Return config info so scripts can tie UI to database tables
   */
  getConfig : function() {
    return this._JSON.encode(this._CONFIG);
  },

  /*
   * Inserts an item into the ignore db and sends a message to observers
   * with the relevant data for the ignored item. Input datasr is a JSON
   * encoded string containing the ignored item's data.
   */
  ignore : function(topic,datastr) {
   
    var data = this._JSON.decode(datastr);
    this._cacheData(topic,data[this._getKey(topic)]);
    var table = this._getTableName(topic);

    var query = "INSERT INTO " + table + " VALUES(";
    var j = 0;
    for (var i in data) {
      query += ":param" + (j++) + ", ";
    } 
    query = query.substring(0,query.length-2) + ")";
    var statement = this._db.createStatement(query);
    var index = 0;
    for (var i in data) {
      var paramType = typeof data[i];
      switch (paramType) {
        case 'number':
          statement.bindInt32Parameter(index++,data[i]);
          break;
        case 'string':
          statement.bindStringParameter(index++,data[i]);
          break;
        default:
          index++;
          dump("bad object type in ignore INSERT parameter binding\n");
      }
    }

    /*
     * The following requires Gecko 1.9.2 (FF 3.6) ... hold off on using for now
    try {
      var statement = this._db.createStatement(
                      "INSERT INTO " + table + " VALUES(:value)");
      var params = statement.newBindingParamsArray();
      for (var i in data) {
        var binding = params.newBindingParams();
        binding.bindByIndex(i,data[i]);
        params.addParams(binding);
      }
      statement.bindParameters(params);
     */
             
    var completionHandler = function(reason) {
      var observerService = Cc['@mozilla.org/observer-service;1']
                              .getService(Ci.nsIObserverService);
      var msgType = "letsignore-" + topic + "-ignore";
      observerService.notifyObservers(null,msgType,datastr);
    }
      
    var callback = this._generateStorageCallback(null,null,completionHandler);
    statement.executeAsync(callback);
    statement.reset();
  },

  /*
   * Queries the db for all ignored items for the given topic. The query
   * results are handled by the passed in callback, which must implement
   * the mozIStorageStatementCallback interface.
   */
  getIgnored : function(topic,callback) {
    var table = this._getTableName(topic);
    var statement = this._db.createStatement("SELECT * FROM " + table);
    statement.executeAsync(callback);
    statement.reset();
  },

  /*
   * Removes an ignored item from the db and cache.
   */
  unignore : function(topic,datastr) {
  
    var data = this._JSON.decode(datastr);
    var table = this._getTableName(topic);
    var key = this._getKey(topic);
    this._uncacheData(topic,data[key]);
    var query = "DELETE FROM " + table + " WHERE " + key + "=:keyParam";
    var statement = this._db.createStatement(query);
    statement.params.keyParam = data[key];
    statement.executeAsync();
    statement.reset();
  },
    
  /*
   * Returns boolean indicating whether or not the given value is ignored for
   * the topic.
   */
  isIgnored : function(topic,value) {
  
    return this._cache[topic].indexOf(value) != -1;
  },

  _dumpCache : function(topic) {

    var str = "----- " + topic + " cache -----\n";
    for (var i in this._cache[topic]) {
      str += this._cache[topic][i] + "\n";
    }
    return str += "----- end -----\n";
  },

  /*
   * Creates db tables for storing ignored values if the tables don't exist.
   */
  _initializeTable : function(config) {

    /*
     *  config : {
     *              table : "tableName",
     *              key   : "nameOfColumnForCacheKey"
     *              cols  : ["colName0", "colName1", ..., "colNameN"],
     *              types : ["colType0", "colType1", ..., "colTypeN"]
     *           }
     */
  
    var query = "CREATE TABLE " + config.table + "(";
    for(var i in config.cols) {
      var col = config.cols[i];
      var type = config.types[i];
      query += col + " " + type + ", ";
    }
    query = query.substring(0,query.length-2) + ")";
    try {
      // these either creates the table or throws an error
      this._db.executeSimpleSQL(query);
    } catch(err) {
      // no need to report, since we expect to get the error a lot
    }
  },

  /*
   * Initializes the ignore cache for each topic. Pulls ignored values from 
   * the db table for each topic and inserts into the cache.
   */
  _initializeCache : function(config,topic) {

    this._cache[topic] = [];
    var statement = this._db.createStatement("SELECT * FROM " + config.table);
    var mgr = this;
    var resultHandler = function(resultSet) {
      var row;
      while (row = resultSet.getNextRow()) {
        var rowData = row.getResultByName(config.key);
        mgr._cacheData(topic,rowData);
        //mgr._cacheData(topic,row.getResultByName(config.key));
      }
    }
    var callback = this._generateStorageCallback(resultHandler,null,null);
    statement.executeAsync(callback);
    statement.reset();
  }, 

  /*
   * Adds a value to the cache, indicating that the value for this topic is no
   * ignored. Allows checking ignored values without querying the db.
   */
  _cacheData : function(topic,value) {
    this._cache[topic].push(value+"");
  },

  /*
   * Removes a value from the cache, indicating that the value for this topic
   * is no longer ignored.
   */
  _uncacheData : function(topic,value) {
    var index = this._cache[topic].indexOf(value+"");
    if (index != -1) {
      this._cache[topic].splice(index,1);
    }
  },

  /*
   * Returns the table name for a given ignore topic (threads, users, etc.).
   */
  _getTableName : function(topic) {
    return this._CONFIG[topic].table;
  },

  /*
   * Return the cache key for the given topic. The cache key corresponds to 
   * a db table column that holds unique references for the given table row.
   */
  _getKey : function(topic) {
    return this._CONFIG[topic].key;
  },

  /*
   * Generates a callback that implements the mozIStorageStatementCallback
   * interface using the custom handler functions passed in. Generates
   * a generic callback in the absence of custom handlers
   */
  _generateStorageCallback : function(resultHandler,
                                      errorHandler,
                                      completionHandler) {
    var callback = {
      handleResult : function(aResultSet) {
        if (resultHandler) {
          resultHandler(aResultSet);
        }
      },
      handleError : function(aError) {
        Cu.reportError(aError);
        if (errorHandler) {
          errorHandler(aError);
        }
      },
      handleCompletion : function(aReason) {
        if (aReason != Ci.mozIStorageStatementCallback.REASON_FINISHED) {
          Cu.reportError("Bad SQL query completion, reason: " + aReason);
        }
        if (completionHandler) {
          completionHandler(aReason);
        }
      }
    };
    return callback;
  }
};

function NSGetModule(compMgr, fileSpec){
  return XPCOMUtils.generateModule([rbILetsignoreManager]);
}

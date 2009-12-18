//letsignoreManager.js

/*
 * to compile:
 *
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
  _ignoredThreadsCache : [],
  _ignoredUsersCache : [],

  initialize : function() {
      
    this._initDb();
    this.initialized = true;
  },

  ignoreUser : function(user,ignoreDate) {

    this._cacheUser(user);
    try {
      var statement = this._db.createStatement("INSERT INTO ignoredUsers " +
        "VALUES (:paramUser, :paramIgnoreDate)");
    } catch(err) {
      Cu.reportError(err);
    }
    statement.params.paramUser = user;
    statement.params.paramIgnoreDate = ignoreDate;

    statement.executeAsync({
      handleResult : function(aResultSet) {},
      handleError : function(aError) { Cu.reportError(aError) },
      handleCompletion : function(aReason) {
        if (aReason != Ci.mozIStorageStatementCallback.REASON_FINISHED) {
          Cu.reportError("Query canceled or aborted");
        } else {
          var JSON = Cc['@mozilla.org/dom/json;1']
                       .createInstance(Ci.nsIJSON);
          var data = JSON.encode( { user : user,
                                    ignoreDate : ignoreDate
                                  });
          var observerService = Cc['@mozilla.org/observer-service;1']
                                  .getService(Ci.nsIObserverService);
          observerService.notifyObservers(null,'letsignore-user-ignore',data); 
        }
      }
    });

    statement.reset();
  },

  ignoreThread : function(id,title,auth,dt,code) {
  
    this._cacheThread(id); 
    try {
      var statement = this._db.createStatement("INSERT INTO ignoredThreads " +
        "VALUES (:paramID, :paramTitle, :paramAuth, :paramDate, :paramCode)");
    } catch(err) {
      Cu.reportError(err);
    }
    statement.params.paramID = id;
    statement.params.paramTitle = title;
    statement.params.paramAuth = auth;
    statement.params.paramDate = dt;
    statement.params.paramCode = code;
       
    statement.executeAsync({
      handleResult : function(aResultSet) {
        // do something
      },
      handleError : function(aError) {
        Cu.reportError(aError);
      },
      handleCompletion : function(aReason) {
        if (aReason != Ci.mozIStorageStatementCallback.REASON_FINISHED) {
          Cu.reportError("Query canceled or aborted");
        } else {
          var JSON = Cc['@mozilla.org/dom/json;1']
                       .createInstance(Ci.nsIJSON);
          var data = JSON.encode( { id : id,
                                    title : title,
                                    author : auth,
                                    date : dt,
                                    code : code
                                  });
          var observerService = Cc['@mozilla.org/observer-service;1']
                                  .getService(Ci.nsIObserverService);
          observerService.notifyObservers(null,'letsignore-thread-ignore',data);
        }        
      },
    });
    statement.reset();
  
    
    //alert("inserted into database");
  },

  getIgnoredThreads : function(callback) {

    var statement = this._db.createStatement("SELECT * FROM ignoredThreads");
    statement.executeAsync(callback);
    statement.reset();
  },

  getIgnoredUsers : function(callback) {
    
    var statement = this._db.createStatement("SELECT * FROM ignoredUsers");
    statement.executeAsync(callback);
    statement.reset();
  },

  unignoreThread : function(id) {
    
    this._uncacheThread(id);
    // need to change to bound parameters
    try {
      this._db.executeSimpleSQL(
              "DELETE FROM ignoredThreads WHERE ID='" + id + "'");
    } catch(err) {
      Cu.reportError(err);
    }
  },

  unignoreUser : function(user) {
    
    this._uncacheUser(user);
    try {
      // need to change to bound parameters
      this._db.exectureSimpleSQL(
             "DELETE FROM ignoredUsers WHERE user='" + user + "'");
    } catch(err) {
      Cu.reportError(err);
    }
  },
    
  isThreadIgnored : function(id) {
    return this._ignoredThreadsCache.indexOf(id) != -1;
  },

  isUserIgnored : function(user) {
    return this._ignoredUsersCache.indexOf(user) != -1;
  },

  dumpThreadCache : function() {
    var str = "----- Ignored Threads Cache -----\n";
    for (var i in this._ignoredThreadsCache) {
      str += this._ignoredThreadsCache[i] + "\n";
    }
    return str += "----- End -----\n";
  },

  dumpUserCache : function() {
    var str = "----- Ignored Users Cache -----\n";
    for (var i in this._ignoredUsersCache) {
      str += this._ignoredUsersCache[i] + "\n";
    }
    return str += "----- End -----\n";
  },

  printDb : function() {
    var str = "---\nignoredThreads\n---\n";
    var statement = this._db.createStatement("SELECT * FROM ignoredThreads");
    statement.executeAsync({
      handleResult : function(aResultSet) {
        // do something
        var mystr = "";
        for (let row = aResultSet.getNextRow(); row; row = aResultSet.getNextRow()) {
          mystr += "--- row ---\n";
          let value = row.getResultByName("ID");
          mystr += "ID: " + value + "\n";
          let title = row.getResultByName("title");
          mystr += "title: " + title + "\n"; 
        }
        dump(mystr);
      },
      handleError : function(aError) {
        Cu.reportError(aError);
      },
      handleCompletion : function(aReason) {
        if (aReason != Ci.mozIStorageStatementCallback.REASON_FINISHED) {
          Cu.reportError("Query canceled or aborted");
        }
      },
    });
    statement.reset();

    str += "---\nignoredUsers\n---\n";
    var statement = this._db.createStatement("SELECT * FROM ignoredUsers");
    statement.executeAsync({
      handleResult : function(aResultSet) {
        var mystr = "";
        while (row = aResultSet.getNextRow()) {
          mystr += "--- row ---\n";
          mystr += row.getResultByName("user") + "\n";
        }
        dump(mystr); 
      },
      handleError : function(aError) {
        Cu.reportError(aError);
      },
      handleCompletion : function(aReason) {
        if (aReason != Ci.mozIStorageStatementCallback.REASON_FINISHED) {
          Cu.reportError("Query canceled or aborted");
        }
      },
    });
    statement.reset();

    dump(str);
    return str;
  },

  _initDb : function() {
    
    // open the database, initializing if necessary
    var file = Cc["@mozilla.org/file/directory_service;1"]
                 .getService(Ci.nsIProperties)
                 .get("ProfD",Ci.nsIFile);
    file.append("letsignore.sqlite");
    
    var storageSvc = Cc["@mozilla.org/storage/service;1"]
                       .getService(Ci.mozIStorageService);
    this._db = storageSvc.openDatabase(file);
    // create the ignored threads table if necessary
    try { 
      this._db.executeSimpleSQL("CREATE TABLE ignoredThreads(" +
                               "ID int," +
                               "title varchar(255)," +
                               "author varchar(255)," +
                               "ignoreDate varchar(255)," +
                               "ignoreCode int)");
    } catch(err) {
      // should really fix this and create the table on the first run only
      Cu.reportError(err);
    }
    // create the ignored users table if necessary
    try {
      this._db.executeSimpleSQL("CREATE TABLE ignoredUsers(" +
                                "user varchar(32)," +
                                "ignoreDate varchar(255))");
    } catch(err) {
      Cu.reportError(err);
    }

    // set up the cache
    var statement = this._db.createStatement("SELECT * FROM ignoredThreads");
    var mgr = this;
    statement.executeAsync({
      handleResult : function(aResultSet) {
       while (row = aResultSet.getNextRow()) {
          mgr._cacheThread(row.getResultByName("ID"));
        }
      },
      handleError : function(aError) {
        Cu.reportError(aError);
      },
      handleCompletion : function(aReason) {
        if (aReason != Ci.mozIStorageStatementCallback.REASON_FINISHED) {
          Cu.reportError("Query canceled or aborted");
        }
      },
    });
    statement.reset();

    // user cache
    var statement = this._db.createStatement("SELECT * FROM ignoredUsers");
    statement.executeAsync({
      handleResult : function(aResultSet) {
        while (row = aResultSet.getNextRow()) {
          mgr._cacheUser(row.getResultByName("user"));
        }
      },
      handleError : function(aError) {
        Cu.reportError(aError);
      },
      handleCompletion : function(aReason) {
        if (aReason != Ci.mozIStorageStatementCallback.REASON_FINISHED) {
          Cu.reportError("Query canceled or aborted");
        }
      }
    });
    statement.reset();

  },

  _cacheThread : function(id) {
    this._ignoredThreadsCache.push(id+"");
  },

  _uncacheThread : function(id) {
    var index = this._ignoredThreadsCache.indexOf(id+"");
    if (index != -1) {
      this._ignoredThreadsCache.splice(index,1);
    }
  },

  _cacheUser : function(user) {
    this._ignoredUsersCache.push(user);
  },

  _uncacheUser : function(user) {
    var index = this._ignoredUsersCache.indexOf(user);
    if (index != -1) {
      this._ignoredUsersCache.splice(index,1);
    }
  }
};

function NSGetModule(compMgr, fileSpec){
  return XPCOMUtils.generateModule([rbILetsignoreManager]);
}

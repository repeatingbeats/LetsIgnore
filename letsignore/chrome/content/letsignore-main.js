
/*
 * TODO: add GPL info here
 *
 */


if (typeof(Cc) == 'undefined')
  var Cc = Components.classes;
if (typeof(Ci) == 'undefined')
  var Ci = Components.interfaces;
if (typeof(Cu) == 'undefined')
  var Cu = Components.utils;
if (typeof(Cr) == 'undefined')
  var Cr = Components.results;

if (typeof LetsIgnore == 'undefined') {
  var LetsIgnore = {};
}

LetsIgnore.Controller = {

  onMenuCommand : function() {

    window.open("chrome://letsignore/content/letsignore-window.xul",
                "letsignore","chrome=yes,centerscreen=yes,resizable=yes");
  },

  // greasemonkey compiler generated
  getUrlContents : function(aUrl) {
  
    var ioService = Cc["@mozilla.org/network/io-service;1"]
                      .getService(Ci.nsIIOService);
    var scriptableStream = Cc["@mozilla.org/scriptableinputstream;1"]
                             .getService(Ci.nsIScriptableInputStream);
    var unicodeConverter = Cc["@mozilla.org/intl/scriptableunicodeconverter"]
                             .createInstance(Ci.nsIScriptableUnicodeConverter);
    unicodeConverter.charset = "UTF-8";

    var channel = ioService.newChannel(aUrl, null, null);
    var input = channel.open();
    scriptableStream.init(input);
    var str = scriptableStream.read(input.available());
    scriptableStream.close();
    input.close();

    try {
      return unicodeConverter.ConvertToUnicode(str);
    } catch (e) {
      return str;
    }
  },

  // greasemonkey compiler generated
  isGreasemonkeyable : function (url) {
    
    var scheme = Cc["@mozilla.org/network/io-service;1"]
                   .getService(Ci.nsIIOService)
                   .extractScheme(url);
    return ( (scheme == "http" || scheme == "https" || scheme == "file") &&
             !/hiddenWindow\.html$/.test(url)
    );
  },
 
  // greasemonkey compiler generated, modified for letsignore
  contentLoad : function(e) {
    
    var unsafeWin = e.target.defaultView;
    if (unsafeWin.wrappedJSObject) unsafeWin = unsafeWin.wrappedJSObject;
    var unsafeLoc = new XPCNativeWrapper(unsafeWin, "location").location;
    var href = new XPCNativeWrapper(unsafeLoc, "href").href;
    if (LetsIgnore.Controller.isGreasemonkeyable(href)) {
      var letsrun = false;
      var type = null;
      if ( /http:\/\/www\.letsrun\.com\/forum\/forum.*/.test(href) ||
           /http:\/\/www\.letsrun\.com\/forum\/index.*/.test(href) ) {
         type = 'index';
         letsrun = true;
      }
      if ( /http:\/\/www\.letsrun\.com\/forum.*thread.*/.test(href) ) {
        type = 'thread';
        letsrun = true;
      }
      if (letsrun) {
        var script = LetsIgnore.Controller.getUrlContents(
                     'chrome://letsignore/content/letsignore.js');
        LetsIgnore.Controller.injectScript(script,href,unsafeWin,type);
      }
    }
  
  },
  
  // greasemonkey compiler generated, added functions to API for letsignore
  injectScript : function(script, url, unsafeContentWin, type) {
    var sandbox, script, logger, storage, xmlhttpRequester;
    var safeWin = new XPCNativeWrapper(unsafeContentWin);

    sandbox = new Cu.Sandbox(safeWin);

    var storage = new letsignore_ScriptStorage();
    xmlhttpRequester = new letsignore_xmlhttpRequester(unsafeContentWin,
                       window//appSvc.hiddenDOMWindow
                      );

    sandbox.window = safeWin;
    sandbox.document = sandbox.window.document;
    sandbox.unsafeWindow = unsafeContentWin;
    sandbox.letsignorePageType = type;
    // patch missing properties on xpcnw
    sandbox.XPathResult = Ci.nsIDOMXPathResult;

    var ctr = this;
    // add our own APIs
    sandbox.GM_addStyle = function(css) { ctr.addStyle(sandbox.document, css) };
    sandbox.GM_setValue = ctr.hitch(storage, "setValue");
    sandbox.GM_getValue = ctr.hitch(storage, "getValue");
    sandbox.GM_openInTab = ctr.hitch(this, "openInTab", unsafeContentWin);
    sandbox.GM_xmlhttpRequest = ctr.hitch(xmlhttpRequester,
                                          "contentStartRequest");
    //unsupported
    sandbox.GM_registerMenuCommand = function(){};
    sandbox.GM_log = function(){};
    sandbox.GM_getResourceURL = function(){};
    sandbox.GM_getResourceText = function(){};
  
    // additional API for LetsIgnore
    sandbox.letsignore_ignoreThread = function (id,title,auth,ignoreDate) {
      ignoreDate += "";
      ctr.mgr.ignoreThread(id,title,auth,ignoreDate,0);
    };

    sandbox.letsignore_isThreadIgnored = function (id) {
      return ctr.mgr.isThreadIgnored(id);
    };

    sandbox.letsignore_isUserIgnored = function(user) {
      //return ctr.mgr.isUserIgnored(user); 
      var a = ctr.mgr.isUserIgnored(user); 
      return a;
    };
    
    sandbox.letsignore_ignoreUser = function(user,ignoreDate) {
      ignoreDate += "";
      ctr.mgr.ignoreUser(user,ignoreDate);
    }

    sandbox.letsignore_isLetsIgnoreDisabled = function() {
      return Application.prefs.get("extensions.letsignore.disabled").value;
    };
  
    sandbox.letsignore_isTopAdRemoved = function() {
      return Application.prefs.get("extensions.letsignore.removeTopAd").value;
    };

    sandbox.letsignore_isMidAdRemoved = function() {
      return Application.prefs.get("extensions.letsignore.removeMidAd").value;
    };
    
    sandbox.__proto__ = sandbox.window;
    
    try {
      this.evalInSandbox("(function(){"+script+"})()",url,sandbox);
    } catch (e) {
      Cu.reportError(e);
      var e2 = new Error(typeof e=="string" ? e : e.message);
      e2.fileName = script.filename;
      e2.lineNumber = 0;
      //GM_logError(e2);
      alert(e2 + "122");
    }
  },
   
  // greasemonkey compiler generated
  evalInSandbox: function(code, codebase, sandbox) {
    if (Cu && Cu.Sandbox) {
      // DP beta+
      Cu.evalInSandbox(code, sandbox);
    } else if (Cu && Cu.evalInSandbox) {
      // DP alphas
      Cu.evalInSandbox(code, codebase, sandbox);
    } else if (Sandbox) {
      // 1.0.x
      evalInSandbox(code, sandbox, codebase);
    } else {
      throw new Error("Could not create sandbox.");
    }
  },

  // greasemonkey compiler generated
  openInTab: function(unsafeContentWin, url) {
    
    var tabBrowser = getBrowser(), browser, isMyWindow = false;
    for (var i = 0; browser = tabBrowser.browsers[i]; i++)
    if (browser.contentWindow == unsafeContentWin) {
      isMyWindow = true;
      break;
    }
    if (!isMyWindow) return;
 
    var loadInBackground, sendReferrer, referrer = null;
    loadInBackground = tabBrowser.mPrefs.getBoolPref("browser.tabs.loadInBackground");
    sendReferrer = tabBrowser.mPrefs.getIntPref("network.http.sendRefererHeader");
    if (sendReferrer) {
      var ios = Cc["@mozilla.org/network/io-service;1"]
                  .getService(Ci.nsIIOService);
      referrer = ios.newURI(content.document.location.href, null, null);
    }
    tabBrowser.loadOneTab(url, referrer, null, null, loadInBackground);
  },
 
  // greasemonkey compiler generated
  hitch: function(obj, meth) {
    var unsafeTop = new XPCNativeWrapper(unsafeContentWin, "top").top;

    for (var i = 0; i < this.browserWindows.length; i++) {
      this.browserWindows[i].openInTab(unsafeTop, url);
    }
  },

  // greasemonkey compiler generated
  apiLeakCheck: function(allowedCaller) {
  
    var stack = Components.stack;

    var leaked=false;
    do {
      if (2==stack.language) {
        if ('chrome'!=stack.filename.substr(0, 6) &&
            allowedCaller!=stack.filename ) {
          leaked=true;
          break;
        }
      }

      stack=stack.caller;
    } while (stack);

    return leaked;
  },

  // greasemonkey compiler generated
  hitch: function(obj, meth) {
    
    if (!obj[meth]) {
      throw "method '" + meth + "' does not exist on object '" + obj + "'";
    }

    var hitchCaller=Components.stack.caller.filename;
    var staticArgs = Array.prototype.splice.call(arguments, 2, arguments.length);

    return function() {
      if (LetsIgnore.Controller.apiLeakCheck(hitchCaller)) {
        return;
      }
    
      // make a copy of staticArgs (don't modify it because it gets reused for
      // every invocation).
      var args = staticArgs.concat();

      // add all the new arguments
      for (var i = 0; i < arguments.length; i++) {
        args.push(arguments[i]);
      }

      // invoke the original function with the correct this obj and the combined
      // list of static and dynamic arguments.
      return obj[meth].apply(obj, args);
    };
  },

  // greasemonkey compiler
  addStyle:function(doc, css) {
    var head, style;
    head = doc.getElementsByTagName('head')[0];
    if (!head) { return; }
    style = doc.createElement('style');
    style.type = 'text/css';
    style.innerHTML = css;
    head.appendChild(style);
  },
    
  onLoad : function() {
    //alert("onLoad");;
    var  appcontent=window.document.getElementById("appcontent");
    if (appcontent && !appcontent.greased_letsignore_gmCompiler) {
      appcontent.greased_letsignore_gmCompiler=true;
      appcontent.addEventListener("DOMContentLoaded",
                                  LetsIgnore.Controller.contentLoad, false);
    }
    //this.initDb();
    //this.initialized = true;
    LetsIgnore.Controller.mgr = Cc['@repeatingbeats.com/letsignore/letsignore-manager;1']
                 .getService(Ci.rbILetsignoreManager);
    LetsIgnore.Controller.mgr.initialize();
    // get the ignore cache 
  },

  onUnLoad : function() {
    window.removeEventListener('load', LetsIgnore.Controller.onLoad, false);
    window.removeEventListener('unload', LetsIgnore.Controller.onUnLoad, false);
    window.document.getElementById("appcontent")
      .removeEventListener("DOMContentLoaded",
                            LetsIgnore.Controller.contentLoad, false);
  },
  
  // set up the letsignore sqlite db
  initDb : function() {

    // open the database, initializing if necessary
    var file = Cc["@mozilla.org/file/directory_service;1"]
                 .getService(Ci.nsIProperties)
                 .get("ProfD",Ci.nsIFile);
    file.append("letsignore.sqlite");
    
    var storageSvc = Cc["@mozilla.org/storage/service;1"]
                       .getService(Ci.mozIStorageService);
    this.db = storageSvc.openDatabase(file);
    //alert("creating table");
    try { 
      this.db.executeSimpleSQL("CREATE TABLE ignoredThreads(" +
                               "ID int," +
                               "title varchar(255)," +
                               "author varchar(255)," +
                               "ignoreDate varchar(255))");
    } catch(err) {
      // should really fix this and create the table on the first run only
      Cu.reportError(err);
    }
    //alert("table created");
  },

  // add a thread to the list of ignored threads  
  ignoreThread : function(id,title,auth,ignoreDate) {
    
    //alert("ignoreThread");
    
    var statement = this.db.createStatement("INSERT INTO ignoredThreads " +
        "VALUES (:paramID, :paramTitle, :paramAuth, :paramDate)");
    statement.params.paramID = id;
    statement.params.paramTitle = title;
    statement.params.paramAuth = auth;
    statement.params.paramDate = ignoreDate;
    
    statement.executeAsync({
      handleResult : function(aResultSet) {
        // do something
        Cu.reportError("success??");
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
    
    //alert("inserted into database");
  },
  
}; // LetsIgnore.Controller

function letsignore_ScriptStorage() {
  this.prefMan = new letsignore_PrefManager();
}
letsignore_ScriptStorage.prototype.setValue = function(name, val) {
  this.prefMan.setValue(name, val);
}
letsignore_ScriptStorage.prototype.getValue = function(name, defVal) {
  return this.prefMan.getValue(name, defVal);
}


window.addEventListener('load', LetsIgnore.Controller.onLoad, false);
window.addEventListener('unload', LetsIgnore.Controller.onUnLoad, false);

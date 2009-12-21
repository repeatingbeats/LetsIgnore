/*
 * Window Controller for LetsIgnore
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

LetsIgnore.WindowManager = {

  onLoad : function() {
    
    this.mgr = Cc['@repeatingbeats.com/letsignore/letsignore-manager;1']
                 .getService(Ci.rbILetsignoreManager);
    if (!this.mgr.initialized) {
      alert("Problem initializing letsignore utility window");
    }
    
    // hook up the deck to the options listbox
    var listbox = document.getElementById("content-options-list");
    listbox.selectedIndex = 0;
    var winmgr = this;
    listbox.addEventListener('select', function () {
        var deck = document.getElementById("content-deck");
        deck.selectedIndex = this.selectedIndex;
      },false);

    // hook up the prefs info deck
    var prefListbox = document.getElementById("pref-page-list");
    prefListbox.selectedIndex=0;
    prefListbox.addEventListener('select', function() {
      var prefInfoDeck = document.getElementById("pref-info-deck");
      prefInfoDeck.selectedIndex = this.selectedIndex;
    },false);

    // hook up prefs
    var disableBox = document.getElementById("letsignore-disable-check");
    disableBox.checked =
        Application.prefs.get("extensions.letsignore.disabled").value;
    disableBox.addEventListener("CheckboxStateChange", function() {
        Application.prefs.setValue("extensions.letsignore.disabled",
            !Application.prefs.get("extensions.letsignore.disabled").value);
    },false);

    var topadBox = document.getElementById("letsignore-top-ad-check");
    topadBox.checked =
        Application.prefs.get("extensions.letsignore.removeTopAd").value;
    topadBox.addEventListener("CheckboxStateChange", function() {
        Application.prefs.setValue("extensions.letsignore.removeTopAd",
            !Application.prefs.get("extensions.letsignore.removeTopAd").value);
    },false);

    var midadBox = document.getElementById("letsignore-mid-ad-check");
    midadBox.checked =
        Application.prefs.get("extensions.letsignore.removeMidAd").value;
    midadBox.addEventListener("CheckboxStateChange", function() {
        Application.prefs.setValue("extensions.letsignore.removeMidAd",
            !Application.prefs.get("extensions.letsignore.removeMidAd").value);
    },false);
 
    this.ignoreData = {};
    this.ignoreCount = {};
    this.CONFIG = JSON.parse(this.mgr.getConfig());
    for (var topic in this.CONFIG) {
      this.ignoreCount[topic] = 0;
      this.ignoreData[topic] = [];
      this.configureTree(topic);
    }
 
    // listen for ignored threads and users
    var ignoredThreadObserver = { observe : function(subject,topic,data) {
      if (topic == "letsignore-threads-ignore") {
        winmgr.addIgnoredItem('threads',data);
      }
    }};
    var ignoredUserObserver = { observe : function(subject,topic,data) {
      if (topic == "letsignore-users-ignore") {
        winmgr.addIgnoredItem('users',data);
      }
    }};
    var observerService = Cc['@mozilla.org/observer-service;1']
                            .getService(Ci.nsIObserverService);
    observerService.addObserver(ignoredThreadObserver,
                                "letsignore-threads-ignore",false);
    observerService.addObserver(ignoredUserObserver,
                                "letsignore-users-ignore",false);
    //TODO: remove on unload

    // hook up manual user ignore entry
    this.ignoreUserButton = document.getElementById("users-ignore-button");
    this.ignoreUserButton.addEventListener("command", function() {
      var user = document.getElementById("users-ignore-entry").value;
      if (user && user != "") {
        var userData = {
                          userUser : user,
                          userIgnoreDate : (new Date()).toString().substring(4),
                          userIgnoreCode : 1
                        };
        var userDataStr = JSON.stringify(userData);
        LetsIgnore.WindowManager.mgr.ignore('users',userDataStr)
        document.getElementById("users-ignore-entry").value = "";
      }
    },false);
    var ignoreUserEntry = document.getElementById("users-ignore-entry");
    ignoreUserEntry.addEventListener("keypress", function(e) {
      if (e.keyCode == 13) {
        document.getElementById("users-ignore-button").doCommand();
      }
    },false);
        
  },

  configureTree : function(topic) {
    
    var resultHandler = function(resultSet) {
      var winmgr = LetsIgnore.WindowManager;
      var rowCount = winmgr.fillData(topic,resultSet);
      var view = winmgr.getTreeView(topic,rowCount);
      document.getElementById(topic + "-tree").view = view;
    };

    var completionHandler = function(reason) {
      var defaultSortCol = topic.substring(0,topic.length-1) + "IgnoreDate";
      LetsIgnore.WindowManager.sortTree(topic,
          document.getElementById(defaultSortCol));
    };

    var callback =
        this.generateStorageCallback(resultHandler,null,completionHandler);
    this.mgr.getIgnored(topic,callback);
  },
     
  addIgnoredItem : function(topic,datastr) {
    var data = JSON.parse(datastr);
    this.ignoreData[topic].push(data);
    this.resetTree(topic);
  },
  
  fillData : function(topic,resultSet) {

    if (!this.ignoreData[topic]) {
      this.ignoreData[topic] = [];
    }

    var rowIndex = this.ignoreCount[topic];
    var row;
    var config = this.CONFIG[topic];
    while (row = resultSet.getNextRow()) {
      var itemData = {};
      for (var c in config.cols) {
        itemData[config.cols[c]] = row.getResultByName(config.cols[c]);
      }
      this.ignoreData[topic].push(itemData);
      rowIndex++;
    }
    return this.ignoreCount[topic] = rowIndex;
  },
  
  onTreeSelected : function(topic) {
    
    var selection = document.getElementById(topic + "-tree").view.selection;
    var rangeCount = selection.getRangeCount();
    if (rangeCount > 0) {
      var selected = [];
      for (var r=0; r<rangeCount; r++) {
        var min = new Object();
        var max = new Object();
        selection.getRangeAt(r,min,max);
        for (var i = min.value; i<=max.value; i++) {
          selected.push(i);
        }
      }
      document.getElementById(topic + "-unignore-button").disabled = false;
      if (!this.selected) {
        this.selected = {};
      }
      this.selected[topic] = selected;
    }
  },

  resetTree : function(topic) {
    
    var rowCount = this.ignoreData[topic].length;
    var view = this.getTreeView(topic,rowCount);
    document.getElementById(topic + "-tree").view = view;
  },

  unignore : function(topic) {
    
    for (var i in this.selected[topic]) {
      var index = this.selected[topic][i];
      var item = this.ignoreData[topic][index];
      this.mgr.unignore(topic,JSON.stringify(item));
      this.ignoreData[topic][index] = null;
    }
    for (var i=0; i<this.ignoreData[topic].length; i++) {
      if (!this.ignoreData[topic][i]) {
        this.ignoreData[topic].splice(i--,1);
      }
    }
    this.resetTree(topic);
    document.getElementById(topic + "-unignore-button").disabled = true;
  },
  
  sortTree : function(topic,col) {
    
    var selectedKeyValues = [];
    if (this.selected && this.selected[topic] && this.selected[topic].length > 0) {
      for (var i in this.selected[topic]) {
        var currSelected = this.selected[topic][i];
        var key = this.CONFIG[topic]["key"];
        selectedKeyValues.push(
          this.ignoreData[topic][currSelected][key]);
      }
    }
    
    var tree = document.getElementById(topic + "-tree");
    var sortDirection =
        tree.getAttribute("sortDirection") == "ascending" ? 1 : -1;
    var colName;
    if (col) {
      colName = col.id;
      if (tree.getAttribute("sortResource") == colName) {
        sortDirection *= -1;
      }
    } else {
      colName = tree.getAttribute("sortResource");
    }

    // the sorting function
    var winmgr = this;
    function colSort (a,b) {
      if (winmgr.sortPrep(a[colName]) > winmgr.sortPrep(b[colName])) {
        return sortDirection;
      }
      if (winmgr.sortPrep(a[colName]) < winmgr.sortPrep(b[colName])) {
        return -sortDirection;
      }
      // tiebreaker -> date 
      var tiebreaker = topic.substring(0,topic.length-1) + "IgnoreDate";
      if (colName != tiebreaker) {
        if (winmgr.sortPrep(a[tiebreaker]) > winmgr.sortPrep(b[tiebreaker])) {
          return 1;
        }
        if (winmgr.sortPrep(a[tiebreaker]) < winmgr.sortPrep(b[tiebreaker])) {
          return -1;
        }
      }
      return 0;
    }

    this.ignoreData[topic].sort(colSort);
    tree.setAttribute("sortDirection",
                      sortDirection == 1 ? "ascending" : "descending");
    tree.setAttribute("sortResource",colName);
    var cols = tree.getElementsByClassName(topic+"-treecol");
    for (var c=0; c<cols.length; c++) {
      cols[c].removeAttribute("sortDirection");
    }
    document.getElementById(colName).setAttribute("sortDirection",
        sortDirection == 1 ? "ascending" : "descending");

    this.resetTree(topic);

    // reset the selection
    var selection = tree.view.selection;
    selection.clearSelection();
    if (selectedKeyValues.length > 0) {
      for (var i in selectedKeyValues) {
        var value = selectedKeyValues[i];
        var key = this.CONFIG[topic]["key"];
        var index = this.getRowForValue(topic,key,value);
        if (index) {
          selection.toggleSelect(index);
        }
      }
    }
  },

  //https://developer.mozilla.org/en/Sorting_and_filtering_a_custom_tree_view

  getRowForValue : function(topic,key,value) {
    for (var i in this.ignoreData[topic]) {
      if (this.ignoreData[topic][i][key] == value) {
        return i;
      }
    }
    return null;
  },

  sortPrep : function(obj) {
    return (typeof obj == "string") ? obj.toLowerCase() : obj;
  },

  getTreeView : function(topic,count) {
    
    var winmgr = this;
    return {
      rowCount : count,
      getCellText : function(row,column) {
        return winmgr.ignoreData[topic][row][column.id];
      },
      setTree : function(treebox) {
        this.treebox = treebox;
      },
      isContainer : function(row) {
        return false;
      },
      isSeparator : function(row) {
        return false;
      },
      isSorted : function() {
        return false;
      },
      getLevel : function(row) {
        return 0;
      },
      getImageSrc : function(row,col) {
        return null;
      },
      getRowProperties : function(row,props) {
        // empty
      },
      getCellProperties : function(row,col,props) {
        // empty
      },
      getColumnProperties : function(colid,col,props) {
        // empty
      }
    };
  },

  generateStorageCallback : function(resultHandler,
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
  },


  onUnLoad : function() {
    window.removeEventListener('load',LetsIgnore.WindowManager.onLoad,false);
    window.removeEventListener('unload',LetsIgnore.WindowManager.onUnLoad,false);
  }
}; // LetsIgnore.WindowManager

window.addEventListener('load',function() {
    LetsIgnore.WindowManager.onLoad(); }, false);
window.addEventListener('unload',function() {
    LetsIgnore.WindowManager.onUnLoad(); },false); 

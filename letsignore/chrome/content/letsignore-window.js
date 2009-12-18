
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

    // configure the ignored threads pane
    this.ignoredThreadsData = [];
    this.ignoredThreadsCount = 0;
    var ignoredThreadsCallback = {
      handleResult : function(resultSet) {
        var winmgr = LetsIgnore.WindowManager;
        var rowCount = winmgr.fillThreadsData(resultSet);
        var view = winmgr.getThreadTreeView(rowCount);
        document.getElementById("thread-tree").view = view;
      },
      handleError : function(err) {
        Cu.reportError(err);
      },
      handleCompletion : function(reason) {
        if (reason != Ci.mozIStorageStatementCallback.REASON_FINISHED) {
          Cu.reportError("Query canceled or aborted");  
        }
        LetsIgnore.WindowManager.sortThreadTree(
            document.getElementById("thread-ignore-date"));
      }
    };
    this.mgr.getIgnoredThreads(ignoredThreadsCallback);

    // configure the ignored users pane
    this.ignoredUsersData = [];
    this.ignoredUsersCount = 0;
    var ignoredUsersCallback = {
      handleResult : function(resultSet) {
        var winmgr = LetsIgnore.WindowManager;
        var rowCount = winmgr.fillUsersData(resultSet);
        var view = winmgr.getUserTreeView(rowCount);
        document.getElementById("user-tree").view = view;
    },
    handleError : function(err) {
      Cu.reportError(err);
    },
    handleCompletion : function(reason) {
      if (reason != Ci.mozIStorageStatementCallback.REASON_FINISHED) {
        Cu.reportError("Query canceled or aborted");
      }
      LetsIgnore.WindowManager.sortUserTree(
        document.getElementById("user-date-col"));
      }
    };
    this.mgr.getIgnoredUsers(ignoredUsersCallback);

    // listen for ignored threads and users
    var ignoredThreadObserver = { observe : function(subject,topic,data) {
      if (topic == "letsignore-thread-ignore") {
        winmgr.addIgnoredThread(data);
      }
    }};
    var ignoredUserObserver = { observe : function(subject,topic,data) {
      if (topic == "letsignore-user-ignore") {
        winmgr.addIgnoredUser(data);
      }
    }};
    var observerService = Cc['@mozilla.org/observer-service;1']
                            .getService(Ci.nsIObserverService);
    observerService.addObserver(ignoredThreadObserver,
                                "letsignore-thread-ignore",false);
    observerService.addObserver(ignoredUserObserver,
                                "letsignore-user-ignore",false);
    //TODO: remove on unload

    // hook up manual user ignore entry
    this.ignoreUserButton = document.getElementById("user-ignore-button");
    this.ignoreUserButton.addEventListener("command", function() {
      var user = document.getElementById("user-ignore-entry").value;
      if (user && user != "") {
        LetsIgnore.WindowManager.mgr.ignoreUser(user,
            (new Date()).toString().substring(4));
        document.getElementById("user-ignore-entry").value = "";
      }
    },false);
    var ignoreUserEntry = document.getElementById("user-ignore-entry");
    ignoreUserEntry.addEventListener("keypress", function(e) {
      if (e.keyCode == 13) {
        document.getElementById("user-ignore-button").doCommand();
      }
    },false);
        
  },

  addIgnoredThread : function(threadDataString) {
    var threadData = JSON.parse(threadDataString);
    this.ignoredThreadsData.push(
         { "thread-name-col" : threadData.title,
           "thread-author-col" : threadData.author,
           "thread-ignore-date" : threadData.date,
           "thread-id" : threadData.id
          });
    this.resetThreadTree();
  },

  addIgnoredUser : function(userDataString) {
    var userData = JSON.parse(userDataString);
    this.ignoredUsersData.push(
         { "user-name-col" : userData.user,
           "user-date-col" : userData.ignoreDate
         });
    this.resetUserTree();
  },

  fillThreadsData : function(resultSet) {
    
    if (!this.ignoredThreadsData) {
      this.ignoredThreadsData = [];
    }
    var rowIndex = this.ignoredThreadsCount;
    var row;
    while (row = resultSet.getNextRow()) {
      this.ignoredThreadsData.push(
          { "thread-name-col" : row.getResultByName("title"),
            "thread-author-col" : row.getResultByName("author"),
            "thread-ignore-date" : row.getResultByName("ignoreDate"),
            "thread-id" : row.getResultByName("ID")
          });
      rowIndex++;
    }
    this.ignoredThreadsCount = rowIndex;
    return rowIndex;
  },

  fillUsersData : function(resultSet) {
    if (!this.ignoredUsersData) {
      this.ignoredUsersData = [];
    }
    var rowIndex = this.ignoredUsersCount;
    var row;
    while (row = resultSet.getNextRow()) {
      this.ignoredUsersData.push(
           { "user-name-col" : row.getResultByName("user"),
             "user-date-col" : row.getResultByName("ignoreDate")
           });
      rowIndex++;
    }
    this.ignoredUsersCount = rowIndex;
    return rowIndex;
  },

  onThreadTreeSelected : function() {

    var selection = document.getElementById("thread-tree").view.selection;
    var rangeCount = selection.getRangeCount();
    if (rangeCount > 0) {
      var selected = [];
      for (var r=0; r<rangeCount; r++) {
        var min = new Object();
        var max = new Object();
        selection.getRangeAt(r,min,max);
        for (var i=min.value; i<=max.value; i++) {
          selected.push(i);
        }
      }
      //alert(selected);
      document.getElementById("thread-unignore-button").disabled = false;
      this.selectedThreads = selected;
    }
  },

  onUserTreeSelected : function() {
    
    var selection = document.getElementById("user-tree").view.selection;
    var rangeCount = selection.getRangeCount();
    if (rangeCount > 0) {
      var selected = [];
      for (var r=0; r<rangeCount; r++) {
        var min = new Object();
        var max = new Object();
        selection.getRangeAt(r,min,max);
        for (var i=min.value; i<=max.value; i++) {
          selected.push(i);
        }
      }
      document.getElementById("user-unignore-button").disabled = false;
      this.selectedUsers = selected;
    }
  },

  resetThreadTree : function() {
  
    var rowCount = this.ignoredThreadsData.length;
    var view = this.getThreadTreeView(rowCount);
    document.getElementById("thread-tree").view = view;  
  },

  resetUserTree : function() {
  
    var rowCount = this.ignoredUsersData.length;
    var view = this.getUserTreeView(rowCount);
    document.getElementById("user-tree").view = view;  
  },

  unignore : function() {
    for (var i in this.selectedThreads) {
      var threadIndex = this.selectedThreads[i];
      var thread = this.ignoredThreadsData[threadIndex];
      this.mgr.unignoreThread(thread["thread-id"]);
      this.ignoredThreadsData[threadIndex] = null;
    }
    for (var i=0; i<this.ignoredThreadsData.length; i++) {
      if (!this.ignoredThreadsData[i]) {
        this.ignoredThreadsData.splice(i--,1);
      }
    }
    this.resetThreadTree();
    document.getElementById("thread-unignore-button").disabled = true;
  },

  unignoreUsers : function() {
    for (var i in this.selectedUsers) {
      var userIndex = this.selectedUsers[i];
      var user = this.ignoredUsersData[userIndex];
      this.mgr.unignoreUser(user["user-name-col"]);
      this.ignoredUsersData[userIndex] = null;
    }
    for (var i=0; i<this.ignoredUsersData.length; i++) {
      if (!this.ignoredUsersData[i]) {
        this.ignoredUsersData.splice(i--,1);
      }
    }
    this.resetThreadTree();
    document.getElementById("user-unignore-button").disabled = true;
  },

  //https://developer.mozilla.org/en/Sorting_and_filtering_a_custom_tree_view
  sortThreadTree : function(col) {

    var selectedThreadTitles = [];
    if (this.selectedThreads && this.selectedThreads.length > 0) {
      for (var i in this.selectedThreads) {
        selectedThreadTitles.push(
          this.ignoredThreadsData[this.selectedThreads[i]]["thread-name-col"]);
      }
    }
    
    var tree = document.getElementById("thread-tree");
    var sortDirection =
        tree.getAttribute("sortDirection") == "ascending" ? 1 : -1;
    var colName;
    if (col){
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
      // name ascending for tiebreaker
      var tiebreaker = "thread-ignore-date";
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

    this.ignoredThreadsData.sort(colSort);
    tree.setAttribute("sortDirection",
                      sortDirection == 1 ? "ascending" : "descending");
    tree.setAttribute("sortResource",colName);
    var cols = tree.getElementsByClassName("thread-treecol");
    for (var c=0; c<cols.length; c++) {
      cols[c].removeAttribute("sortDirection");
    }
    document.getElementById(colName).setAttribute("sortDirection",
        sortDirection == 1 ? "ascending" : "descending");

    // reset the selection
    var selection = tree.view.selection;
    selection.clearSelection();
    if (selectedThreadTitles.length > 0) {
      for (var i in selectedThreadTitles) {
        var currTitle = selectedThreadTitles[i];
        // find the row of the thread with this title
        var nameCol = document.getElementById("thread-name-col");
        var threadIndex = this.getThreadRowForValue(nameCol,currTitle);
        // toggle it on
        if (threadIndex) {
          selection.toggleSelect(threadIndex);
        }
      }
    }
    
  },

  sortUserTree : function(col) {

    var selectedUserTitles = [];
    if (this.selectedUsers && this.selectedUsers.length > 0) {
      for (var i in this.selectedUsers) {
        selectedUserTitles.push(
          this.ignoredUsersData[this.selectedUsers[i]]["user-name-col"]);
      }
    }
    
    var tree = document.getElementById("user-tree");
    var sortDirection =
        tree.getAttribute("sortDirection") == "ascending" ? 1 : -1;
    var colName;
    if (col){
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
      // name ascending for tiebreaker
      var tiebreaker = "user-date-col";
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

    this.ignoredUsersData.sort(colSort);
    tree.setAttribute("sortDirection",
                      sortDirection == 1 ? "ascending" : "descending");
    tree.setAttribute("sortResource",colName);
    var cols = tree.getElementsByClassName("user-treecol");
    for (var c=0; c<cols.length; c++) {
      cols[c].removeAttribute("sortDirection");
    }
    document.getElementById(colName).setAttribute("sortDirection",
        sortDirection == 1 ? "ascending" : "descending");

    // reset the selection
    var selection = tree.view.selection;
    selection.clearSelection();
    if (selectedUserTitles.length > 0) {
      for (var i in selectedUserTitles) {
        var currTitle = selectedUserTitles[i];
        // find the row of the user with this title
        var nameCol = document.getElementById("user-name-col");
        var userIndex = this.getUserRowForValue(nameCol,currTitle);
        // toggle it on
        if (userIndex) {
          selection.toggleSelect(userIndex);
        }
      }
    }
    
  },

  getThreadRowForValue : function(treecol,value) {
    for (var i in this.ignoredThreadsData) {
      if (this.ignoredThreadsData[i][treecol.id] == value) {
        return i;
      }
    }
    return null;
  },

  getUserRowForValue : function(treecol,value) {
    for (var i in this.ignoredUsersData) {
      if (this.ignoredUsersData[i][treecol.id] == value) {
        return i;
      }
    }
    return null;
  },

  sortPrep : function(obj) {
    return (typeof obj == "string") ? obj.toLowerCase() : obj;
  },

  getThreadTreeView : function(count) {
    
    var winmgr = this;
    return {
      rowCount : count,
      getCellText : function(row,column) {
        return winmgr.ignoredThreadsData[row][column.id];
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

  getUserTreeView : function(count) {
    
    var winmgr = this;
    return {
      rowCount : count,
      getCellText : function(row,column) {
        return winmgr.ignoredUsersData[row][column.id];
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

  onWindowResize : function() {
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

/*
 * Page Filtering Script for LetsIgnore
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
 * ---------------------------
 *
 * letsignore.js modified from Greasemonkey example user script
 * // 2005-04-22
 * // Copyright (c) 2005, Mark Pilgrim
 * // Released under the GPL license
 * // http://www.gnu.org/copyleft/gpl.html
 *
 */

// ==UserScript==
// @name          letsignore
// @namespace     http://repeatingbeats.com/letsrun/
// @description   alerts on any letsrun forum page
// @include       http://www.letsrun.com/forum
// @exclude       
// ==/UserScript==

addGlobalStyle('.xButton { 	color:#333; ' +
               'font: small \'trebuchet ms\',helvetica,sans-serif; ' +
               'font-size: 0.5em;' +
               'background-color:#ccc; ' +
               'border: 1px solid; ' +
               'padding: 0px 2px 0px 2px; ' +
               'margin-right: 4px; ' +
               'vertical-align: middle; ' +
               'border-color:#666;}');
               
window.addEventListener(
  'load', 
  function() {
   
    var buttons = document.getElementsByClassName("xButton");
    if (buttons.length == 0 ) {
      if (letsignorePageType == 'index') {
        filterIndexPage();
      } 

      if (letsignorePageType == 'thread') {
        filterThreadPage();
      }
    }
  }, // anonymous load function
  true); // window.addEventListener

function filterIndexPage() {

  // remove ad in top half of thread table
  if (letsignore_isTopAdRemoved()) {
    var result = document.evaluate("//td[@rowspan='30']", document, null,
       XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
    if (result.snapshotLength > 0) {
      var topAd = result.snapshotItem(0);
      topAd.parentNode.removeChild(topAd);
    }
  }  

  // remove text ad in middle of thread table
  if (letsignore_isMidAdRemoved()) {
    var result = document.evaluate("//td[@colspan='3']", document, null,
        XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
    if (result.snapshotLength > 0) {
      var midAd = result.snapshotItem(0).parentNode.parentNode.parentNode;
      midAd.parentNode.removeChild(midAd);
    }
  } 
 
  // put 'X' buttons next to all threads and filter out ignored threads   
  if (!letsignore_isLetsIgnoreDisabled()) {  
  
    var forumTables = null; 					
    forumTables = document.evaluate(
        "//td[@class='ForumTable1']//a | //td[@class='ForumTable2']//a",
        document, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);

    for (var i = 0; i<forumTables.snapshotLength; i++) {
      var currLink = forumTables.snapshotItem(i);
      var id = currLink.href.substring(50);
      
      if ( ! /.*forum.*/.test(currLink.href) && letsignore_isMidAdRemoved()) {
        var adNode = currLink.parentNode.parentNode.parentNode;
        adNode.parentNode.removeChild(adNode);
      }
  
      // delete if thread is in ignore database or if the author is ignored
      var userString = currLink.parentNode.lastChild.textContent;
      var user = userString.substring(3,userString.length-1);
      if (letsignore_isThreadIgnored(id) ||
          letsignore_isUserIgnored(user)) {
        var deleteRow = findRow(id);
        if (deleteRow) {
          deleteRow.parentNode.removeChild(deleteRow);
        }
        continue;
      }
 
      // if we have a thread link, attach a button to it 
      if ( isThreadLink(currLink.href) ) {
        var currTD = currLink.parentNode.parentNode;
        var ignoreButton = document.createElement("button");
        ignoreButton.className = "xButton";
        ignoreButton.innerHTML = "X";
        ignoreButton.id = currLink.href.substring(50);

        ignoreButton.addEventListener("click", function(){
          var refNode = this.nextSibling.lastChild;
          var threadTitle = refNode.previousSibling.textContent;
          var threadAuthor = refNode.textContent.substring(3);
          var userString = refNode.textContent;
          var threadAuthor = userString.substring(3,userString.length-1);
          if (this.id != 0) {
            letsignore_ignoreThread(this.id,threadTitle,threadAuthor,
                (new Date()).toString().substring(4));
          }
          var deleteRow = findRow(this.id);
          if (deleteRow) {
            deleteRow.parentNode.removeChild(deleteRow);
            fixIndexPageColors();
          }
        },true);
        
        currTD.insertBefore(ignoreButton,currLink.parentNode); 
      }		
  	}
    fixIndexPageColors();

  } // if !disabled

}

function filterThreadPage() {

  // put 'ignore' buttons next to all users and filter out ignored users  
  if (!letsignore_isLetsIgnoreDisabled()) {  
  
    var responses = null; 					
    responses = document.evaluate(
        "//td[@class='ForumTable1']", 
        document, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
    
    for (var i=0; i<responses.snapshotLength; i++) {
      
      var td = responses.snapshotItem(i);
      var user = td.previousSibling.firstChild.textContent;
      if (letsignore_isUserIgnored(user)) {
        var deletePosts = findPostsByUser(user);
        for (var p in deletePosts) {
          var post = deletePosts[p];
          post.parentNode.removeChild(post);
        }
      }
    
      var ignoreButton = document.createElement("button");
      ignoreButton.className = "xButton";
      ignoreButton.innerHTML = "X";
      //ignoreButton.id =
      //    td.parentNode.parentNode.parentNode.previousSibling.name;
      ignoreButton.id = user;
      ignoreButton.title = "Click here to ignore all threads and posts by user: " + user;
      ignoreButton.addEventListener("click", function() {
        var user = this.id;
        letsignore_ignoreUser(user,(new Date()).toString().substring(4));
        // need to remove this post and any other by this user
        var deletePosts = findPostsByUser(user);
        for (var p in deletePosts) {
          var post = deletePosts[p];
          post.parentNode.removeChild(post);
        }
        
      },true);
      var userTD = td.previousSibling;
      userTD.insertBefore(ignoreButton,userTD.firstChild);
      
    } 
  } // if !disabled

}

function addGlobalStyle(css) {
  var head, style;
  head = document.getElementsByTagName('head')[0];
  if (!head) { 
    return;
  }
  style = document.createElement('style');
  style.type = 'text/css';
  style.innerHTML = css;
  head.appendChild(style);
}

function findRow(id) {
  
  var forumTables = document.evaluate(
      "//td[@class='ForumTable1']//a | //td[@class='ForumTable2']//a",
       document,
       null,
       XPathResult.ORDERED_NODE_SNAPSHOT_TYPE,
       null);
       
  for (var i = 0; i < forumTables.snapshotLength; i++) {
    var currLink = forumTables.snapshotItem(i);
    if(currLink.href.substring(50) == id) {
      return currLink.parentNode.parentNode.parentNode;
    }
  }	
  		
  return null;	
}

function fixIndexPageColors(){
  var forumTables = document.evaluate(
      "//td[@class='ForumTable1']//a | //td[@class='ForumTable2']//a",
      document,
      null,
      XPathResult.ORDERED_NODE_SNAPSHOT_TYPE,
      null);
      
  for (var i = 0; i < forumTables.snapshotLength; i++) {
    var currA = forumTables.snapshotItem(i);
    if ( isThreadLink(currA.href) ) {
      var currTR = currA.parentNode.parentNode.parentNode;
      var currClassName = currA.parentNode.parentNode.className;

      if (i%2==0 && currClassName=='ForumTable1') {
        var children = currTR.childNodes;
        for (var j=0; j<children.length; j++ ){
          var currTD = children[j];
          currTD.className = 'ForumTable2';
        }
      }
      if (i%2==1 && currClassName=='ForumTable2') {
        var children = currTR.childNodes;
        for (var j=0;j<children.length;j++) {
          var currTD = children[j];
          currTD.className = 'ForumTable1';
        }
      }
    }
  }	
}

function findPostsByUser(user) {
    var posts = [];
    var responses = null; 					
    responses = document.evaluate(
        "//td[@class='ForumTable1']", 
        document, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
    
    for (var i=0; i<responses.snapshotLength; i++) {
      
      var td = responses.snapshotItem(i);
      if (user == td.previousSibling.lastChild.textContent) {
        posts.push(td.parentNode.parentNode.parentNode);
      }
    }
    return posts;
}

function isThreadLink(href) {
  return ( /http:\/\/www\.letsrun\.com\/forum\/flat_read.*/.test(href) ); 
}

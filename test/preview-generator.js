/**
 * Created by joiningss on 4/23/14.
 */

var util = require('util');
var request = require('request');
var _ = require('underScore');
var readability = require('../lib/readability.js');
var fs = require('fs');
var Pool = require('generic-pool').Pool;
var crypto = require('crypto');
/**
 * Config
 */

var enableHtmlCache = false; // If true, generator will use name-matching html files in ./preview-html-cache before download it


var htmlTemple = '<!DOCTYPE html> <html> <head> <title> </title> <meta content="text/html; charset=utf-8" http-equiv="content-type"/> </head> <!-- content --> </body> </html>';


var generator = function (options) {
  var selfInstance = this;
  selfInstance.options = _.extend({
    maxConnections: 1,
    priorityRange: 10,
    priority: 3,
    retries: 3,
    retryTimeout: 3000,
    method: "GET",
    debug: false,
    enableHtmlCache: true,
    cacheDirName: 'preview-html-cache',
    previewDirName:'preview-html'
  }, options);
  // Don't make these options persist to individual queries
  var masterOnlyOptions = ["maxConnections", "priorityRange", "onDrain"];
  selfInstance.pool = Pool({
    name: 'postSpider',
    //log        : self.options.debug,
    max: selfInstance.options.maxConnections,
    priorityRange: selfInstance.options.priorityRange,
    create: function (callback) {
      callback(1)
    },
    destroy: function (client) {

    }
  });
  var plannedQueueCallsCount = 0;
  var queuedCount = 0;
  var cacheFileNames = [];
  selfInstance.startGenerator = function (urls) {
    cacheFileNames = [];
    if (!fs.existsSync(__dirname + '/' + selfInstance.options.previewDirName)) {
      fs.mkdirSync(__dirname + '/' + selfInstance.options.previewDirName);
    }
    if (selfInstance.options.enableHtmlCache) {
      if (!fs.existsSync(__dirname + '/' + selfInstance.options.cacheDirName)) {
        fs.mkdirSync(__dirname + '/' + selfInstance.options.cacheDirName);
      }
      if (fs.existsSync(__dirname + '/' + selfInstance.options.cacheDirName)) {
        cacheFileNames = fs.readdirSync(__dirname + '/' + selfInstance.options.cacheDirName);
      }
    }
    urls = _.unique(urls);
    selfInstance.queue(urls);
  }

  selfInstance.queue = function (item) {
    //Did we get a list ? Queue all the URLs.
    if (_.isArray(item)) {
      for (var i = 0; i < item.length; i++) {
        selfInstance.queue(item[i]);
      }
      return;
    }
    queuedCount++;

    var toQueue = item;

    //Allow passing just strings as URLs
    if (_.isString(item)) {
      toQueue = {"uri": item};
    }

    _.defaults(toQueue, selfInstance.options);

    // Cleanup options
    _.each(masterOnlyOptions, function (o) {
      delete toQueue[o];
    });

    selfInstance.pool.acquire(function (err, poolRef) {
      //TODO - which errback to call?
      if (err) {
        console.error("pool acquire error:", err);
        return release(toQueue);
      }
      toQueue._poolRef = poolRef;

      //Make a HTTP request
      if (typeof toQueue.uri == "function") {
        toQueue.uri(function (uri) {
          toQueue.uri = uri;
          selfInstance.request(toQueue);
        });
      } else {
        selfInstance.request(toQueue);
      }
    }, toQueue.priority);
  };
  var getMD5 = function (targetString) {
    return crypto.createHash('md5').update(targetString).digest('hex');
  }
  selfInstance.request = function (opts) {
    // console.log("OPTS",opts);

    var requestOpts = {url: opts.uri}
    if (selfInstance.options.enableHtmlCache) {
      var urlMD5 = getMD5(opts.uri);
      opts['urlMD5'] = urlMD5;
      if (_.include(cacheFileNames, urlMD5)) {
        if (opts.debug) {
          console.log("find cache file for: " + opts.uri);
        }
        fs.readFile(__dirname + '/' + selfInstance.options.cacheDirName + '/' + urlMD5, 'utf-8', function (err, buffer) {
          if (err) {
            //if cache file read err, download file again
            for (var i = cacheFileNames.length - 1; i >= 0; i--) {
              if (cacheFileNames[i] === urlMD5) {
                cacheFileNames.splice(i, 1);
              }
            }
            console.error(err);
            selfInstance.retry(new Error(err), opts);
          } else {
            selfInstance.onContent(err, opts, buffer);
          }
        });
        return;
      }
    }
    if (opts.debug) {
      console.log(opts.method + " " + opts.uri + " ...");
    }
    request(requestOpts, function (error, response) {
      if (error) return selfInstance.onContent(error, opts);
      response.uri = opts.uri;
      if (selfInstance.options.enableHtmlCache && !_.include(cacheFileNames, opts.urlMD5)) {
        var parserHtmlFilePath = __dirname + '/' + selfInstance.options.cacheDirName + '/' + opts.urlMD5;
        fs.writeFile(parserHtmlFilePath, response.body, 'utf-8', function () {
          selfInstance.onContent(error, opts, response.body);
        });
      }else{
        selfInstance.onContent(error, opts, response.body);
      }
    });
  }
  selfInstance.onContent = function (error, toQueue, resultContent) {
    if (error) {
      return selfInstance.retry(error, toQueue);
    }
    if (!resultContent || resultContent == 'null') {
      return  selfInstance.retry(new Error("response body null"), toQueue);
    } else {
      readability.parse(resultContent, toQueue.uri, {removeReadabilityArtifacts: false, removeClassNames: false, debug: false, profile: 1}, function (info) {
        if (!info.error) {
          var parserHtml = htmlTemple.replace('<!-- content -->', info.content);
          var parserHtmlFilePath = __dirname + '/' + selfInstance.options.previewDirName + '/' + (info.title ? (info.title + ".html") : toQueue.uri);
          fs.writeFile(parserHtmlFilePath, parserHtml, 'utf-8', function () {
            release(toQueue);
          });
        } else {
          console.log('readability parser error: ' + toQueue.uri);
          release(toQueue);
        }
      });
    }
  };

  var release = function (opts) {
    queuedCount--;
    // console.log("Released... count",queuedCount,plannedQueueCallsCount);
    if (opts._poolRef) {
      //console.log("_poolRef.priority "+opts.priority);
      selfInstance.pool.release(opts._poolRef);
    }
    // Pool stats are behaving weird - have to implement our own counter
    // console.log("POOL STATS",{"name":self.pool.getName(),"size":self.pool.getPoolSize(),"avail":self.pool.availableObjectsCount(),"waiting":self.pool.waitingClientsCount()});
    if (queuedCount + plannedQueueCallsCount === 0) {
      if (selfInstance.options.onDrain && typeof selfInstance.options.onDrain == "function") selfInstance.options.onDrain();
    }
  };

  selfInstance.retry = function (error, toQueue) {
    if (toQueue.debug) {
      console.log("Error " + error + " when fetching " + toQueue.uri + (toQueue.retries ? " (" + toQueue.retries + " retries left)" : ""));
    }

    if (toQueue.retries) {
      plannedQueueCallsCount++;
      setTimeout(function () {
        if (toQueue.priority > 0) {
          toQueue.priority--;
        }
        toQueue.retries--;
        plannedQueueCallsCount--;
        selfInstance.queue(toQueue);
      }, toQueue.retryTimeout);

    } else if (toQueue.callback) {
      toQueue.callback(error);
    }
    return release(toQueue);
  };
}


exports.Generator = generator;
var g = new generator({
  "debug": true,
  "maxConnections": 1,
  "callback": function (error) {
    if (error) {
      runLogger.error(error);
    }
  },
  "onDrain": function () {

      console.log('onDrain');

  }
});
g.startGenerator(['http://i.jandan.net/2014/04/24/selling-your-panties.html']);
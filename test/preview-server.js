/**
 * Created by joiningss on 4/23/14.
 */
var ip = require('ip');
var fs = require('fs');
var restify = require('restify');
var connect = require('connect');
var chokidar = require('chokidar');
var directory = 'preview-html';
var api_port = 8912;
var html_server_port = 9123;
var debug = false;
var fileChanged = true; //
var fileNames = [];
var watcher = chokidar.watch(__dirname + '/' + directory, {ignored: /[\/\\]\./, persistent: true});

// static html http server
connect()
  .use(connect.static(directory))
  .listen(html_server_port);

//create api server

var server = restify.createServer({
  name: 'preview-server',
  version: '1.0.0'
});

server.get('/getPreviewURLS', function (req, res, next) {
  var previewBasicURL = 'http://' + ip.address() + ':' + html_server_port + '/';
  if (fileChanged) {
    fileChanged = false;
    fileNames = getFileNamesInDir(directory);
  }
  var previewURLS = [];
  fileNames.forEach(function (fileName) {
    previewURLS.push(previewBasicURL + fileName);
  });
  res.send(previewURLS);
  return next();
});

server.listen(api_port, function () {
  console.log('preview api host at: ', 'http://' + ip.address() + ':' + api_port + '/getPreviewURLS');
});


// watch directory file change

watcher
  .on('add', function () {
    if (debug) {
      console.log('file add');
    }
    fileChanged = true;
  })
  .on('unlink', function () {
    if (debug) {
      console.log('file unlink');
    }
    fileChanged = true;
  })


//get preview fileNames, order by time
var getFileNamesInDir = function (dir) {
  if (debug) {
    console.log('getFileNamesInDir');
  }
  if (!fs.existsSync(__dirname + '/' + dir)) {
    fs.mkdirSync(__dirname + '/' + dir);
  }
  var files = fs.readdirSync('./' + dir)
    .map(function (v) {
      return { name: v,
        time: fs.statSync(__dirname + '/' + dir + '/' + v).mtime.getTime()
      };
    })
    .sort(function (a, b) {
      return a.time - b.time;
    })
    .map(function (v) {
      return v.name;
    });
  return files;
}



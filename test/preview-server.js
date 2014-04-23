/**
 * Created by joiningss on 4/23/14.
 */
var ip = require('ip');
var fs = require('fs');
var restify = require('restify');
var connect = require('connect');
var directory = 'preview';
var api_port = 8080;
var html_server_port = 9090;

var server = restify.createServer({
  name: 'preview-server',
  version: '1.0.0'
});

server.get('/getPreviewURLS', function (req, res, next) {
  var previewBasicURL = 'http://'+ip.address()+':'+html_server_port+'/';
  var fileNames = getFileNamesInDir(directory);
  var previewURLS = [];
  fileNames.forEach(function(fileName){
    previewURLS.push(previewBasicURL+fileName);
  });
  res.send(previewURLS);
  return next();
});


server.listen(api_port, function () {
  console.log('Preview api host at: ','http://'+ ip.address()+':'+api_port+'/getPreviewURLS');
});

//get preview fileNames, order by time
var getFileNamesInDir = function (dir){
  if(!fs.exists('./'+dir)){
    fs.mkdir('./'+dir);
  }
  var files = fs.readdirSync('./'+dir)
    .map(function(v) {
      return { name:v,
        time:fs.statSync(__dirname+'/'+dir+'/' + v).mtime.getTime()
      };
    })
    .sort(function(a, b) { return a.time - b.time; })
    .map(function(v) { return v.name; });
  return files;
}

// html http server
connect()
  .use(connect.static(directory))
  .listen(html_server_port);

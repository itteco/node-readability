/**
 * Created by joiningss on 4/23/14.
 */
var ip = require('ip');
var fs = require('fs');
var qr = require('qr-image');
var restify = require('restify');
var connect = require('connect');
var chokidar = require('chokidar');
var directory = 'html';
var api_port = 8912;
var html_server_port = 9123;
var debug = false;
var fileChanged = true; //
var fileNames = [];
var watcher = chokidar.watch(__dirname + '/' + directory, {ignored: /[\/\\]\./, persistent: true});
var qrcode_patch =__dirname+'/server-qrcode-image';
// static html http server
connect()
  .use(connect.static(directory))
  .listen(html_server_port);

//create api server

var server = restify.createServer({
  name: 'Home',
  version: '1.0.0'
});

server.get('/getPreviewUrls', function (req, res, next) {
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

  var address = ip.address()+':' + api_port;
  var apiUrl = 'http://' + address + '/getPreviewUrls'
  if(!fs.existsSync(qrcode_patch)){
    fs.mkdirSync(qrcode_patch);
  }
  if(fs.existsSync(qrcode_patch+'/'+address+'.png')){
    fs.unlinkSync(qrcode_patch+'/'+address+'.png');
  }
  var codeContent = {};
  codeContent['name'] = server.name;
  codeContent['url'] = apiUrl;
  var code = qr.image(JSON.stringify(codeContent) , { type: 'png' });
  var output = fs.createWriteStream(qrcode_patch+'/'+address+'.png');
  code.pipe(output);

  require('child_process').exec('open '+qrcode_patch+'/'+address+'.png', function callback(error, stdout, stderr){
    // result
    if(error){
      console.error(error);
    }
  });

  console.log('preview api host at: ', apiUrl);
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
  var files = fs.readdirSync(__dirname + '/' + dir)
    .filter(function(file) { return file.substr(-5) == '.html'; })
    .sort(function (a, b) {
      return a > b;
    })
  return files;
}



/**
 * Created by joiningss on 4/23/14.
 */
var ip = require('ip');
var fs = require('fs');
var path = require('path');
var querystring = require('querystring');
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
var previews = [];
var watcher = chokidar.watch(__dirname + '/' + directory, {ignored: /[\/\\]\./, persistent: true});
var title_json_patch = path.join(__dirname,directory,'titles.json');
var titleDic = {};
var qrcode_patch =__dirname+'/server-qrcode-image';
// static html http server
connect()
  .use(connect.static(__dirname+'/'+directory))
  .listen(html_server_port);

//create api server

var server = restify.createServer({
  name: 'Joiningss', version: '1.0.0'
});

server.get('/getPreviewUrls', function (req, res, next) {
  var previewBasicURL = 'http://' + ip.address() + ':' + html_server_port + '/';
  if (fileChanged) {
    fileChanged = false;
    fileNames = getFileNamesInDir(directory);
    if(fs.existsSync(title_json_patch)){
      titleDic = JSON.parse(fs.readFileSync(title_json_patch));
    }
    previews = fileNames.map(function(a){
      var title = titleDic[a]?titleDic[a]:a;
      return {url:(previewBasicURL+querystring.escape(a)) ,title:title};
    });
  }
  res.send(previews);
  return next();
});

server.listen(api_port, function () {

  var address = ip.address()+':' + api_port;
  var apiUrl = 'http://' + address + '/getPreviewUrls'
  var qrcodeImagePath = qrcode_patch+'/'+server.name+'-'+address+'.png';
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
  var output = fs.createWriteStream(qrcodeImagePath);
  code.pipe(output);

  require('child_process').exec('open '+qrcodeImagePath, function callback(error){
    if(error){
      console.error(error);
    }
  });

  console.log('preview api host at: '+ apiUrl);
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
    });
  return files;
}



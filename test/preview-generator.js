/**
 * Created by joiningss on 4/23/14.
 */

var util = require('util');
var request = require('request');
var _ = require('underScore');
var readability2 = require('../lib/readability.js');

// If enableHtmlCache is true, generator will use name-matching html files in ./preview-html-cache before download it
var enableHtmlCache = false;
// urls for parse
var targetHtmlURLs = ['',
                      ''];


var startGenerator = function(){
  targetHtmlURLs = _.unique(targetHtmlURLs);



}


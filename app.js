var express = require('express');
var path = require('path');
var favicon = require('serve-favicon');
var HttpLogger = require('morgan');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');
var mongoose = require('mongoose');
var configDb = require('./config').database;
var debug = require('debug')('PollGiftBot:app');

//Routes elements
var routes = require('./routes/index');

//Logger Option
HttpLogger.token('acTime', function(){
    var myDate = new Date();
    var hours = (myDate.getHours()<10 ? '0':'') + myDate.getHours();
    var min = (myDate.getMinutes()<10 ? '0':'') + myDate.getMinutes();
    var sec = (myDate.getSeconds()<10 ? '0':'') + myDate.getSeconds();
    return  '[' + hours + ':' + min + ':' + sec + ']';
});

var app = express();

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'jade');

if(app.get('env') =='development'){
    app.use(HttpLogger('dev'));
}else{
    app.use(HttpLogger(':acTime :method :url :status :response-time ms - :res[content-length]'));
}

//Connection with database
mongoose.connect(configDb.uri);
var conn = mongoose.connection;

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

app.use('/', routes);

//On launch
conn.on('error', function onError(){
    debug('Connection With Db Failed');
});

conn.once('open', function onOpen(){
    debug('Connection is Open');
});

module.exports = app;

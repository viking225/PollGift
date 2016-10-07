/**
 * Created by Tanoh Kevin on 25/09/2016.
 */

var HTTPStatus = require('http-status');
var avSuccessCode = [HTTPStatus.OK, HTTPStatus.CREATED];
var http = require('http');

http.ServerResponse.prototype.respond = function onRespond(content, status){
    if(typeof status === 'undefined'){
        if(typeof content === 'number' || !isNaN(parseInt(content))){
            status = parseInt(content);
            content = undefined;
        }else{
            //no error , normal
            status = 200;
        }
    }

    if(!~avSuccessCode.indexOf(status)){
        content = {
            CODE: status,
            STATUS: http.STATUS_CODES[status],
            MESSAGE: content && content.toString() || null,
            OBJECT: typeof content === 'object' ? content : null
        };
    }
    if(typeof content !== 'object'){
        content = {
            RESULT: content
        };
    }
    this.status(status)
        .json(content);
};

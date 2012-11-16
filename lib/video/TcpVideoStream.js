var Stream    = require('stream').Stream;
var util      = require('util');
var net       = require('net');
var constants = require('../constants');

module.exports = TcpVideoStream;
util.inherits(TcpVideoStream, Stream);
function TcpVideoStream(options) {
  Stream.call(this);

  options = options || {};

  this.readable   = true;
  this._socket    = options.socket || new net.Socket;
  this._port      = options.port || constants.ports.VIDEO;
  this._ip        = options.ip || constants.DEFAULT_DRONE_IP;
  this._timeout   = options.timeout || 1 * 1000;
  this._expectFIN = false;
}

function reInit(cb) {
  this._socket = new net.Socket;
  this.connect(cb);
}

TcpVideoStream.prototype.connect = function(cb) {
  cb = cb || function() {};

  this._socket.connect(this._port, this._ip);
  this._socket.setTimeout(this._timeout);

  var self = this;
  this._socket
    .on('connect', function() {
      if(!self.reconnect) {
        cb(null);
      }
    })
    .on('data', function(buffer) {
      self.emit('data', buffer);
    })
    .on('timeout', function() {
      self._socket.removeAllListeners();
      self._socket.destroy();
      console.log("Connection lost, re-initializing");
      self.reconnect = true;
      reInit.call(self, cb);
    })
    .on('error', function(err) {
      console.log("Socket error", err);
      cb(err);
    })
    .on('end', function() {
      console.log("Socket connection ended");
      if (self._expectFIN) {
        self.emit('close');
        return;
      }

      var err = new Error('TcpVideoStream received FIN unexpectedly.');
      self.emit('error', err);
      self.emit('close', err);
    });
  
    // Just an ugly way of testing the re-connection
    /*
    setTimeout(function() {
      self._socket.emit("timeout");
    }, 5000);
    */
};

TcpVideoStream.prototype.end = function() {
  this._expectFIN = true;
  this._socket.end();
};

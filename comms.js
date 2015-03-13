var jot = require('json-over-tcp'),
	util = require('util'),
	events = require('events');


function Comms(opts) {
	events.EventEmitter.call(this);
	this.clients = {};
	this.opts = opts || {};
}
util.inherits(Comms, events.EventEmitter);

function send(type, msg) {
	msg = msg || {};
	msg.msg = type;
	this.write(msg);
}

Comms.prototype.send = send;

Comms.prototype.write = function(msg) {
	if (this.server) {
		for (var k in this.clients) {
			this.clients[k].write(msg);
		}
	} else if (this.client) {
		if (this.client.connected) {
			this.client.write(msg);
		}
	}
};

Comms.prototype.listen = function(port) {
	var self = this, server = this.server = jot.createServer(port);
	server.on('connection', function(socket) {
		socket.on('error', function(err) {
			// ignore
		});
		wire(socket, self);

		self.emit('connection', socket);
	});
	server.listen(port);
	return server;
};

Comms.prototype.connect = function(port, host, cb) {
	clearReconnect(this);
	var self = this, client = this.client = jot.connect(port, host, cb);

	this.port = port;
	this.host = host;

	client.on('error', function(err) {
		// ignore
	});

	client.on('connect', function() {
		client.connected = true;
	});
	client.on('close', function() {
		client.connected = false;
		if (!client.closing) {
			self._retry = {
				attempt: 0
			};
			reconnect(self);
		}
	});
	
	wire(client, this);

	return client;

};

function reconnect(instance) {
	instance._retry.timer = setTimeout(function() {
		if (!instance.closing) {
			instance.connect(instance.port, instance.host);
		}
	}, Math.min(Math.pow(2, ++instance._retry.attempt) + 100, 60000));
}

function clearReconnect(instance) {
	if (instance._retry) {
		clearTimeout(instance._retry.timer);
	}
}

Comms.prototype.close = function(cb) {
	this.closing = true;
	if (this.server) {
		this.server.close(cb);
		for (var k in this.clients) {
			this.clients[k].destroy();
		}
	} else if (this.client) {
		clearReconnect(this);
		this.client.end();
		if (cb) {
			if (this.client.connected) {
				this.client.once('close', function() {
					cb();
				});
			} else {
				cb();
			}
		}
	}
};




function wire(socket, instance) {
	instance.clients[idOf(socket)] = socket;
	socket.on('close', function() {
		delete instance.clients[idOf(socket)];
	});

	socket.on('data', function(msg) {
		instance.emit(msg.msg, msg, socket);
	});

	socket.send = send;
}

function idOf(socket) {
	return socket.remoteAddress + ':' + socket.remotePort;
}

exports = module.exports = Comms;
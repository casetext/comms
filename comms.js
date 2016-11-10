var jot = require('json-over-tcp'),
	util = require('util'),
	events = require('events');


function Comms(opts) {
	if (!(this instanceof Comms)) {
		return new Comms(opts);
	}
	events.EventEmitter.call(this);
	this.clients = {};
	this.opts = opts || {};
}
util.inherits(Comms, events.EventEmitter);

function send(type, msg) {
	this.write({
		t: type,
		m: msg || {}
	});
}

Comms.prototype.send = send;

Comms.prototype.write = function(msg) {
	if (this.server) {
		if (this._relay) {
			this._relay.socket.write(msg);
		}
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
	var self = this, server;
	
	if (typeof port === 'number') {
		server = this.server = jot.createServer();
	} else {
		server = this.server = jot.createServer(port);
	}

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
		self.emit('connected', client);
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

Comms.prototype.relay = function(port, host) {
	var self = this;
	if (port) {
		var relay = self._relay = {
			port: port,
			host: host,
			socket: jot.connect(port, host)
		};

		relay.socket.on('error', function(err) {
			// ignore
		});
		relay.socket.on('connect', function() {
			relay.connected = true;
		});
		relay.socket.on('close', function() {
			relay.connected = false;
			if (!self.closing) {
				relay.retryAttempt = 0;
				reconnectRelay(self);
			}
		});

		setupRelay(self);
	} else {
		if (self._relay) {
			clearReconnectRelay(self);
			self._relay.socket.removeAllListeners();
			self._relay.socket.close();
		}
		self._relay = null;
	}
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

function reconnectRelay(instance) {
	if (instance._relay) {
		instance._relay.retryTimer = setTimeout(function() {
			instance.relay(instance._relay.port, instance._relay.host);
		}, Math.min(Math.pow(2, ++instance._relay.retryAttempt) + 100, 60000));
	}
}
function clearReconnectRelay(instance) {
	if (instance._relay) {
		clearTimeout(instance._relay.retryTimer);
	}
}

Comms.prototype.close = function(cb) {
	this.closing = true;
	if (this.server) {
		this.server.close(cb);
		for (var k in this.clients) {
			this.clients[k].destroy();
		}
		if (this._relay) {
			this.relay();
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
		instance.emit('disconnected', socket);
	});

	socket.on('data', function(msg) {
		instance.emit('message', msg, socket);
		instance.emit(msg.t, msg.m, socket);
	});

	socket.send = send;
}

function setupRelay(instance) {
	var relay = instance._relay;
	relay.socket.on('data', function(msg) {
		if (msg.t) {
			instance.emit(msg.t, msg.m, new RelayedClient(instance, msg.id));
		} else if (msg.nc) {
			instance.emit('connection', new RelayedClient(instance, msg.nc));
		} else if (msg.dc) {
			instance.emit('disconnected', new RelayedClient(instance, msg.dc));
		}
	});
}

function RelayedClient(instance, id) {
	this.instance = instance;
	this.id = id;
}
RelayedClient.prototype.send = function(type, message) {
	if (this.instance._relay) {
		this.instance._relay.socket.write({
			id: this.id,
			t: type,
			m: message || {}
		});
	}
};

function idOf(socket) {
	return socket.remoteAddress + ':' + socket.remotePort;
}

exports = module.exports = Comms;
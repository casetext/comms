#!/usr/bin/env node

var Comms = require('./comms'),
	relay = new Comms(),
	origin = new Comms();

relay.on('connection', function(socket) {
	origin.write({
		nc: idOf(socket)
	});
});

relay.on('disconnected', function(socket) {
	origin.write({
		dc: idOf(socket)
	});
});

relay.on('message', function(msg, socket) {
	origin.write({
		id: id + idOf(socket),
		t: msg.t,
		m: msg.m
	});
});

origin.on('message', function(msg) {
	if (msg.id) {
		if (relay.clients[msg.id]) {
			relay.clients[msg.id].send(msg.t, msg.m);
		} 
	} else {
		relay.send(msg.t, msg.m);
	}
});

origin.on('connection', function() {
	for (var id in relay.clients) {
		origin.write({
			nc: id
		});
	}
});

function start(originPort, relayPort) {
	origin.listen(originPort);
	relay.listen(relayPort);
}

function idOf(socket) {
	return socket.remoteAddress + ':' + socket.remotePort;
}

if (require.main === module) {
	var argv = require('yargs')
		.alias('p', 'origin-port').describe('p', 'Listen on this port for connections from the origin server')
		.alias('r', 'relay-port').describe('r', 'Listen on this port for connections from clients')
		.help('help').usage('Usage: $0')
		.argv;

	start(argv.p, argv.r);
}

exports.start = start;

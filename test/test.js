var Comms = require('../comms'),
	expect = require('chai').expect;

describe('comms', function() {

	var server, client;

	beforeEach(function() {
		server = new Comms();
		client = new Comms();
	});

	afterEach(function(done) {
		server.close(done);
		client.close();
	});

	it('connects to the server and gets data', function(done) {
		
		server.on('connection', function(socket) {
			socket.send('test', { result: true });
		});
		server.listen(23736);


		client.on('test', function(msg, socket) {
			expect(msg.result).to.be.true;
			done();
		});
		client.connect(23736);

	});

	it('broadcasts messages from the server', function(done) {
		var client2 = new Comms(), rcvs = 0;

		setTimeout(function() {
			server.send('test', { result: true });
		}, 100);
		server.listen(23736);


		function got(msg, socket) {
			if (++rcvs == 2) {
				client2.close(done);
			}
		}

		client.on('test', got);
		client.connect(23736);
		client2.on('test', got);
		client2.connect(23736);

	});


	it('reconnects on disconnection', function(done) {
		var attempt = 0;

		server.on('connection', function(socket) {
			if (attempt++) {
				socket.send('test', { result: true });
			} else {
				socket.destroy();
			}
		});
		server.listen(23736);


		client.on('test', function(msg, socket) {
			expect(msg.result).to.be.true;
			done();
		});
		client.connect(23736);

	});

	it('reconnection attempts withstand the server being gone', function(done) {

		server.on('connection', function(socket) {
			socket.send('test', { result: true });
		});
		setTimeout(function() {
			server.listen(23736);
		}, 1500);


		client.on('test', function(msg, socket) {
			expect(msg.result).to.be.true;
			done();
		});
		client.connect(23736);

	});
});
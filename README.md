comms
=====

[![Build Status](https://travis-ci.org/casetext/comms.svg)](https://travis-ci.org/casetext/comms)

Comms provides dead-simple IPC messaging over TCP.

The server broadcasts messages to all connected clients.

Clients can send messages to the server.  If disconnected, clients will try to automatically reconnect with exponential backoff.

API
---

    Comms = require('comms');
    comms = new Comms();

Each `Comms` instance represents a messaging channel.  The channel can run in server or client mode.

### `listen(port)`

Starts a server on `port`.

### `connect(port, host, cb)`

Connects to a server.  `cb` when first connected.

### `send(type, msg)`

Sends a message.  Servers broadcast the message to all clients.  Clients send the message to the server.  If you call `send` while the client is disconnected, the message will be silently dropped.

- `type` (string) - the type of message
- `msg` (object) - a serializable object

### `on(type, cb)`

Emitted when a message of `type` is received.

- `type` - the type of message
- `cb(msg, socket)` - the callback to invoke.  `socket` is a reference to the sender's socket.  On the server, you can use this to `send` a message back to only one client.

Comms also emits a few socket bookkeeping events.  The one argument passed to the event handler is the `socket`.

- `connection` - fired when the server receives a new client
- `connected` - fired when the client (re)connects
- `disconnected` - fired when the server or client disconnects

### `close(cb)`

Server: closes open client connections and stops listening.
Client: closes the connection to the server.

Calls `cb` when done.
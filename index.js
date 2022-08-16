const app = require('express')();
const http = require('http').Server(app);
const io = require('socket.io')(http);
const port = process.env.PORT || 8080;

app.get('/', (req, res) => {
    res.sendFile(__dirname + '/index.html');
});

let liveOn = false;
let numOfLiveChunks = 1;
let allIn1Socket = false;
let sockets = null;
let bigChunk = new Array(500 * 1024);
bigChunk.fill(3);


function onSocketDisconnect(socket) {
    const rest = sockets.filter((s)=>{
        return s.id != socket.id;
    });
    sockets = rest;
    console.log(` Socket ${socket.id} disconnected. Rest ${sockets.length} socket(s)`);
}

io.on('disconnect', (socket)=>{
    if (socket) {
        onSocketDisconnect(socket);
    }
});

io.on('connection', (socket) => {
    if (!sockets) {
        sockets = [];
    }
    sockets.push(socket);

    socket.emit('message', "Wenbo says 'Hi' to you! Send --help to explore options.");

    console.log(" Connected. Socket id ", socket.id, sockets.length);
    socket.on('heartbeat', ()=>{
        socket.lastHeartbeat = Date.now();
    });

    const stateCheckingInterval = setInterval(()=>{
        if (!socket.lastHeartbeat || (Date.now() - socket.lastHeartbeat)> 2000) {
            socket.disconnect();
            onSocketDisconnect(socket);
            clearInterval(stateCheckingInterval);
        }
    }, 1000);

    socket.on('message', msg => {
        console.log( Date.now(), ` Socket ${socket.id} received msg:`, msg);

        if (msg.startsWith('--')) {
            if (msg == '--help') {
                msg += " --live: switch on/off live socket; --1socket4all: switch on/off message and live in 1 socket; --chunksize=NUM: chunk size;  --#chunks=NUM: number of chunks."
            } else if (msg == '--live') {
                liveOn = !liveOn;
                msg += ": "+liveOn;
                console.log(" Live:", liveOn);
            } else if (msg.toLowerCase() == '--1socket4all') {
                allIn1Socket = !allIn1Socket;
                console.log(" Live and message in 1 socket ?", allIn1Socket);
                msg += ": "+allIn1Socket;
            } else if (msg.toLowerCase().startsWith('--chunksize=',)) {
                const sizeStr = msg.substr(12);
                const size = Number.parseInt(sizeStr);
                if (size && size != bigChunk.length) {
                    bigChunk = null;
                    bigChunk = new Array(size);
                    console.log(` Live chunk size ${size} bytes.`);
                }
            } else if (msg.startsWith('--#chunks=')){
                const numStr = msg.substr(10);
                numOfLiveChunks = Number.parseInt(numStr);
                console.log(" #live chunks", numOfLiveChunks);
            }
        }

        if (liveOn) {
            if (!allIn1Socket) {
                anotherSocket = sockets.find((s)=>{
                    return s.id != socket.id;
                })
                if (anotherSocket) {
                    for (let i = 0; i < numOfLiveChunks; ++i) {
                        console.log(Date.now(), ` Another socket ${anotherSocket.id} responds chunk ${i}`);
                        anotherSocket.emit('live', bigChunk);
                    }
                }
            } else {
                for (let i = 0; i < numOfLiveChunks; ++i) {
                    console.log(Date.now(), ` Socket ${socket.id} responds chunk ${i}`);
                    socket.emit('message', bigChunk);
                }
            }
        }
        console.log(Date.now(),` Socket ${socket.id} responds ${msg}`);
        socket.emit('message', msg);
    });
});

http.listen(port, () => {
    console.log(`Socket.IO server running at http://localhost:${port}/`);
});

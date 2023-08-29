import { Server } from "socket.io";

let io;

const ioHandler = (req, res) => {
  if (!res.socket.server.io) {
    console.log("*First use, starting socket.io", res.socket.server);

    io = new Server(res.socket.server);

    io.on("connection", (socket) => {
      socket.broadcast.emit("a user connected");
      socket.on("progress", (msg) => {
        console.log("Progress Made", msg);
        socket.broadcast.emit("new-progress", msg);
      });
      socket.on("hello", (msg) => {
        socket.emit("hello", "world!");
      });
      res.socket.server.io = socket;
      global.socket = socket;
    });
    // res.socket.server.io = io;
  } else {
    console.log("socket.io already running");
  }
  res.end();
};

export const toAll = function (eventName, data) {
  io.sockets.emit(eventName, data);
};

export const config = {
  api: {
    bodyParser: false,
  },
};

export default ioHandler;

//************************************** */
// import { Server } from 'socket.io';
// ​
// export default function chatSocket(req, res) {
//   if (res.socket.server.io) {
//     console.log('Socket is already running');
//   } else {
//     console.log('Socket is initializing');
//     const io = new Server(res.socket.server);
//     res.socket.server.io = io; //Creating a new Server instance
//     io.on('connection', socket => {
//       // Listening for a connection
//       console.log('Connected');
//     });
//   }
//   res.end();
// }
//********************** */
// import { Server } from "socket.io";

// const SocketHandler = (req, res) => {
//   if (res.socket.server.io) {
//     console.log("Socket is already running");
//   } else {
//     console.log("Socket is initializing");
//     const io = new Server(res.socket.server);
//     res.socket.server.io = io;
//   }
//   res.end();
// };

// export default SocketHandler;

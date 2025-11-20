// server.js
import { createServer } from "http";
import { Server } from "socket.io";

const httpServer = createServer();
const io = new Server(httpServer);

io.on("connection", (socket) => {
    console.log("A client connected. ID:", socket.id);

    // Send an event every 5 seconds
    const interval = setInterval(() => {
        socket.emit("heartbeat", { message: "Still alive!" });
    }, 5000);

    socket.on("disconnect", () => {
        console.log("Client disconnected. ID:", socket.id);
        clearInterval(interval);
    });
});

httpServer.listen(3000, () => {
    console.log("Socket.IO server running on port 3000");
});
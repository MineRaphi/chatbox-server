// server.js
import { createServer } from "http";
import { Server } from "socket.io";
import fs from "fs/promises";

const PORT = 3847

const httpServer = createServer();
const io = new Server(httpServer);

io.on("connection", (socket) => {
    console.log("A client connected. ID:", socket.id);
    let loggedInUser = null;

    // Send an event every 5 seconds
    const interval = setInterval(() => {
        socket.emit("heartbeat", { message: "Still alive!" });
    }, 5000);

    socket.on("disconnect", () => {
        console.log("Client disconnected. ID:", socket.id);
        clearInterval(interval);
    });

    socket.on("register", async ({ username, password }) => {
        console.log("Registering User with ID:", socket.id, "and User Name:", username);
        // Read
        let data = JSON.parse(await fs.readFile("users.json", "utf-8"));

        for (let user of data.users) {
            if (user.name === username) {
                socket.emit("register_failed", "Username already exists.");
                return;
            }
        }

        // Modify
        data.users.push({ username: username, passwordHash: password });

        // Write back
        await fs.writeFile("users.json", JSON.stringify(data, null, 2));
        console.log("User registered successfully. ID:", socket.id, "User Name:", username);
        socket.emit("register_success", "Registration successful.");
    });

    socket.on("login", async ({ username, password }) => {
        console.log("Login attempt from User with ID:", socket.id, "and User Name:", username);
        // Read
        let data = JSON.parse(await fs.readFile("users.json", "utf-8"));
        for (let user of data.users) {
            if (user.username === username && user.passwordHash === password) {
                console.log("User logged in successfully. ID:", socket.id, "User Name:", username);
                socket.emit("login_success", "Login successful.");
                loggedInUser = username;
                return;
            }
        }
        socket.emit("login_failed", "Invalid username or password.");
    });

    socket.on("chatMessage", (msg) => {
        console.log("Message from ID:", socket.id, "Message:", msg);
        socket.broadcast.emit("chatMessage", { user: loggedInUser, message: msg.message });
    });
});

httpServer.listen(PORT, () => {
    console.log(`Socket.IO server running on port ${PORT}`);
});
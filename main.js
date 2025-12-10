// server.js
import { createServer } from "http";
import { Server } from "socket.io";
import fs from "fs/promises";

const PORT = 3847

const httpServer = createServer();
const io = new Server(httpServer);

let chatHistory = [];

chatHistory.push({ user: "Server", message: `Chat since: ${new Date().toLocaleString()}` });

io.on("connection", (socket) => {
    console.log("A client connected. ID:", socket.id);
    let loggedInUser = null;

    socket.on("disconnect", () => {
        console.log(loggedInUser, "Client disconnected. ID:", socket.id);
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
        chatHistory.push({ user: loggedInUser, message: msg.message });
        io.emit("chatMessage", { user: loggedInUser, message: msg.message });
    });

    socket.on("getChatHistory", () => {
        console.log("Chat history requested by ID:", socket.id);
        socket.emit("chatHistory", chatHistory);
    });
    socket.on("7tvEmote", (emoteId) => {
        socket.broadcast.emit("7tvEmote", emoteId);
    });
});

httpServer.listen(PORT, () => {
    console.log(`Socket.IO server running on port ${PORT}`);
});
"use strict";
require("dotenv").config();
const express = require("express");
const session = require("express-session");
const MongoStore = require("connect-mongo")(session);
const passportSocketIo = require("passport.socketio");
const cookieParser = require("cookie-parser");
const routes = require("./routes.js");
const auth = require("./auth.js");
const myDB = require("./connection");
const fccTesting = require("./freeCodeCamp/fcctesting.js");
const app = express();

const http = require("http").createServer(app);
const io = require("socket.io")(http);

fccTesting(app); //For FCC testing purposes
app.use("/public", express.static(process.cwd() + "/public"));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.set("view engine", "pug");

function onAuthorizeSuccess(data, accept) {
  console.log("successful connection to socket.io");
  accept(null, true);
}

function onAuthorizeFail(data, message, error, accept) {
  if (error) throw new Error(message);
  console.log("failed connection to socket.io:", message);
  accept(null, false);
}

myDB(async (client) => {
  const myDataBase = await client.db("database").collection("users");
  auth(app, myDataBase);
  routes(app, myDataBase);
  let currentUsers = 0;
  io.use(
    passportSocketIo.authorize({
      cookieParser: cookieParser,
      key: "express.sid",
      secret: process.env.SESSION_SECRET,
      store: new MongoStore({ url: process.env.MONGO_URI }),
      success: onAuthorizeSuccess,
      fail: onAuthorizeFail,
    })
  );
  io.on("connection", (socket) => {
    console.log("user " + socket.request.user.username + " connected");
    ++currentUsers;
    io.emit("user", {
      name: socket.request.user.username,
      currentUsers,
      connected: true,
    });
    socket.on("chat message", (message) => {
      io.emit("chat message", {
        name: socket.request.user.username,
        message: message,
      });
    });
    socket.on("disconnect", () => {
      --currentUsers;
      io.emit("user", {
        name: socket.request.user.username,
        currentUsers,
        connected: false,
      });
      console.log("user " + socket.request.user.username + " disconnected");
    });
  });
}).catch((e) => {
  app.route("/").get((req, res) => {
    res.render("pug", { title: e, message: "Unable to login" });
  });
});

const PORT = process.env.PORT || 3000;
http.listen(PORT, () => {
  console.log("Listening on port " + PORT);
});

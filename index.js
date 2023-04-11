const express = require("express");
const makeWASocket = require("@adiwajshing/baileys").default;
const {
  DisconnectReason,
  useMultiFileAuthState,
  isJidGroup,
} = require("@adiwajshing/baileys");

const app = express();
const port = 3003;

async function connectToWhatsApp() {
  return new Promise(async (resolve, reject) => {
    const { state, saveCreds } = await useMultiFileAuthState("wa_auth");
    const sock = makeWASocket({
      auth: state,
      printQRInTerminal: true,
    });

    sock.ev.on("connection.update", (update) => {
      const { connection, lastDisconnect } = update;
      if (connection === "close") {
        const shouldReconnect =
          lastDisconnect.error?.output?.statusCode !==
          DisconnectReason.loggedOut;
        console.log(
          "connection closed due to ",
          lastDisconnect.error,
          ", reconnecting ",
          shouldReconnect
        );

        if (shouldReconnect) {
          connectToWhatsApp();
        }
        saveCreds();
      } else if (connection === "open") {
        console.log("opened connection");
        resolve(sock);
      } else if (connection === "auth_failure") {
        console.log("authentication failure, retrying");
        setTimeout(() => connectToWhatsApp(), 5000);
      }
    });
  });
}

connectToWhatsApp().then((sock) => {
  app.locals.sock = sock;
  app.listen(port, () => {
    console.log(`App running on port ${port}`);
  });
});

app.get("/login", async (req, res) => {
  try {
    const { state } = await useMultiFileAuthState("wa_auth");
    const socket = makeWASocket({
      auth: state,
      printQRInTerminal: true,
    });

    socket.connect();
    socket.ev.on("connection.open", () => {
      res.send("Logged in successfully");
    });
  } catch (error) {
    console.error("Error logging in:", error);
    res.status(500).send("Error logging in");
  }
});

app.get("/", (req, res) => {
  res.send("Hello World!");
});

app.get("/send", async (req, res) => {
  const remoteJid = "621234567890@c.us";
  const message = { text: "Hello there!" };
  try {
    await req.app.locals.sock.sendMessage(remoteJid, message);
    res.send("Message sent!");
  } catch (error) {
    console.error("Error sending message:", error);
    res.status(500).send("Error sending message");
  }
});

app.get("/groups", async (req, res) => {
  try {
    let ids = [];
    await req.app.locals.sock.groupFetchAllParticipating().then((groups) => {
      for (let group in groups) {
        if (isJidGroup(groups[group].id))
          ids.push({ id: groups[group].id, subject: groups[group].subject });
      }
      console.log(ids);
    });
    res.send(ids);
  } catch (error) {
    console.error("Error getting group IDs:", error);
    res.status(500).send("Error getting group IDs");
  }
});

const express = require("express");
const makeWASocket = require("@adiwajshing/baileys").default;
const {
  DisconnectReason,
  useMultiFileAuthState,
  isJidGroup,
} = require("@adiwajshing/baileys");

const app = express();
const port = 3003;

// Connect to WhatsApp and return a promise that resolves when the connection is established
async function connectToWhatsApp() {
  return new Promise(async (resolve, reject) => {
    const { state, saveCreds } = await useMultiFileAuthState("wa_auth");
    const sock = makeWASocket({
      // can provide additional config here
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
        // reconnect if not logged out
        if (shouldReconnect) {
          connectToWhatsApp();
        }
        saveCreds();
      } else if (connection === "open") {
        console.log("opened connection");
        resolve(sock); // resolve the promise with the sock object when the connection is established
      } else if (connection === "auth_failure") {
        console.log("authentication failure, retrying");
        setTimeout(() => connectToWhatsApp(), 5000);
      }
    });
  });
}

// Start the server only after connecting to WhatsApp
connectToWhatsApp().then((sock) => {
  app.locals.sock = sock; // store the sock object in the app object
  app.listen(port, () => {
    console.log(`App running on port ${port}`);
  });
});

// Define a request handler function for the app
app.get("/", (req, res) => {
  res.send("Hello World!");
});

// Define a request handler function to send a message
app.get("/send", async (req, res) => {
  const remoteJid = "621234567890@c.us"; // replace with the actual phone number
  const message = { text: "Hello there!" }; // replace with the message you want to send
  try {
    await req.app.locals.sock.sendMessage(remoteJid, message);
    res.send("Message sent!");
  } catch (error) {
    console.error("Error sending message:", error);
    res.status(500).send("Error sending message");
  }
});

// Define a request handler function to get all the group ids
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

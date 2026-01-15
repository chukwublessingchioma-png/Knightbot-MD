const {
  default: makeWASocket,
  useSingleFileAuthState
} = require("@adiwajshing/baileys");

const { state, saveState } = useSingleFileAuthState("./auth.json");

const sock = makeWASocket({ auth: state });

sock.ev.on("messages.upsert", async ({ messages }) => {
  const msg = messages[0];
  if (!msg.message || msg.key.fromMe) return;

  const groupJid = msg.key.remoteJid;
  if (!groupJid.endsWith("@g.us")) return;

  const text =
    msg.message.conversation ||
    msg.message.extendedTextMessage?.text || "";

  const quotedUser =
    msg.message.extendedTextMessage?.contextInfo?.participant;

  /* =========================
     METHOD 1: Reply + add
  ========================== */
  if (text.toLowerCase() === "add" && quotedUser) {
    try {
      await sock.groupParticipantsUpdate(
        groupJid,
        [quotedUser],
        "add"
      );

      await sock.sendMessage(groupJid, {
        text: `✅ @${quotedUser.split("@")[0]} has been added to the group.`,
        mentions: [quotedUser]
      });
    } catch (err) {
      await sock.sendMessage(groupJid, {
        text: "❌ Failed to add user. They may have privacy restrictions."
      });
    }
  }

  /* =========================
     METHOD 2: .add number
  ========================== */
  if (text.startsWith(".add")) {
    const number = text.replace(".add", "").trim();

    if (!number) {
      return sock.sendMessage(groupJid, {
        text: "❌ Usage: .add 2348123456789"
      });
    }

    const userJid = number.replace(/\D/g, "") + "@s.whatsapp.net";

    try {
      await sock.groupParticipantsUpdate(
        groupJid,
        [userJid],
        "add"
      );

      await sock.sendMessage(groupJid, {
        text: `✅ ${number} has been added to the group.`
      });
    } catch (err) {
      await sock.sendMessage(groupJid, {
        text: "❌ Cannot add user. They may need an invite link."
      });
    }
  }
});

sock.ev.on("creds.update", saveState);

console.log("✅ WhatsApp ADD bot running...");

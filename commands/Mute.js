const {
  default: makeWASocket,
  useSingleFileAuthState
} = require("@adiwajshing/baileys");

const { state, saveState } = useSingleFileAuthState("./auth.json");

const sock = makeWASocket({ auth: state });

// Store muted users per group
const muted = {}; // { groupJid: [userJid, userJid] }

sock.ev.on("messages.upsert", async ({ messages }) => {
  const msg = messages[0];
  if (!msg.message || msg.key.fromMe) return;

  const groupJid = msg.key.remoteJid;
  const sender = msg.key.participant || msg.key.remoteJid;

  // 🔇 Auto-delete messages from muted users
  if (muted[groupJid]?.includes(sender)) {
    await sock.sendMessage(groupJid, { delete: msg.key });
    return;
  }

  const text =
    msg.message.conversation ||
    msg.message.extendedTextMessage?.text;

  const quoted = msg.message.extendedTextMessage?.contextInfo?.participant;

  // 📴 MUTE COMMAND (reply + "mute")
  if (text?.toLowerCase() === "mute" && quoted) {
    if (!muted[groupJid]) muted[groupJid] = [];
    if (!muted[groupJid].includes(quoted)) {
      muted[groupJid].push(quoted);
    }

    await sock.sendMessage(groupJid, {
      text: `🔇 @${quoted.split("@")[0]} has been muted.`,
      mentions: [quoted]
    });
  }

  // 🔊 UNMUTE COMMAND (reply + "unmute")
  if (text?.toLowerCase() === "unmute" && quoted) {
    muted[groupJid] = muted[groupJid]?.filter(u => u !== quoted);

    await sock.sendMessage(groupJid, {
      text: `🔊 @${quoted.split("@")[0]} has been unmuted.`,
      mentions: [quoted]
    });
  }
});

sock.ev.on("creds.update", saveState);

console.log("✅ WhatsApp mute bot running...");

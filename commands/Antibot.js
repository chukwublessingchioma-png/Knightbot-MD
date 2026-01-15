const {
  default: makeWASocket,
  useSingleFileAuthState
} = require("@adiwajshing/baileys");

const { state, saveState } = useSingleFileAuthState("./auth.json");
const sock = makeWASocket({ auth: state });

// SETTINGS
const antiBots = {};       // groupJid: true/false
const messageLog = {};     // userJid: { count, lastTime }
const raidLog = {};        // groupJid: count

sock.ev.on("messages.upsert", async ({ messages }) => {
  const msg = messages[0];
  if (!msg.message || msg.key.fromMe) return;

  const groupJid = msg.key.remoteJid;
  if (!groupJid.endsWith("@g.us")) return;

  const sender = msg.key.participant;
  const text =
    msg.message.conversation ||
    msg.message.extendedTextMessage?.text ||
    "";

  /* =====================
     COMMANDS
  ====================== */
  if (text === ".antibots on") {
    antiBots[groupJid] = true;
    return sock.sendMessage(groupJid, {
      text: "🛡️ Anti-Bots & Anti-Raid ENABLED"
    });
  }

  if (text === ".antibots off") {
    antiBots[groupJid] = false;
    return sock.sendMessage(groupJid, {
      text: "❌ Anti-Bots & Anti-Raid DISABLED"
    });
  }

  if (!antiBots[groupJid]) return;

  /* =====================
     ANTI-BOT (DELETE ONLY)
  ====================== */
  const now = Date.now();

  if (!messageLog[sender]) {
    messageLog[sender] = { count: 1, lastTime: now };
  } else {
    const diff = now - messageLog[sender].lastTime;
    messageLog[sender].count = diff < 3000
      ? messageLog[sender].count + 1
      : 1;
    messageLog[sender].lastTime = now;
  }

  // 🚨 Spam / flood detection
  if (messageLog[sender].count >= 5) {
    await sock.sendMessage(groupJid, { delete: msg.key });
  }

  // 🚨 Link spam
  if (/https?:\/\/|wa\.me|bit\.ly/i.test(text)) {
    await sock.sendMessage(groupJid, { delete: msg.key });
  }

  // 🚨 Command spam
  if (text.startsWith(".") && messageLog[sender].count >= 3) {
    await sock.sendMessage(groupJid, { delete: msg.key });
  }

  /* =====================
     ANTI-RAID MODE
  ====================== */
  if (!raidLog[groupJid]) raidLog[groupJid] = 0;
  raidLog[groupJid]++;

  // If many messages hit fast → RAID
  if (raidLog[groupJid] >= 15) {
    raidLog[groupJid] = 0;

    // 🔒 Lock group (admins only)
    await sock.groupSettingUpdate(groupJid, "announcement");

    await sock.sendMessage(groupJid, {
      text: "🚨 ANTI-RAID ACTIVATED\nGroup locked temporarily."
    });

    // 🔓 Auto-unlock after 60 seconds
    setTimeout(async () => {
      await sock.groupSettingUpdate(groupJid, "not_announcement");
      await sock.sendMessage(groupJid, {
        text: "✅ Group unlocked."
      });
    }, 60000);
  }
});

sock.ev.on("creds.update", saveState);
console.log("✅ Anti-Bots + Anti-Raid running");

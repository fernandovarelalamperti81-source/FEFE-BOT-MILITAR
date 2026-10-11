import "dotenv/config";
import express from "express";
import Database from "better-sqlite3";
import {
  Client, GatewayIntentBits, Events, MessageFlags
} from "discord.js";
import crypto from "node:crypto";

const required = [
  "DISCORD_TOKEN", "DISCORD_GUILD_ID", "ROBLOX_GROUP_ID",
  "LINK_SECRET", "ROBLOX_RANK_TO_DISCORD_ROLE"
];
for (const key of required) {
  if (!process.env[key]) throw new Error(`Falta configurar ${key} no .env`);
}
if (process.env.LINK_SECRET.length < 32 ||
    process.env.LINK_SECRET.includes("SUBSTITUA")) {
  throw new Error("LINK_SECRET deve ser um segredo aleatório com pelo menos 32 caracteres.");
}

const GROUP_ID = Number(process.env.ROBLOX_GROUP_ID);
if (!Number.isSafeInteger(GROUP_ID) || GROUP_ID <= 0) {
  throw new Error("ROBLOX_GROUP_ID inválido.");
}
const rankToRole = JSON.parse(process.env.ROBLOX_RANK_TO_DISCORD_ROLE);
const db = new Database("data.sqlite");
db.pragma("journal_mode = WAL");
db.exec(`
  CREATE TABLE IF NOT EXISTS link_codes (
    code TEXT PRIMARY KEY,
    discord_id TEXT NOT NULL,
    roblox_id TEXT NOT NULL,
    roblox_username TEXT NOT NULL,
    expires_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS links (
    discord_id TEXT PRIMARY KEY,
    roblox_id TEXT NOT NULL UNIQUE,
    roblox_username TEXT NOT NULL,
    linked_at INTEGER NOT NULL
  );
`);

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers] });
const app = express();
app.use(express.json({ limit: "10kb" }));

function safeEqual(a, b) {
  const aa = Buffer.from(String(a ?? ""));
  const bb = Buffer.from(String(b ?? ""));
  return aa.length === bb.length && crypto.timingSafeEqual(aa, bb);
}

app.get("/", (_req, res) => res.status(200).send("FEFE BOT MILITAR online."));
app.post("/roblox/confirm", (req, res) => {
  const supplied = req.header("x-link-secret");
  if (!safeEqual(supplied, process.env.LINK_SECRET)) {
    return res.status(401).json({ error: "unauthorized" });
  }

  const { code, robloxUserId, robloxUsername } = req.body ?? {};
  if (typeof code !== "string" || typeof robloxUsername !== "string" ||
      !/^\d{1,20}$/.test(String(robloxUserId ?? "")) ||
      !/^[A-Za-z0-9_]{3,20}$/.test(robloxUsername)) {
    return res.status(400).json({ error: "invalid_input" });
  }

  const pending = db.prepare(
    "SELECT * FROM link_codes WHERE code = ? AND expires_at > ?"
  ).get(code.toUpperCase(), Date.now());

  if (!pending || pending.roblox_id !== String(robloxUserId) ||
      pending.roblox_username.toLowerCase() !== robloxUsername.toLowerCase()) {
    return res.status(400).json({ error: "code_or_identity_mismatch" });
  }

  db.prepare(`
    INSERT INTO links (discord_id, roblox_id, roblox_username, linked_at)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(discord_id) DO UPDATE SET
      roblox_id=excluded.roblox_id,
      roblox_username=excluded.roblox_username,
      linked_at=excluded.linked_at
  `).run(pending.discord_id, String(robloxUserId), robloxUsername, Date.now());
  db.prepare("DELETE FROM link_codes WHERE code = ?").run(code.toUpperCase());

  return res.json({ ok: true, message: "Conta vinculada. Use /sincronizar no Discord." });
});
const port = Number(process.env.PORT || 3000);
app.listen(port, "0.0.0.0", () => console.log(`HTTP server listening on ${port}`));

async function resolveRobloxUser(username) {
  const response = await fetch("https://users.roblox.com/v1/usernames/users", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ usernames: [username], excludeBannedUsers: true })
  });
  if (!response.ok) throw new Error(`Roblox username lookup falhou (${response.status})`);
  const json = await response.json();
  const user = json.data?.[0];
  if (!user) return null;
  return { id: String(user.id), name: user.name };
}

async function getGroupRank(userId) {
  // Endpoint público usado para consultar os grupos e funções públicas de um usuário.
  const response = await fetch(`https://groups.roblox.com/v2/users/${encodeURIComponent(userId)}/groups/roles`);
  if (!response.ok) throw new Error(`Consulta de grupo Roblox falhou (${response.status})`);
  const json = await response.json();
  const entry = (json.data ?? []).find(item => String(item.group?.id) === String(GROUP_ID));
  if (!entry) return null;
  return {
    rank: Number(entry.role?.rank),
    roleName: String(entry.role?.name ?? "Patente desconhecida"),
    roleId: String(entry.role?.id ?? "")
  };
}

async function syncDiscordRole(discordId, rankInfo) {
  const guild = await client.guilds.fetch(process.env.DISCORD_GUILD_ID);
  const member = await guild.members.fetch(discordId);
  const targetRoleId = rankToRole[String(rankInfo.rank)];

  if (!targetRoleId || String(targetRoleId).startsWith("ID_CARGO_")) {
    return { ok: false, reason: `Não existe mapeamento para rank Roblox ${rankInfo.rank}.` };
  }
  const targetRole = await guild.roles.fetch(String(targetRoleId));
  if (!targetRole) return { ok: false, reason: "O ID do cargo configurado não existe no servidor." };
  if (targetRole.managed || targetRole.position >= guild.members.me.roles.highest.position) {
    return { ok: false, reason: "A hierarquia dos cargos impede o bot de atribuir esse cargo." };
  }

  const mappedRoleIds = new Set(
    Object.values(rankToRole).map(String).filter(id => id && !id.startsWith("ID_CARGO_"))
  );
  const toRemove = member.roles.cache.filter(role => mappedRoleIds.has(role.id) && role.id !== targetRole.id);
  if (toRemove.size) {
    await member.roles.remove([...toRemove.keys()], "Sincronização de patente Roblox");
  }
  if (!member.roles.cache.has(targetRole.id)) {
    await member.roles.add(targetRole.id, "Sincronização de patente Roblox");
  }
  return { ok: true, roleName: rankInfo.roleName, rank: rankInfo.rank };
}

client.once(Events.ClientReady, readyClient => {
  console.log(`Bot conectado como ${readyClient.user.tag}`);
});

client.on(Events.InteractionCreate, async interaction => {
  if (!interaction.isChatInputCommand() || !interaction.inGuild()) return;

  try {
    if (interaction.commandName === "vincular") {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      const usernameInput = interaction.options.getString("usuario_roblox", true).trim();
      const user = await resolveRobloxUser(usernameInput);
      if (!user) {
        return interaction.editReply("Não encontrei esse usuário Roblox. Confira o nome e tente novamente.");
      }

      const code = crypto.randomBytes(4).toString("hex").toUpperCase();
      const expiresAt = Date.now() + 10 * 60 * 1000;
      db.prepare("DELETE FROM link_codes WHERE discord_id = ?").run(interaction.user.id);
      db.prepare(`
        INSERT INTO link_codes (code, discord_id, roblox_id, roblox_username, expires_at)
        VALUES (?, ?, ?, ?, ?)
      `).run(code, interaction.user.id, user.id, user.name, expiresAt);

      return interaction.editReply(
        `Seu código temporário é **${code}**.\n` +
        `1. Entre no jogo oficial do Exército Brasileiro do Fefe.\n` +
        `2. No jogo, envie no chat: \`!vincular ${code}\`.\n` +
        `3. O código expira em 10 minutos. Não compartilhe o código com outras pessoas.`
      );
    }

    if (interaction.commandName === "sincronizar") {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      const link = db.prepare("SELECT * FROM links WHERE discord_id = ?").get(interaction.user.id);
      if (!link) return interaction.editReply("Sua conta ainda não está vinculada. Use `/vincular usuario_roblox:SEU_USUARIO`.");
      const rankInfo = await getGroupRank(link.roblox_id);
      if (!rankInfo) return interaction.editReply("Não encontrei sua conta no grupo Roblox configurado.");
      const result = await syncDiscordRole(interaction.user.id, rankInfo);
      if (!result.ok) return interaction.editReply(`Não foi possível sincronizar: ${result.reason}`);
      return interaction.editReply(`Patente sincronizada: **${result.roleName}** (rank ${result.rank}).`);
    }

    if (interaction.commandName === "patente") {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      const link = db.prepare("SELECT * FROM links WHERE discord_id = ?").get(interaction.user.id);
      if (!link) return interaction.editReply("Sua conta ainda não está vinculada. Use `/vincular`.");
      const rankInfo = await getGroupRank(link.roblox_id);
      if (!rankInfo) return interaction.editReply("Você não aparece no grupo Roblox configurado.");
      return interaction.editReply(`Roblox: **${link.roblox_username}**\nPatente: **${rankInfo.roleName}** (rank ${rankInfo.rank}).`);
    }
  } catch (error) {
    console.error("Erro em comando:", error);
    const message = "Ocorreu um erro. Verifique a configuração e os logs do bot.";
    if (interaction.deferred || interaction.replied) await interaction.editReply(message).catch(() => {});
    else await interaction.reply({ content: message, flags: MessageFlags.Ephemeral }).catch(() => {});
  }
});

client.login(process.env.DISCORD_TOKEN);

import "dotenv/config";
import { REST, Routes, SlashCommandBuilder } from "discord.js";

const required = ["DISCORD_TOKEN", "DISCORD_CLIENT_ID", "DISCORD_GUILD_ID"];
for (const key of required) {
  if (!process.env[key]) throw new Error(`Falta configurar ${key} no .env`);
}

const commands = [
  new SlashCommandBuilder()
    .setName("vincular")
    .setDescription("Gera um código para vincular sua conta Roblox.")
    .addStringOption(option =>
      option.setName("usuario_roblox")
        .setDescription("Seu nome de usuário Roblox (não envie senha).")
        .setRequired(true)),
  new SlashCommandBuilder()
    .setName("sincronizar")
    .setDescription("Atualiza sua patente do grupo Roblox no Discord."),
  new SlashCommandBuilder()
    .setName("patente")
    .setDescription("Mostra a patente Roblox vinculada à sua conta.")
].map(command => command.toJSON());

const rest = new REST({ version: "10" }).setToken(process.env.DISCORD_TOKEN);
await rest.put(
  Routes.applicationGuildCommands(process.env.DISCORD_CLIENT_ID, process.env.DISCORD_GUILD_ID),
  { body: commands }
);
console.log("Comandos registrados no servidor de teste.");

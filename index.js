require('dotenv').config();
const { Client, GatewayIntentBits } = require('discord.js');
const fetch = require('node-fetch');

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent]
});

async function getManifest() {
  const response = await fetch("https://www.bungie.net/Platform/Destiny2/Manifest/", {
    headers: {
      "X-API-Key": process.env.BUNGIE_API_KEY
    }
  });

  if (!response.ok) {
    throw new Error(`Erreur API Bungie : ${response.status}`);
  }

  const data = await response.json();
  return data.Response.version;
}

client.once('ready', () => {
  console.log(`Connecté en tant que ${client.user.tag}`);
});

client.on('messageCreate', async message => {
  if (message.author.bot) return;

  if (message.content === '!ping') {
    message.reply('Pong !');
  }

  if (message.content === '!bungie') {
    try {
      const version = await getManifest();
      message.reply(`Version du manifest Destiny 2 : ${version}`);
    } catch (error) {
      console.error(error);
      message.reply("Impossible de contacter l'API Bungie.");
    }
  }
});

client.login(process.env.DISCORD_TOKEN);


require('dotenv').config();
const { Client, GatewayIntentBits } = require('discord.js');
const fetch = require('node-fetch');
const { ajouter_rotation, obtenir_derniere_rotation } = require('./database');

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

async function searchPlayerByBungieName(name, code) {
  const response = await fetch("https://www.bungie.net/Platform/Destiny2/SearchDestinyPlayerByBungieName/-1/", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-API-Key": process.env.BUNGIE_API_KEY
    },
    body: JSON.stringify({
      displayName: name,
      displayNameCode: parseInt(code)
    })
  });

  if (!response.ok) {
    throw new Error(`Erreur lors de la recherche du joueur : ${response.status}`);
  }

  const data = await response.json();
  return data.Response[0];
}

async function getPlayerStats(membershipType, membershipId) {
  const response = await fetch(`https://www.bungie.net/Platform/Destiny2/${membershipType}/Account/${membershipId}/Stats/`, {
    headers: {
      "X-API-Key": process.env.BUNGIE_API_KEY
    }
  });

  if (!response.ok) {
    throw new Error(`Erreur lors de la récupération des stats : ${response.status}`);
  }

  const data = await response.json();
  return data.Response.mergedAllCharacters.results.allPvP.allTime;
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

  if (message.content.startsWith('!joueur')) {
    const args = message.content.split(' ')[1];
    if (!args || !args.includes('#')) {
      return message.reply("Utilisation : `!joueur Nom#Code` (ex: `!joueur Alex*#2048`)");
    }
    const [name, code] = args.split('#');
    try {
      const player = await searchPlayerByBungieName(name, code);
      if (!player) {
        return message.reply("Aucun joueur trouvé avec ce Bungie ID.");
      }
      message.reply(`Joueur trouvé :\n- Nom : ${player.bungieGlobalDisplayName}#${player.bungieGlobalDisplayNameCode}\n- Membership ID : ${player.membershipId}\n- Type : ${player.membershipType}`);
    } catch (error) {
      console.error(error);
      message.reply("Erreur lors de la recherche du joueur.");
    }
  }

  if (message.content.startsWith('!stats')) {
    const args = message.content.split(' ')[1];
    if (!args || !args.includes('#')) {
      return message.reply("Utilisation : `!stats Nom#Code` (ex: `!stats Alex*#2048`)");
    }
    const [name, code] = args.split('#');
    try {
      const player = await searchPlayerByBungieName(name, code);
      if (!player) {
        return message.reply("Joueur introuvable.");
      }
      const stats = await getPlayerStats(player.membershipType, player.membershipId);
      message.reply(`📊 Statistiques PvP de ${player.bungieGlobalDisplayName}#${player.bungieGlobalDisplayNameCode} :\n- K/D : ${stats.killsDeathsRatio.basic.displayValue}\n- Précision : ${stats.precisionKills.basic.displayValue}\n- Victoires : ${stats.activitiesWon.basic.displayValue}\n- Parties jouées : ${stats.activitiesEntered.basic.displayValue}`);
    } catch (error) {
      console.error(error);
      message.reply("Impossible de récupérer les statistiques du joueur.");
    }
  }

  if (message.content === '!rotations') {
    try {
      const rotation = obtenir_derniere_rotation();
      if (!rotation) {
        return message.reply("Aucune rotation enregistrée.");
      }
      const messageEmbed = {
        color: 0x0099ff,
        title: `🔄 Rotations de la semaine (${rotation.semaine})`,
        fields: [
          { name: '🌌 Raids en vedette', value: rotation.raids },
          { name: '🏰 Donjons en vedette', value: rotation.donjons },
          { name: '🕳️ Secteurs oubliés', value: rotation.secteurs },
          { name: '🌑 Nuit Noire', value: rotation.nuitnoire }
        ],
        timestamp: new Date(),
        footer: { text: 'Données issues de la base SQLite' }
      };
      message.channel.send({ embeds: [messageEmbed] });
    } catch (error) {
      console.error(error);
      message.reply("Erreur lors de la récupération des rotations.");
    }
  }
});

client.login(process.env.DISCORD_TOKEN);

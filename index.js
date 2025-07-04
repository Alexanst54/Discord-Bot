require('dotenv').config();
const { Client, GatewayIntentBits } = require('discord.js');
const fetch = require('node-fetch');

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent]
});

// Recherche d'un joueur par Bungie ID
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

// Récupération des statistiques PvP
async function getPlayerStats(membershipType, membershipId) {
  const response = await fetch(\`https://www.bungie.net/Platform/Destiny2/\${membershipType}/Account/\${membershipId}/Stats/\`, {
    headers: {
      "X-API-Key": process.env.BUNGIE_API_KEY
    }
  });

  if (!response.ok) {
    throw new Error(\`Erreur lors de la récupération des stats : \${response.status}\`);
  }

  const data = await response.json();
  return data.Response.mergedAllCharacters.results.allPvP.allTime;
}

client.once('ready', () => {
  console.log(\`Connecté en tant que \${client.user.tag}\`);
});

client.on('messageCreate', async message => {
  if (message.author.bot) return;

  // Commande !ping
  if (message.content === '!ping') {
    message.reply('Pong !');
  }

  // Commande !joueur Nom#Code
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

      message.reply(\`Joueur trouvé :
- Nom : \${player.bungieGlobalDisplayName}#\${player.bungieGlobalDisplayNameCode}
- Membership ID : \${player.membershipId}
- Type : \${player.membershipType}\`);
    } catch (error) {
      console.error(error);
      message.reply("Erreur lors de la recherche du joueur.");
    }
  }

  // Commande !stats Nom#Code
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

      message.reply(\`📊 Statistiques PvP de \${player.bungieGlobalDisplayName}#\${player.bungieGlobalDisplayNameCode} :
- K/D : \${stats.killsDeathsRatio.basic.displayValue}
- Précision : \${stats.precisionKills.basic.displayValue}
- Victoires : \${stats.activitiesWon.basic.displayValue}
- Parties jouées : \${stats.activitiesEntered.basic.displayValue}\`);
    } catch (error) {
      console.error(error);
      message.reply("Impossible de récupérer les statistiques du joueur.");
    }
  }

  // Commande !rotations
  if (message.content === '!rotations') {
    const messageEmbed = {
      color: 0x0099ff,
      title: '🔄 Rotations de la semaine (1 - 7 juillet 2025)',
      fields: [
        {
          name: '🌌 Raids en vedette',
          value: '- King’s Fall\n- Garden of Salvation'
        },
        {
          name: '🏰 Donjons en vedette',
          value: '- Grasp of Avarice\n- Shattered Throne'
        },
        {
          name: '🕳️ Secteurs oubliés (Légende/Maîtrise)',
          value: '⚠️ Non disponible automatiquement. Consulte Next Stage ou NovArcan pour les détails.'
        },
        {
          name: '🌑 Nuit Noire',
          value: '⚠️ Rotation exacte non disponible. Consulte JudgeHype pour les mises à jour hebdomadaires.'
        }
      ],
      timestamp: new Date(),
      footer: {
        text: 'Mise à jour manuelle — automatisation possible plus tard.'
      }
    };

    message.channel.send({ embeds: [messageEmbed] });
  }
});

client.login(process.env.DISCORD_TOKEN);

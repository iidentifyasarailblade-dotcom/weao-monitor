const axios = require("axios");

const WEBHOOK_URL = process.env.WEBHOOK_URL;
const ROLE_ID = "1511364486169104384";

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

        await axios.post(WEBHOOK_URL, {
            content: `<@&${ROLE_ID}>`,
            allowed_mentions: {
                roles: [ROLE_ID]
            },
            embeds: [
                {
                    title: "🚀 Roblox Version Update",
                    color: 0x00ff00,
                    fields: [
                        {
                            name: "🪟 Windows",
                            value: data.Windows || "Unknown",
                            inline: false
                        },
                        {
                            name: "🍎 Mac",
                            value: data.Mac || "Unknown",
                            inline: false
                        },
                        {
                            name: "📱 Android",
                            value: data.Android || "Unknown",
                            inline: true
                        },
                        {
                            name: "📱 iOS",
                            value: data.iOS || "Unknown",
                            inline: true
                        }
                    ],
                    timestamp: new Date().toISOString(),
                    footer: {
                        text: "WEAO Version Monitor"
                    }
                }
            ]
        });

        console.log("Version update sent");
    } catch (err) {
        console.error("Error:", err.message);
    }
}

setInterval(checkVersions, 300000); // 5 minutes
checkVersions();

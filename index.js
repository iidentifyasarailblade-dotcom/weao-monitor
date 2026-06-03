const axios = require("axios");

const WEBHOOK_URL = process.env.WEBHOOK_URL;

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
            embeds: [{
                title: "Roblox Version Check",
                description:
                    `Windows: ${data.Windows}\n` +
                    `Mac: ${data.Mac}`,
                timestamp: new Date().toISOString()
            }]
        });

        console.log("Sent update");
    } catch (err) {
        console.error(err.message);
    }
}

setInterval(checkVersions, 300000);
checkVersions();

const axios        = require("axios");
const EXECUTOR_ROLES = require("./executorRoles");

// ─── Environment Config ────────────────────────────────────────────────────────

const WEBHOOK_URL       = process.env.WEBHOOK_URL;
const ROBLOX_ROLE_ID    = process.env.ROBLOX_ROLE_ID || null;
const CHECK_INTERVAL_MS = parseInt(process.env.CHECK_INTERVAL_MS || "300000");

// Comma-separated executor titles to watch. Leave unset = watch all.
const WATCH_EXECUTORS = process.env.WATCH_EXECUTORS
    ? process.env.WATCH_EXECUTORS.split(",").map(s => s.trim().toLowerCase())
    : [];

const WEAO_HEADERS = { "User-Agent": "WEAO-3PService" };

const WEAO_ICON = "https://cdn.discordapp.com/attachments/1511463012605890560/1511576741121101954/astral_google_favicon_512.png?ex=6a20f50a&is=6a1fa38a&hm=feac2813e7515172e00d19ac76b083bc816a0f3110d766c5ec78eacc54f00f95&";

// ─── State ────────────────────────────────────────────────────────────────────

let lastWindowsVersion = null;
let lastMacVersion     = null;

const lastExecutorState = {};

let initialized = false;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function discordTimestamp(style = "F") {
    return `<t:${Math.floor(Date.now() / 1000)}:${style}>`;
}

// Look up this server's role ID for an executor. Returns null if not mapped or empty.
function getRoleId(exploitTitle) {
    const id = EXECUTOR_ROLES[exploitTitle.toLowerCase()];
    return id && id.trim() !== "" ? id.trim() : null;
}

function allowedMentions(roleId) {
    return roleId ? { roles: [roleId] } : { roles: [] };
}

async function sendWebhook(payload) {
    if (!WEBHOOK_URL) {
        console.error("[ERROR] WEBHOOK_URL is not configured.");
        return;
    }
    try {
        await axios.post(WEBHOOK_URL, payload);
    } catch (err) {
        console.error("[Webhook] Failed:", err.response?.data || err.message);
    }
}

// ─── Roblox Version Notifications ─────────────────────────────────────────────

function buildRobloxEmbed(platform, hash, type) {
    const isRevert = type === "revert";

    return {
        color: isRevert ? 0xED4245 : 0x57F287,
        title: isRevert
            ? "Roblox has reverted to a previous version"
            : "Roblox has been updated",
        description: isRevert
            ? `Roblox has reverted to an older version on **${platform}**.`
            : `A new Roblox version has been pushed to the **LIVE** channel on **${platform}**.`,
        fields: [
            { name: "Platform", value: platform,      inline: true  },
            { name: "Hash",     value: `\`${hash}\``, inline: true  },
            { name: "Date",     value: discordTimestamp(), inline: false },
        ],
        footer: {
            text: "For more information, visit weao.xyz | LIVE Channel",
            icon_url: WEAO_ICON,
        },
        timestamp: new Date().toISOString(),
    };
}

async function checkRobloxVersions() {
    const { data } = await axios.get("https://weao.xyz/api/versions/current", {
        headers: WEAO_HEADERS,
    });

    if (!initialized) {
        lastWindowsVersion = data.Windows;
        lastMacVersion     = data.Mac;
        return;
    }

    const windowsChanged = data.Windows !== lastWindowsVersion;
    const macChanged     = data.Mac     !== lastMacVersion;

    if (!windowsChanged && !macChanged) {
        console.log(`[Roblox] No change.`);
        return;
    }

    if (windowsChanged) {
        const type    = data.WindowsResponse?.type ?? "new";
        const roleId  = ROBLOX_ROLE_ID;
        const mention = roleId ? `<@&${roleId}>` : null;

        await sendWebhook({
            content:          mention,
            allowed_mentions: allowedMentions(roleId),
            embeds: [buildRobloxEmbed("Windows", data.Windows, type)],
        });

        lastWindowsVersion = data.Windows;
        console.log(`[Roblox] Windows sent: ${data.Windows} (${type})`);
    }

    if (macChanged) {
        const type    = data.MacResponse?.type ?? "new";
        const roleId  = ROBLOX_ROLE_ID;
        const mention = roleId ? `<@&${roleId}>` : null;

        await sendWebhook({
            content:          mention,
            allowed_mentions: allowedMentions(roleId),
            embeds: [buildRobloxEmbed("Mac", data.Mac, type)],
        });

        lastMacVersion = data.Mac;
        console.log(`[Roblox] Mac sent: ${data.Mac} (${type})`);
    }
}

// ─── Executor Status Notifications ────────────────────────────────────────────

function execLabel(extype) {
    const map = {
        wexecutor: "executor",
        wexternal: "external",
        mexecutor: "Mac executor",
        mexternal: "Mac external",
    };
    return map[extype] || "executor";
}

function buildExecutorEmbed(exploit, changes) {
    const label  = execLabel(exploit.extype);
    const fields = [];

    // Version + Roblox version
    fields.push(
        { name: "New Version",    value: `\`${exploit.version}\``,    inline: true },
        { name: "Roblox Version", value: `\`${exploit.rbxversion}\``, inline: true },
    );

    // Date from API if available, otherwise Discord timestamp
    fields.push({
        name:   "Date",
        value:  exploit.updatedDate || discordTimestamp(),
        inline: false,
    });

    // Detection change
    if (changes.detected !== undefined) {
        fields.push({
            name:   "Detection",
            value:  exploit.detected ? "Detected" : "Undetected",
            inline: true,
        });
    }

    // Update status change
    if (changes.updateStatus !== undefined && !exploit.updateStatus) {
        fields.push({ name: "Update Status", value: "Outdated", inline: true });
    }

    let title, description;

    if (changes.version || changes.rbxversion) {
        title       = `An ${label} update has been detected`;
        description = `**${exploit.title}** has been updated for **${exploit.platform}**!`;
    } else if (changes.detected !== undefined) {
        title       = "Detection status changed";
        description = `**${exploit.title}** detection status has changed on **${exploit.platform}**.`;
    } else {
        title       = `An ${label} update has been detected`;
        description = `**${exploit.title}** has been updated for **${exploit.platform}**!`;
    }

    let color = 0xFEE75C;
    if (exploit.updateStatus && !exploit.detected) color = 0x57F287;
    if (exploit.detected)                          color = 0xED4245;

    return {
        color,
        title,
        description,
        fields,
        footer: {
            text: "Powered by WEAO, The #1 Roblox exploit status tracker",
            icon_url: WEAO_ICON,
        },
        timestamp: new Date().toISOString(),
    };
}

async function checkExecutors() {
    const { data: exploits } = await axios.get("https://weao.xyz/api/status/exploits", {
        headers: WEAO_HEADERS,
    });

    if (!Array.isArray(exploits)) {
        console.warn("[Executors] Unexpected API response.");
        return;
    }

    const filtered = WATCH_EXECUTORS.length > 0
        ? exploits.filter(e => WATCH_EXECUTORS.includes(e.title.toLowerCase()))
        : exploits;

    if (!initialized) {
        for (const exploit of filtered) {
            lastExecutorState[exploit.title.toLowerCase()] = {
                version:      exploit.version,
                rbxversion:   exploit.rbxversion,
                updateStatus: exploit.updateStatus,
                detected:     exploit.detected,
            };
        }
        return;
    }

    for (const exploit of filtered) {
        const key  = exploit.title.toLowerCase();
        const prev = lastExecutorState[key];

        if (!prev) {
            lastExecutorState[key] = {
                version:      exploit.version,
                rbxversion:   exploit.rbxversion,
                updateStatus: exploit.updateStatus,
                detected:     exploit.detected,
            };
            continue;
        }

        const versionChanged      = exploit.version      !== prev.version;
        const rbxVersionChanged   = exploit.rbxversion   !== prev.rbxversion;
        const updateStatusChanged = exploit.updateStatus !== prev.updateStatus;
        const detectedChanged     = exploit.detected     !== prev.detected;

        if (!versionChanged && !rbxVersionChanged && !updateStatusChanged && !detectedChanged) {
            continue;
        }

        // Use YOUR server's role ID from executorRoles.js — no ping if not mapped
        const roleId  = getRoleId(exploit.title);
        const mention = roleId ? `<@&${roleId}>` : null;

        const changes = {
            version:      versionChanged,
            rbxversion:   rbxVersionChanged,
            detected:     detectedChanged     ? exploit.detected     : undefined,
            updateStatus: updateStatusChanged ? exploit.updateStatus : undefined,
        };

        await sendWebhook({
            content:          mention,
            allowed_mentions: allowedMentions(roleId),
            embeds: [buildExecutorEmbed(exploit, changes)],
        });

        lastExecutorState[key] = {
            version:      exploit.version,
            rbxversion:   exploit.rbxversion,
            updateStatus: exploit.updateStatus,
            detected:     exploit.detected,
        };

        console.log(`[Executors] Sent: ${exploit.title} | roleId: ${roleId || "none"}`);
    }
}

// ─── Main Loop ────────────────────────────────────────────────────────────────

async function runChecks() {
    try { await checkRobloxVersions(); }
    catch (err) { console.error("[Roblox] Error:", err.response?.data || err.message); }

    try { await checkExecutors(); }
    catch (err) { console.error("[Executors] Error:", err.response?.data || err.message); }

    if (!initialized) {
        initialized = true;
        console.log(`[Init] Ready. Polling every ${CHECK_INTERVAL_MS / 1000}s.`);
        console.log(WATCH_EXECUTORS.length > 0
            ? `[Init] Watching: ${WATCH_EXECUTORS.join(", ")}`
            : "[Init] Watching all executors.");
    }
}

runChecks();
setInterval(runChecks, CHECK_INTERVAL_MS);

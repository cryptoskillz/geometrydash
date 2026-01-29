
// --- ITEM LOGIC ---

function drawItems() {
    const currentCoord = `${player.roomX},${player.roomY}`;

    groundItems.forEach(item => {
        // Only draw if in the same room
        if (`${item.roomX},${item.roomY}` !== currentCoord) return;

        ctx.save();
        ctx.translate(item.x, item.y + (Math.sin((Date.now() / 200) + (item.floatOffset || 0)) * 5)); // Float effect

        // Draw Glow
        ctx.shadowBlur = 15;
        ctx.shadowColor = item.data.rarity === 'legendary' ? 'gold' :
            (item.data.rarity === 'uncommon' ? '#3498db' : 'white');

        // Draw Icon (Circle for now, maybe use rarity color)
        ctx.fillStyle = ctx.shadowColor;
        ctx.beginPath();
        ctx.arc(0, 0, 15, 0, Math.PI * 2);
        ctx.fill();

        // Draw Text
        ctx.fillStyle = "white";
        ctx.font = "10px monospace";
        ctx.textAlign = "center";

        // Clean name (remove 'gun_' prefix for display)
        let name = item.data.name || "Item";
        if (name.startsWith("gun_")) name = name.replace("gun_", "");
        if (name.startsWith("bomb_")) name = name.replace("bomb_", "");

        ctx.fillText(name.toUpperCase(), 0, -25);

        // Interact Prompt
        const dist = Math.hypot(player.x - item.x, player.y - item.y);
        if (dist < 40) {
            ctx.fillStyle = "#f1c40f"; // Gold
            ctx.font = "bold 12px monospace";
            ctx.fillText("SPACE", 0, 30);
        }

        ctx.restore();
    });
}

function updateItems() {
    const currentCoord = `${player.roomX},${player.roomY}`;

    // Check for pickup
    // Iterate reverse to safe splice
    for (let i = groundItems.length - 1; i >= 0; i--) {
        const item = groundItems[i];
        if (`${item.roomX},${item.roomY}` !== currentCoord) continue;

        const dist = Math.hypot(player.x - item.x, player.y - item.y);
        if (dist < 40) {
            if (keys['Space']) {
                keys['Space'] = false; // Consume input
                pickupItem(item, i);
            }
        }
    }
}

async function pickupItem(item, index) {
    const type = item.data.type; // gun or bomb
    const location = item.data.location; // e.g. weapons/guns/peashooter.json

    log(`Picking up ${item.data.name}...`);

    try {
        const res = await fetch(`json/${location}?t=${Date.now()}`);
        const config = await res.json();

        if (type === 'gun') {
            player.gunType = config.name; // Logic uses this? or just config?
            // Actually player.gunType is a string ID.
            // But we can just overwrite the 'gun' object?
            // logic.js uses `gun` global object for current stats (Line 58: let gun = {})
            // AND `player.gunType` for loading save state?

            // Overwrite global gun config
            gun = config;
            player.gunType = item.data.name.replace("gun_", ""); // Hacky? item name might strict match file? 
            // Better: update player.gunType to match file basename if possible?
            // Actually, item.data.location is "weapons/guns/geometry.json".
            // Basename is "geometry".
            if (location.includes("/")) {
                const parts = location.split('/');
                const filename = parts[parts.length - 1].replace(".json", "");
                player.gunType = filename;
            }

            log(`Equipped Gun: ${config.name}`);
        }
        else if (type === 'bomb') {
            bomb = config;
            // Similarly update bombType
            if (location.includes("/")) {
                const parts = location.split('/');
                const filename = parts[parts.length - 1].replace(".json", "");
                player.bombType = filename;
            }
            log(`Equipped Bomb: ${config.name}`);
        }

        // Remove from floor 
        // (Optional: Drop CURRENT item? For now, just destroy old)
        groundItems.splice(index, 1);
        SFX.click(0.5); // Pickup sound

    } catch (e) {
        console.error("Failed to load weapon config", e);
        log("Error equipping item");
    }
}

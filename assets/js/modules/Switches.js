import { Globals } from './Globals.js';
import { log, spawnFloatingText } from './Utils.js';
import { SFX } from './Audio.js';

export function spawnSwitches(roomData) {
    Globals.switches = [];
    if (!roomData.switches) return;

    const config = roomData.switches;

    // Handle single or array (future proofing)
    const list = Array.isArray(config) ? config : [config];

    list.forEach(cfg => {
        if (!cfg.x || !cfg.y) return; // Skip if no validation
        Globals.switches.push({
            x: cfg.x,
            y: cfg.y,
            size: cfg.size || 40,
            action: cfg.action || 'none',
            rerollCost: (cfg.rerollCost !== undefined) ? cfg.rerollCost : (cfg.defaultCost || 0),
            state: 'idle', // idle, active
            cooldown: 0
        });
    });
}

export function updateSwitches() {
    Globals.switches.forEach(s => {
        if (s.cooldown > 0) s.cooldown--;

        // Collision with Player
        const p = Globals.player;
        if (!p) return;

        const dist = Math.hypot(p.x - s.x, p.y - s.y);

        // Activation Distance (Step on)
        if (dist < s.size && s.state === 'idle' && s.cooldown <= 0) {
            activateSwitch(s);
        }

        // Reset if stepped off
        if (dist > s.size + 10 && s.state === 'active') {
            s.state = 'idle';
        }
    });
}

function activateSwitch(s) {
    // Check Cost
    if (s.rerollCost > 0) {
        const cost = s.rerollCost;
        const currentShards = Globals.player.inventory.greenShards || 0;
        if (currentShards < cost) {
            spawnFloatingText(s.x, s.y, cost + " Shards required!", "#e74c3c"); // Red
            s.cooldown = 60;
            SFX.cantDoIt()
            return;
        }

        Globals.player.inventory.greenShards -= cost;
        spawnFloatingText(s.x, s.y - 10, "-" + cost, "#e74c3c");
    }

    s.state = 'active';
    s.cooldown = 60; // 1 second debounce
    SFX.doorUnlocked(); // Click sound
    log("Switch Activated:", s.action);

    if (s.action === 'shop') {
        try {
            rerollShop(s);
        } catch (e) {
            console.error("Reroll failed", e);
        }
    }
}

function rerollShop(s) {
    // Reroll Logic
    // 1. Find all chests
    // 2. Assign new random item
    // 3. Reset state logic

    const allItems = window.allItemTemplates || [];
    // Filter for valid spawnable items only

    // User requested active check for shop items
    const pool = allItems.filter(i =>
        i && i.location &&
        i.spawnable !== false &&
        i.type !== 'unlock' &&
        i.rarity !== 'special' &&
        (!i.purchasable || i.purchasable.active !== false)
    );
    if (pool.length === 0) {
        spawnFloatingText(s.x, s.y, "No Items!", "red");
        return;
    }

    let rerolledCount = 0;
    Globals.chests.forEach(chest => {
        // Validation
        if (!chest || !chest.config || typeof chest.config !== 'object') return;

        // Decide what chests to reroll. All of them?
        // Only "Shop" chests usually. 
        // But we don't have a "shop type" on chest.
        // Assuming all chests in a "Shop Room" are shop items.

        // Pick random item
        const item = pool[Math.floor(Math.random() * pool.length)];

        if (item && item.location) {
            // Update Chest Config
            // We need to support 'contains' as an array
            chest.config.contains = [item.location];

            // Name Update (Optional, will be resolved on Interaction/Draw ideally, but we have helper in Chests.js)
            if (item.name) chest.config.name = item.name;

            // Reset State
            chest.state = 'closed';

            // Update Cost and Lock
            if (item.purchasable && item.purchasable.active) {
                // Determine Unlock Type based on purchaseType
                // Chests.js expects 'greenshards', 'redshards', or 'key'
                let uType = item.purchasable.purchaseType || 'greenshards';
                // Normalize if needed, but Chests.js handles 'green' includes

                chest.locked = true;
                chest.config.locked = {
                    unlockType: uType,
                    cost: item.purchasable.cost || 0
                };

                // Cleanup old simple cost if any
                delete chest.config.cost;
                delete chest.config.purchaseType;
            } else {
                // Free item?
                chest.locked = false;
                delete chest.config.locked;
                delete chest.config.cost;
            }

            rerolledCount++;
            spawnFloatingText(chest.x, chest.y - 20, "Restocked!", "#2ecc71");
        }
    });

    if (rerolledCount > 0) {
        spawnFloatingText(s.x, s.y - 20, "SHOP REROLLED", "#f1c40f");
    } else {
        spawnFloatingText(s.x, s.y - 20, "Nothing to reroll", "#95a5a6");
    }
}

export function drawSwitches() {
    const ctx = Globals.ctx;
    ctx.save();
    Globals.switches.forEach(s => {
        const x = s.x;
        const y = s.y;
        const size = s.size;

        // Base
        ctx.fillStyle = '#333';
        ctx.fillRect(x - size / 2, y - size / 2, size, size);

        // Button
        const offset = s.state === 'active' ? 2 : 5;
        const btnColor = s.state === 'active' ? '#27ae60' : '#c0392b'; // Green/Red

        ctx.fillStyle = btnColor;
        ctx.fillRect(x - size / 2 + 2, y - size / 2 + 2, size - 4, size - 4);

        // Highlight
        ctx.fillStyle = 'rgba(255,255,255,0.2)';
        ctx.fillRect(x - size / 2 + 2, y - size / 2 + 2, size - 4, (size - 4) / 2);

        // Label
        ctx.font = "8px 'Press Start 2P'";
        ctx.fillStyle = "white";
        ctx.textAlign = "center";

        let label = s.action === 'shop' ? "REROLL" : "SWITCH";
        if (s.rerollCost > 0) label += ` (${s.rerollCost})`;
        ctx.fillText(label, x, y + size / 2 + 15);
    });
    ctx.restore();
}

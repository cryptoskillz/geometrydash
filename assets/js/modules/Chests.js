import { Globals } from './Globals.js';
import { log, spawnFloatingText } from './Utils.js';
import { SFX } from './Audio.js';
import { JSON_PATHS, STATES, TILE_SIZE, BOUNDARY } from './Constants.js';

export function spawnChests(roomData) {
    Globals.chests = [];
    if (!roomData.chests) return;
    log("Checking Chests for Room:", roomData.name, roomData.chests);

    const chestKeys = Object.keys(roomData.chests);
    chestKeys.forEach(key => {
        if (key === 'manifest' || key === 'manfest') return;

        const config = roomData.chests[key];

        // Check Instant Spawn
        let shouldSpawnNow = false;
        let shouldSpawnLater = false;

        // Instant Spawn Logic
        if (config.instantSpawn === true) {
            shouldSpawnNow = true;
        } else if (typeof config.instantSpawn === 'object') {
            if (config.instantSpawn.active !== false) {
                if (config.instantSpawn.active === true) shouldSpawnNow = true;
                // Add chance check
                if (shouldSpawnNow && config.instantSpawn.spawnChance !== undefined) {
                    if (Math.random() > config.instantSpawn.spawnChance) shouldSpawnNow = false;
                }
            }
        } else if (config.instantSpawn === undefined) {
            if (!config.spawnsOnClear && !config.spawnsOnClear) shouldSpawnNow = true;
        }

        // Spawn On Clear Logic
        const clearConfig = config.spawnsOnClear || config.spawnsOnClear;
        if (clearConfig) {
            let active = clearConfig === true;
            if (typeof clearConfig === 'object' && clearConfig.active !== false) {
                active = true;
                if (clearConfig.active === true) active = true;
                else active = false;
            }
            if (active) shouldSpawnLater = true;
        }

        if (!shouldSpawnNow && !shouldSpawnLater) return;

        const chest = {
            id: key,
            x: config.x,
            y: config.y,
            width: 40,
            height: 40,
            config: config,
            state: shouldSpawnNow ? 'closed' : 'hidden',
            locked: config.locked === true || (typeof config.locked === 'object' && config.locked.active),
            solid: config.solid || false,
            moveable: config.moveable || false,
            hp: 1,
            manifest: config.manfest || config.manifest || roomData.chests.manifest || roomData.chests.manfest
        };

        Globals.chests.push(chest);
    });
}

// Flag to ensure listener is added only once
let chestListenerAdded = false;

export function updateChests() {
    if (!chestListenerAdded) {
        window.addEventListener('keydown', (e) => {
            if (e.code === 'Space' || e.code === 'Enter' || e.code === 'KeyE') {
                // Interact logic here
                // Check Game State
                if (Globals.gameState !== STATES.PLAY && Globals.gameState !== 1) return; // 1 is often State.PLAY

                Globals.chests.forEach(chest => {
                    if (chest.state !== 'closed') return;

                    const player = Globals.player;
                    if (!player) return;

                    const cx = chest.x + chest.width / 2;
                    const cy = chest.y + chest.height / 2;
                    const dist = Math.hypot(player.x - cx, player.y - cy);

                    // Allow wider range for key interaction (120px)
                    if (dist < 120) {
                        console.log("Direct Key Interaction! Chest:", chest.id, "Locked:", chest.locked, "Dist:", dist);

                        // Unified Lock Logic
                        if (chest.locked) {
                            const lockConfig = (typeof chest.config.locked === 'object') ? chest.config.locked : { unlockType: 'key', cost: 1 };
                            let type = (lockConfig.unlockType || 'key').toLowerCase();
                            if (type.includes('red')) type = 'redshard';
                            if (type.includes('green') || type.includes('geen')) type = 'greenshard'; // handle typo

                            const cost = parseInt(lockConfig.cost || 1);

                            // Check Inventory based on Type
                            let canOpen = false;
                            let msg = "";
                            let color = "#fff";

                            if (type === 'key') {
                                if (player.inventory.keys >= cost) {
                                    player.inventory.keys -= cost;
                                    canOpen = true;
                                    msg = "Unlocked!";
                                    color = "#f1c40f";
                                } else {
                                    msg = "Locked (Need Key)";
                                    color = "#e74c3c";
                                }
                            } else if (type === 'redshard') {
                                const current = player.inventory.redShards || 0;
                                if (current >= cost) {
                                    player.inventory.redShards -= cost;
                                    localStorage.setItem('currency_red', player.inventory.redShards);
                                    canOpen = true;
                                    msg = `-${cost} Red`;
                                    color = "#e74c3c";
                                } else {
                                    msg = `Need ${cost} Red Shards`;
                                    color = "#e74c3c";
                                }
                            } else if (type === 'greenshard') {
                                const current = player.inventory.greenShards || 0;
                                if (current >= cost) {
                                    player.inventory.greenShards -= cost;
                                    canOpen = true;
                                    msg = `-${cost} Green`;
                                    color = "#2ecc71";
                                } else {
                                    msg = `Need ${cost} Green Shards`;
                                    color = "#2ecc71";
                                }
                            } else {
                                // Fallback for unknown types
                                canOpen = true;
                            }

                            if (canOpen) {
                                SFX.doorUnlocked();
                                if (msg) spawnFloatingText(chest.x, chest.y - 20, msg, color);
                                openChest(chest);
                            } else {
                                SFX.cantDoIt();
                                if (msg) spawnFloatingText(chest.x, chest.y - 20, msg, color);
                            }
                        } else {
                            // Unlocked - Manual Open
                            console.log("Chest unlocked. Opening...");
                            openChest(chest);
                        }
                    }
                });
            }
        });
        chestListenerAdded = true;
        console.log("Chest Interaction Listener Added.");
    }

    // Check Room Clear to reveal hidden chests
    const roomCleared = Globals.enemies.length === 0;

    Globals.chests.forEach(chest => {
        if (chest.state === 'hidden') {
            if (roomCleared) {
                // Check spawnChance for late spawn
                const clearConfig = chest.config.spawnsOnClear || chest.config.spawnsOnClear;
                if (clearConfig && typeof clearConfig === 'object') {
                    if (Math.random() > (clearConfig.spawnChance || 1)) {
                        chest.state = 'despawned';
                        return;
                    }
                }
                chest.state = 'closed';
                SFX.doorUnlocked();
                spawnFloatingText(chest.x, chest.y - 20, "Appeared!", "#f1c40f");
            }
            return;
        }

        if (chest.state === 'despawned') return;

        if (chest.state === 'open') {
            if (chest.solid) {
                if (Globals.player && checkCollision(Globals.player, chest)) {
                    resolveCollision(Globals.player, chest);
                }
            }
            return;
        }

        // Logic for Closed Chests
        if (Globals.player) {
            const player = Globals.player;

            // 1. Physics Collision (Solid pushback only)
            if (checkCollision(player, chest)) {
                if (chest.locked || chest.solid) {
                    resolveCollision(player, chest);
                } else {
                    // Non-solid, non-locked -> Auto Open on bump (Legacy/Fallback)
                    openChest(chest);
                }
            }
            // Interaction handled by Listener
        }
    });

    // Resolving Chest-Chest Overlaps (Simple Iterative Solver)
    // Run this AFTER player moves chests
    const iterations = 2;
    for (let it = 0; it < iterations; it++) {
        for (let i = 0; i < Globals.chests.length; i++) {
            const A = Globals.chests[i];
            if (A.state !== 'closed') continue;

            for (let j = i + 1; j < Globals.chests.length; j++) {
                const B = Globals.chests[j];
                if (B.state !== 'closed') continue;

                if (checkCollision(A, B)) {
                    resolveChestCollision(A, B);
                }
            }
        }
    }

    // Check Bullet Collisions
    Globals.bullets.forEach(bullet => {
        Globals.chests.forEach(chest => {

            // 1. Check Collision First
            if (!checkCollision(bullet, chest)) return;

            // 2. Try to Open (if Closed, Unlocked, Shootable)
            if (chest.state === 'closed' && !chest.locked && chest.config.canShoot !== false) {
                openChest(chest);
                bullet.markedForDeletion = true;
                return;
            }
            else {
                if (chest.state === 'closed')
                    SFX.cantDoIt();
            }

            // 3. Block Bullet (If Solid)
            // Even if open or locked, a solid chest should stop bullets
            if (chest.solid) {
                bullet.markedForDeletion = true;
                // Optional: SFX.hitWall()
            }
        });
    });

    // Check Bomb Collisions
    Globals.bombs.forEach(bomb => {
        if (bomb.exploding) {
            Globals.chests.forEach(chest => {
                if (chest.state !== 'closed') return;
                if (chest.locked) return;
                if (chest.config.canBomb === false) return;
                if (chest.config.canBomb && typeof chest.config.canBomb === 'object' && chest.config.canBomb.active === false && !chest.config.locked) return;

                const dx = bomb.x - chest.x;
                const dy = bomb.y - chest.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist < 100) {
                    openChest(chest);
                }
            });
        }
    });
}

function checkCollision(a, b) {
    let aLeft, aRight, aTop, aBottom;
    if (a.size && !a.width) {
        aLeft = a.x - a.size;
        aRight = a.x + a.size;
        aTop = a.y - a.size;
        aBottom = a.y + a.size;
    } else {
        aLeft = a.x;
        aRight = a.x + (a.width || 30);
        aTop = a.y;
        aBottom = a.y + (a.height || 30);
    }

    const bLeft = b.x;
    const bRight = b.x + b.width;
    const bTop = b.y;
    const bBottom = b.y + b.height;

    return aLeft < bRight && aRight > bLeft && aTop < bBottom && aBottom > bTop;
}

function resolveCollision(player, chest) {
    const padding = 25;
    const chestW = chest.width + padding * 2;
    const chestH = chest.height + padding * 2;
    const chestX = chest.x - padding;
    const chestY = chest.y - padding;

    const pW = player.width || player.size || 30;
    const pH = player.height || player.size || 30;

    const playerCX = player.x + pW / 2;
    const playerCY = player.y + pH / 2;
    const chestCX = chestX + chestW / 2;
    const chestCY = chestY + chestH / 2;

    const dx = playerCX - chestCX;
    const dy = playerCY - chestCY;

    const combinedHalfW = pW / 2 + chestW / 2;
    const combinedHalfH = pH / 2 + chestH / 2;

    const overlapX = combinedHalfW - Math.abs(dx);
    const overlapY = combinedHalfH - Math.abs(dy);

    if (overlapX > 0 && overlapY > 0) {
        // Moveable Chest Logic
        if (chest.moveable && !chest.locked) {
            const oldX = chest.x;
            const oldY = chest.y;

            if (overlapX < overlapY) {
                if (dx > 0) chest.x -= overlapX;
                else chest.x += overlapX;
            } else {
                if (dy > 0) chest.y -= overlapY;
                else chest.y += overlapY;
            }

            // Check Bounds
            if (chest.x < BOUNDARY) chest.x = BOUNDARY;
            if (chest.x > Globals.canvas.width - BOUNDARY - chest.width) chest.x = Globals.canvas.width - BOUNDARY - chest.width;
            if (chest.y < BOUNDARY) chest.y = BOUNDARY;
            if (chest.y > Globals.canvas.height - BOUNDARY - chest.height) chest.y = Globals.canvas.height - BOUNDARY - chest.height;

            // If chest moved, we are done. If it didn't (stuck), push player back.
            if (Math.abs(chest.x - oldX) > 0.1 || Math.abs(chest.y - oldY) > 0.1) {
                return;
            }
        }

        // Static or Stuck Logic (Push Player)
        if (overlapX < overlapY) {
            if (dx > 0) player.x += overlapX;
            else player.x -= overlapX;
        } else {
            if (dy > 0) player.y += overlapY;
            else player.y -= overlapY;
        }
    }
}

function resolveChestCollision(a, b) {
    const aCX = a.x + a.width / 2;
    const aCY = a.y + a.height / 2;
    const bCX = b.x + b.width / 2;
    const bCY = b.y + b.height / 2;

    const dx = aCX - bCX;
    const dy = aCY - bCY;

    const combinedHalfW = a.width / 2 + b.width / 2;
    const combinedHalfH = a.height / 2 + b.height / 2;

    const overlapX = combinedHalfW - Math.abs(dx);
    const overlapY = combinedHalfH - Math.abs(dy);

    if (overlapX > 0 && overlapY > 0) {
        // Assume both moveable or one moveable.
        // If both moveable, split overlap.
        // If one moveable, push it full overlap.

        let moveA = a.moveable && !a.locked;
        let moveB = b.moveable && !b.locked;

        // If neither moveable (shouldn't happen if collided by push), force push apart anyway?
        if (!moveA && !moveB) return;

        if (moveA && moveB) {
            // Split
            const halfX = overlapX / 2;
            const halfY = overlapY / 2;

            if (overlapX < overlapY) {
                if (dx > 0) { a.x += halfX; b.x -= halfX; }
                else { a.x -= halfX; b.x += halfX; }
            } else {
                if (dy > 0) { a.y += halfY; b.y -= halfY; }
                else { a.y -= halfY; b.y += halfY; }
            }
        } else if (moveA) {
            // Push A
            if (overlapX < overlapY) {
                if (dx > 0) a.x += overlapX;
                else a.x -= overlapX;
            } else {
                if (dy > 0) a.y += overlapY;
                else a.y -= overlapY;
            }
        } else if (moveB) {
            // Push B
            if (overlapX < overlapY) {
                if (dx > 0) b.x -= overlapX; // dx is A-B. If dx>0 (A right of B), push B Left. Correct?
                // If A Right of B, dx>0. A-B > 0.
                // Push B Left means b.x decreasing.
                // Previous logic: if dx>0 (A right), push B Left. YES.
                else b.x += overlapX;
            } else {
                if (dy > 0) b.y -= overlapY;
                else b.y += overlapY;
            }
        }
        // Need to clamp bounds here too?
        // Since we modify x/y directly, we should clamp if possible.
        // Or assume loop handles it iteratively?
        // Clamp for safety.
        if (moveA) clamp(a);
        if (moveB) clamp(b);
    }
}

function clamp(chest) {
    if (chest.x < BOUNDARY) chest.x = BOUNDARY;
    if (chest.x > Globals.canvas.width - BOUNDARY - chest.width) chest.x = Globals.canvas.width - BOUNDARY - chest.width;
    if (chest.y < BOUNDARY) chest.y = BOUNDARY;
    if (chest.y > Globals.canvas.height - BOUNDARY - chest.height) chest.y = Globals.canvas.height - BOUNDARY - chest.height;
}

async function openChest(chest) {
    console.log("Opening Chest:", chest.id);
    if (chest.state === 'open') return;

    // Set Open State
    chest.state = 'open';
    SFX.doorUnlocked();

    // Spawn Items
    if (!chest.manifest) {
        log("Chest has no manifest!");
        return;
    }

    // Load Manifest
    let manifestData = null;
    const url = chest.manifest.startsWith('/') ? JSON_PATHS.ROOT + chest.manifest.substring(1) : JSON_PATHS.ROOT + chest.manifest;

    try {
        const res = await fetch(url);
        manifestData = await res.json();
    } catch (e) {
        console.error("Failed to load chest manifest", e);
        return;
    }

    // Determine Base Path from Manifest Location
    let basePath = chest.manifest;
    if (basePath.startsWith('/')) basePath = basePath.substring(1);
    const lastSlash = basePath.lastIndexOf('/');
    if (lastSlash !== -1) {
        basePath = basePath.substring(0, lastSlash + 1);
    } else {
        basePath = '';
    }

    const items = manifestData.items || manifestData.unlocks;
    if (!manifestData || !items) return;

    // Filter Items
    const contains = chest.config.contains || [];
    const pool = [];

    items.forEach(itemPath => {
        const match = contains.some(pattern => {
            const regexStr = pattern.replace(/\*/g, '.*');
            const regex = new RegExp(`^${regexStr}`);
            return regex.test(itemPath);
        });

        if (match) pool.push(itemPath);
    });

    if (pool.length === 0) {
        log("Chest found no matching items.");
        return;
    }

    pool.forEach(itemToSpawn => {
        spawnItem(itemToSpawn, chest.x, chest.y, basePath);
    });
}

async function spawnItem(path, x, y, basePath = 'rewards/items/') {
    // Load item template
    let fullPath = path;
    if (!path.startsWith('/') && !path.startsWith('rewards/') && !path.startsWith('json/')) {
        fullPath = basePath + path;
    }

    try {
        const res = await fetch(`${JSON_PATHS.ROOT}${fullPath}.json?t=${Date.now()}`);
        const itemData = await res.json();
        if (itemData.spawnable === false) return;

        Globals.groundItems.push({
            x: x + 10 + (Math.random() - 0.5) * 20,
            y: y + 10 + (Math.random() - 0.5) * 20,
            data: itemData,
            roomX: Globals.roomData.x || 0,
            roomY: Globals.roomData.y || 0,
            vx: (Math.random() - 0.5) * 5,
            vy: (Math.random() - 0.5) * 5,
            solid: true, moveable: true, friction: 0.9, size: 15,
            floatOffset: 0
        });
        log("Spawned item from chest:", path);

    } catch (e) {
        console.error("Failed to spawn chest item:", path, e);
    }
}

export function drawChests() {
    Globals.chests.forEach(chest => {
        const ctx = Globals.ctx;

        const x = chest.x;
        const y = chest.y;
        const w = chest.width;
        const h = chest.height;
        const baseColor = chest.config.color || '#8e44ad';

        // Shadow/Base
        ctx.fillStyle = '#2c3e50';
        ctx.fillRect(x + 2, y + h - 5, w - 4, 5);

        if (chest.state === 'closed') {
            // Main Box
            ctx.fillStyle = baseColor;
            ctx.fillRect(x, y + 10, w, h - 10);

            // Lid
            ctx.fillStyle = adjustColor(baseColor, 20);
            ctx.fillRect(x, y, w, 10);

            // Trim
            ctx.fillStyle = '#34495e';
            ctx.fillRect(x + 5, y + 10, 5, h - 10);
            ctx.fillRect(x + w - 10, y + 10, 5, h - 10);

            // Lock
            if (chest.locked) {

                ctx.fillStyle = '#f1c40f';
                ctx.fillRect(x + w / 2 - 5, y + 5, 10, 10);
                ctx.fillStyle = '#000';
                ctx.fillRect(x + w / 2 - 2, y + 8, 4, 4);
            } else {
                ctx.fillStyle = '#bdc3c7';
                ctx.fillRect(x + w / 2 - 4, y + 5, 8, 8);
            }
        } else {
            // Open State
            ctx.fillStyle = '#2c3e50';
            ctx.fillRect(x, y + 10, w, h - 10);
            ctx.fillStyle = baseColor;
            ctx.fillRect(x, y + 15, w, h - 15);
            ctx.fillStyle = adjustColor(baseColor, 20);
            ctx.fillRect(x, y - 10, w, 10);
            ctx.fillStyle = '#34495e';
            ctx.fillRect(x + 5, y + 15, 5, h - 15);
            ctx.fillRect(x + w - 10, y + 15, 5, h - 15);
        }

        // --- DRAW NAME ABOVE ---
        const name = chest.config.name || chest.id || "Chest";

        ctx.save();
        ctx.font = "12px 'Press Start 2P', monospace";
        ctx.textAlign = "center";

        ctx.fillStyle = "black";
        ctx.fillText(name, x + w / 2 + 1, y - 8 + 1);
        ctx.fillStyle = "white";
        ctx.fillText(name, x + w / 2, y - 8);

        // INTERACTION PROMPT
        if (chest.state === 'closed') {
            const dist = Math.hypot(Globals.player.x - (x + w / 2), Globals.player.y - (y + h / 2));

            // Show Lock Cost
            if (chest.locked) {
                const lockConfig = (typeof chest.config.locked === 'object') ? chest.config.locked : { unlockType: 'key', cost: 1 };
                let type = (lockConfig.unlockType || 'key').toLowerCase();
                if (type.includes('red')) type = 'red';
                else if (type.includes('green') || type.includes('geen')) type = 'green'; // handle typo

                const cost = parseInt(lockConfig.cost || 1);

                let label = "";
                let color = "#fff";

                if (type === 'key') {
                    label = (cost > 1) ? `${cost} KEYS` : "LOCKED (KEY)";
                    color = "#f1c40f";
                } else {
                    label = `${cost} ${type.toUpperCase()}`;
                    color = (type === 'red') ? '#e74c3c' : '#2ecc71';
                }

                ctx.font = "10px 'Press Start 2P', monospace";
                ctx.fillStyle = "#000";
                ctx.fillText(label, x + w / 2 + 2, y - 38); // Shadow
                ctx.fillStyle = color;
                ctx.fillText(label, x + w / 2, y - 40);
            }

            if (dist < 120) {
                ctx.font = "10px 'Press Start 2P', monospace";
                ctx.fillStyle = "#f1c40f";
                ctx.fillText("SPACE", x + w / 2, y - 22);
            }
        }

        ctx.restore();
    });
}

function adjustColor(color, amount) {
    return color;
}

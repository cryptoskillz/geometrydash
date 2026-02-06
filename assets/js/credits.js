// Simple Credits Screen (End Game)
// Displays "CONGRATULATIONS" and waits for input to return to title.

window.showCredits = function () {
    console.log("Credits: Simple Mode Active");
    if (window.setGameState && window.gameStates) {
        window.setGameState(window.gameStates.CREDITS);
    }

    // Hide UI
    if (window.uiEl) window.uiEl.style.display = 'none';
    if (window.statsEl) window.statsEl.style.display = 'none';
};

window.updateCredits = function () {
    const k = window.gameKeys || {};
    // On any main key, go back to welcome
    if (k['Enter'] || k['Escape'] || k['Space'] || k['KeyZ'] || k['KeyX']) {
        if (window.goToWelcome) window.goToWelcome();
    }
};

window.drawCredits = function () {
    const ctx = window.gameCtx;
    const cvs = window.gameCanvas;

    if (!ctx || !cvs) return;

    // Clear Background
    ctx.fillStyle = "black";
    ctx.fillRect(0, 0, cvs.width, cvs.height);

    const cx = cvs.width / 2;
    const cy = cvs.height / 2;

    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    // Main Text
    ctx.font = "900 40px 'Orbitron', sans-serif";
    ctx.fillStyle = "#00ff00"; // Hacker Green
    ctx.shadowColor = "#00ff00";
    ctx.shadowBlur = 10;
    ctx.fillText("CONGRATULATIONS", cx, cy - 30);

    // Sub Text
    ctx.font = "bold 20px 'Orbitron', sans-serif";
    ctx.fillStyle = "white";
    ctx.shadowBlur = 0;
    ctx.fillText("PRESS ANY KEY TO CONTINUE", cx, cy + 30);
};

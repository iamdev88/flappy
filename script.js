// script.js

// 1. SKIN DEFINITIONS
const SKINS = {
    default: { id: 'default', name: 'Classic Yellow', price: 0, filter: 'none' },
    aqua: { id: 'aqua', name: 'Blue Splash', price: 50, filter: 'hue-rotate(180deg)' },
    emerald: { id: 'emerald', name: 'Emerald Green', price: 100, filter: 'hue-rotate(90deg)' },
    purple: { id: 'purple', name: 'Royal Purple', price: 150, filter: 'hue-rotate(240deg)' },
    crimson: { id: 'crimson', name: 'Crimson Fire', price: 200, filter: 'hue-rotate(300deg)' },
    gold: { id: 'gold', name: 'Shiny Gold', price: 350, filter: 'hue-rotate(20deg) brightness(1.3) contrast(1.5) saturate(2)' }
};

// 2. STORAGE MANAGER FOR DATA PERSISTENCE
class StorageManager {
    static getHighScore() {
        return parseInt(localStorage.getItem('flappy_high_score')) || 0;
    }
    static setHighScore(val) {
        localStorage.setItem('flappy_high_score', val);
    }
    static getCoins() {
        const c = localStorage.getItem('flappy_coins');
        return c === null ? 100 : parseInt(c); // Start with 100 coins
    }
    static setCoins(val) {
        localStorage.setItem('flappy_coins', val);
    }
    static getOwnedSkins() {
        const s = localStorage.getItem('flappy_owned_skins');
        return s ? JSON.parse(s) : ['default'];
    }
    static setOwnedSkins(arr) {
        localStorage.setItem('flappy_owned_skins', JSON.stringify(arr));
    }
    static getActiveSkin() {
        return localStorage.getItem('flappy_active_skin') || 'default';
    }
    static setActiveSkin(val) {
        localStorage.setItem('flappy_active_skin', val);
    }
    static getMusicEnabled() {
        const val = localStorage.getItem('flappy_music_enabled');
        return val === null ? true : val === 'true';
    }
    static setMusicEnabled(val) {
        localStorage.setItem('flappy_music_enabled', val);
    }
    static getSoundEnabled() {
        const val = localStorage.getItem('flappy_sound_enabled');
        return val === null ? true : val === 'true';
    }
    static setSoundEnabled(val) {
        localStorage.setItem('flappy_sound_enabled', val);
    }
}

// 3. AUDIO CONTROLLER (Web Audio API Synthesizer)
class AudioController {
    constructor() {
        this.ctx = null;
        this.musicEnabled = StorageManager.getMusicEnabled();
        this.soundEnabled = StorageManager.getSoundEnabled();
        this.musicInterval = null;
        
        // Pentatonic Scale: C4, D4, E4, G4, A4, C5
        this.notes = [261.63, 293.66, 329.63, 392.00, 440.00, 523.25];
        this.melody = [
            0, 2, 4, 3, 5, 4, 2, 1,
            0, 2, 3, 4, 3, 2, 1, 0,
            2, 4, 5, 4, 3, 2, 1, 2,
            3, 4, 3, 2, 1, 0, 1, 2
        ];
    }

    init() {
        if (this.ctx) return;
        this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        this.startMusic();
    }

    setMusic(enabled) {
        this.musicEnabled = enabled;
        StorageManager.setMusicEnabled(enabled);
        if (enabled) {
            this.startMusic();
        } else {
            this.stopMusic();
        }
    }

    setSound(enabled) {
        this.soundEnabled = enabled;
        StorageManager.setSoundEnabled(enabled);
    }

    playFlap() {
        if (!this.soundEnabled || !this.ctx) return;
        this.playTone(180, 450, 0.12, 'triangle', 0.12);
    }

    playScore() {
        if (!this.soundEnabled || !this.ctx) return;
        // Two tone chime
        this.playTone(987.77, 1318.51, 0.08, 'sine', 0.08); 
    }

    playHit() {
        if (!this.soundEnabled || !this.ctx) return;
        this.playTone(180, 40, 0.4, 'sawtooth', 0.15);
    }

    playTone(startFreq, endFreq, duration, type = 'sine', volume = 0.1) {
        try {
            if (this.ctx.state === 'suspended') {
                this.ctx.resume();
            }
            const osc = this.ctx.createOscillator();
            const gainNode = this.ctx.createGain();
            
            osc.type = type;
            osc.frequency.setValueAtTime(startFreq, this.ctx.currentTime);
            if (endFreq !== startFreq) {
                osc.frequency.exponentialRampToValueAtTime(endFreq, this.ctx.currentTime + duration);
            }
            
            gainNode.gain.setValueAtTime(volume, this.ctx.currentTime);
            gainNode.gain.linearRampToValueAtTime(0.001, this.ctx.currentTime + duration);
            
            osc.connect(gainNode);
            gainNode.connect(this.ctx.destination);
            
            osc.start();
            osc.stop(this.ctx.currentTime + duration);
        } catch (e) {
            console.error("Tone playback failed:", e);
        }
    }

    startMusic() {
        if (!this.musicEnabled) return;
        this.stopMusic();
        
        let beat = 0;
        this.musicInterval = setInterval(() => {
            if (!this.musicEnabled || !this.ctx) return;
            try {
                if (this.ctx.state === 'suspended') {
                    this.ctx.resume();
                }
                
                const noteVal = this.melody[beat % this.melody.length];
                const freq = this.notes[noteVal % this.notes.length];
                
                const osc = this.ctx.createOscillator();
                const gain = this.ctx.createGain();
                osc.type = 'triangle';
                osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
                
                gain.gain.setValueAtTime(0.015, this.ctx.currentTime);
                gain.gain.linearRampToValueAtTime(0.0001, this.ctx.currentTime + 0.22);
                
                osc.connect(gain);
                gain.connect(this.ctx.destination);
                osc.start();
                osc.stop(this.ctx.currentTime + 0.25);
                
                beat++;
            } catch (e) {
                console.error("Music synthesis error:", e);
            }
        }, 220); 
    }

    stopMusic() {
        if (this.musicInterval) {
            clearInterval(this.musicInterval);
            this.musicInterval = null;
        }
    }
}

// 4. GAME OBJECTS
class Bird {
    constructor(game) {
        this.game = game;
        this.x = this.game.width * 0.2;
        this.y = this.game.height / 2;
        this.velocity = 0;
        this.gravity = 0.5;
        this.jumpForce = -8;
        
        this.width = 60;
        this.height = 60;
        this.rotation = 0;
        
        // Preloaded DOM Images
        this.imgIdle = document.getElementById('img-bird-idle');
        this.imgFly1 = document.getElementById('img-bird-fly-1');
        this.imgFly2 = document.getElementById('img-bird-fly-2');
        this.imgDead = document.getElementById('img-bird-dead');
        
        this.state = 'idle'; // idle, flying, dead
        this.frameCounter = 0;
    }

    flap() {
        if (this.state !== 'dead') {
            this.velocity = this.jumpForce;
            this.state = 'flying';
            this.frameCounter = 0;
            this.game.audio.playFlap();
            this.game.particleManager.spawnParticles(this.x, this.y + this.height/2);
        }
    }

    update() {
        this.velocity += this.gravity;
        this.y += this.velocity;
        
        // Rotation based on velocity
        if (this.velocity < 0) {
            this.rotation = Math.max(-0.4, this.velocity * 0.1);
        } else {
            this.rotation = Math.min(Math.PI / 2, this.velocity * 0.05);
        }

        // Floor collision
        if (this.y + this.height/2 >= this.game.height - this.game.groundHeight) {
            this.y = this.game.height - this.game.groundHeight - this.height/2;
            if (this.state !== 'dead') {
                this.die();
            }
        }
        
        // Ceiling collision
        if (this.y - this.height/2 <= 0) {
            this.y = this.height/2;
            this.velocity = 0;
        }

        this.frameCounter++;
        if (this.state === 'flying' && this.frameCounter > 15 && this.velocity > 0) {
            this.state = 'idle';
        }
    }

    die() {
        this.state = 'dead';
        this.game.audio.playHit();
        this.game.gameOver();
    }

    draw(ctx) {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.rotation);
        
        // Apply skin-specific CSS filter tint
        const activeSkinId = StorageManager.getActiveSkin();
        const skin = SKINS[activeSkinId] || SKINS.default;
        ctx.filter = skin.filter;

        let img = this.imgIdle;
        if (this.state === 'dead') {
            img = this.imgDead;
        } else if (this.state === 'flying') {
            if (Math.floor(this.frameCounter / 5) % 2 === 0) {
                img = this.imgFly1;
            } else {
                img = this.imgFly2;
            }
        }
        
        ctx.drawImage(img, -this.width/2, -this.height/2, this.width, this.height);
        ctx.restore();
    }
}

class PipeManager {
    constructor(game) {
        this.game = game;
        this.pipes = [];
        this.pipeWidth = 70;
        this.gap = 180;
        this.speed = 3;
        this.spawnTimer = 0;
        this.spawnInterval = 100;
    }

    reset() {
        this.pipes = [];
        this.spawnTimer = 0;
    }

    update() {
        if (this.game.state !== 'playing') return;

        this.spawnTimer++;
        if (this.spawnTimer >= this.spawnInterval) {
            this.spawnTimer = 0;
            this.spawnPipe();
        }

        for (let i = this.pipes.length - 1; i >= 0; i--) {
            let p = this.pipes[i];
            p.x -= this.speed;
            
            // Check collision
            if (this.checkCollision(p)) {
                this.game.bird.die();
            }

            // Check score
            if (!p.passed && p.x + this.pipeWidth < this.game.bird.x) {
                p.passed = true;
                this.game.addScore();
            }

            // Remove offscreen
            if (p.x + this.pipeWidth < 0) {
                this.pipes.splice(i, 1);
            }
        }
    }

    spawnPipe() {
        const minHeight = 50;
        const maxHeight = this.game.height - this.game.groundHeight - minHeight - this.gap;
        const topHeight = Math.floor(Math.random() * (maxHeight - minHeight + 1) + minHeight);
        
        this.pipes.push({
            x: this.game.width,
            topHeight: topHeight,
            passed: false
        });
    }

    checkCollision(pipe) {
        const bird = this.game.bird;
        const bx = bird.x - bird.width/2 + 10;
        const by = bird.y - bird.height/2 + 10;
        const bw = bird.width - 20;
        const bh = bird.height - 20;
        
        if (bx < pipe.x + this.pipeWidth &&
            bx + bw > pipe.x &&
            by < pipe.topHeight) {
            return true;
        }
        
        if (bx < pipe.x + this.pipeWidth &&
            bx + bw > pipe.x &&
            by + bh > pipe.topHeight + this.gap) {
            return true;
        }
        
        return false;
    }

    draw(ctx) {
        ctx.fillStyle = '#73BF2E';
        ctx.strokeStyle = '#548C22';
        ctx.lineWidth = 4;
        
        for (let p of this.pipes) {
            ctx.fillRect(p.x, 0, this.pipeWidth, p.topHeight);
            ctx.strokeRect(p.x, 0, this.pipeWidth, p.topHeight);
            ctx.fillRect(p.x - 4, p.topHeight - 20, this.pipeWidth + 8, 20);
            ctx.strokeRect(p.x - 4, p.topHeight - 20, this.pipeWidth + 8, 20);
            
            const bottomY = p.topHeight + this.gap;
            const bottomHeight = this.game.height - this.game.groundHeight - bottomY;
            
            ctx.fillRect(p.x, bottomY, this.pipeWidth, bottomHeight);
            ctx.strokeRect(p.x, bottomY, this.pipeWidth, bottomHeight);
            ctx.fillRect(p.x - 4, bottomY, this.pipeWidth + 8, 20);
            ctx.strokeRect(p.x - 4, bottomY, this.pipeWidth + 8, 20);
        }
    }
}

class Environment {
    constructor(game) {
        this.game = game;
        this.bgX = 0;
        this.groundX = 0;
        this.bgSpeed = 0.5;
        this.groundSpeed = 3;
    }

    update() {
        if (this.game.state !== 'playing') return;
        
        this.bgX -= this.bgSpeed;
        if (this.bgX <= -this.game.width) {
            this.bgX += this.game.width;
        }
        
        this.groundX -= this.groundSpeed;
        if (this.groundX <= -this.game.width) {
            this.groundX += this.game.width;
        }
    }

    drawBackground(ctx) {
        ctx.fillStyle = '#71C5CF';
        ctx.fillRect(0, 0, this.game.width, this.game.height);
        
        ctx.fillStyle = '#fff';
        ctx.globalAlpha = 0.5;
        this.drawCloud(ctx, this.bgX + 100, 150, 40);
        this.drawCloud(ctx, this.bgX + this.game.width + 100, 150, 40);
        this.drawCloud(ctx, this.bgX + 300, 100, 30);
        this.drawCloud(ctx, this.bgX + this.game.width + 300, 100, 30);
        ctx.globalAlpha = 1;
    }

    drawCloud(ctx, x, y, size) {
        ctx.beginPath();
        ctx.arc(x, y, size, 0, Math.PI * 2);
        ctx.arc(x + size, y - size/2, size, 0, Math.PI * 2);
        ctx.arc(x + size*2, y, size, 0, Math.PI * 2);
        ctx.fill();
    }

    drawGround(ctx) {
        ctx.fillStyle = '#DED895';
        const gy = this.game.height - this.game.groundHeight;
        
        ctx.fillRect(this.groundX, gy, this.game.width, this.game.groundHeight);
        ctx.fillRect(this.groundX + this.game.width, gy, this.game.width, this.game.groundHeight);
        
        ctx.fillStyle = '#73BF2E';
        ctx.fillRect(this.groundX, gy, this.game.width, 15);
        ctx.fillRect(this.groundX + this.game.width, gy, this.game.width, 15);
        
        ctx.strokeStyle = '#C9C27D';
        ctx.lineWidth = 3;
        ctx.beginPath();
        for (let i = 0; i < this.game.width * 2; i += 40) {
            let x = this.groundX + i;
            ctx.moveTo(x + 20, gy + 15);
            ctx.lineTo(x, this.game.height);
        }
        ctx.stroke();
    }
}

class ParticleManager {
    constructor(game) {
        this.game = game;
        this.particles = [];
    }

    spawnParticles(x, y) {
        for (let i = 0; i < 5; i++) {
            this.particles.push({
                x: x,
                y: y,
                vx: (Math.random() - 0.5) * 4,
                vy: (Math.random() - 0.5) * 4,
                life: 1.0
            });
        }
    }

    update() {
        for (let i = this.particles.length - 1; i >= 0; i--) {
            let p = this.particles[i];
            p.x += p.vx;
            p.y += p.vy;
            p.life -= 0.05;
            if (p.life <= 0) {
                this.particles.splice(i, 1);
            }
        }
    }

    draw(ctx) {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
        for (let p of this.particles) {
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.life * 5, 0, Math.PI * 2);
            ctx.fill();
        }
    }
}

// 5. MAIN GAME LOOP AND UI COORDINATOR
class Game {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
        
        this.resize();
        window.addEventListener('resize', () => this.resize());
        
        this.groundHeight = 100;
        this.state = 'start'; // start, playing, gameover
        this.score = 0;

        // Subsystems
        this.audio = new AudioController();
        this.bird = new Bird(this);
        this.pipeManager = new PipeManager(this);
        this.environment = new Environment(this);
        this.particleManager = new ParticleManager(this);

        // Fetch UI Elements
        this.hud = document.getElementById('hud');
        this.scoreEl = document.getElementById('score');
        this.lobbyScreen = document.getElementById('lobby-screen');
        this.gameOverScreen = document.getElementById('game-over-screen');
        this.finalScoreEl = document.getElementById('final-score');
        this.bestScoreDisplay = document.getElementById('best-score-val');
        this.coinCountEl = document.getElementById('coin-count');
        this.topBar = document.getElementById('top-bar');

        // Overlay Screens
        this.shopOverlay = document.getElementById('shop-overlay');
        this.customizeOverlay = document.getElementById('customize-overlay');
        this.settingsOverlay = document.getElementById('settings-overlay');

        // Settings inputs
        this.musicToggle = document.getElementById('music-toggle');
        this.soundToggle = document.getElementById('sound-toggle');

        this.initUI();
        this.initInputs();
        this.refreshLobbyData();

        this.loop = this.loop.bind(this);
        requestAnimationFrame(this.loop);
    }

    resize() {
        const container = document.getElementById('game-container');
        this.width = container.clientWidth;
        this.height = container.clientHeight;
        this.canvas.width = this.width;
        this.canvas.height = this.height;
    }

    initUI() {
        // Set initial toggle switch states from Storage
        this.musicToggle.checked = StorageManager.getMusicEnabled();
        this.soundToggle.checked = StorageManager.getSoundEnabled();
    }

    refreshLobbyData() {
        this.coinCountEl.innerText = StorageManager.getCoins();
        this.bestScoreDisplay.innerText = StorageManager.getHighScore();
    }

    animateCoins() {
        const el = document.getElementById('coin-container');
        el.classList.remove('bounce');
        void el.offsetWidth; // Force CSS repaint
        el.classList.add('bounce');
    }

    initInputs() {
        // Lobby Navigation
        document.getElementById('start-btn').addEventListener('click', () => {
            this.audio.init();
            this.start();
        });
        
        document.getElementById('restart-btn').addEventListener('click', () => {
            this.audio.init();
            this.start();
        });

        document.getElementById('lobby-back-btn').addEventListener('click', () => {
            this.showLobby();
        });

        // Settings Buttons & Switches
        document.getElementById('settings-btn').addEventListener('click', () => {
            this.audio.init();
            this.openOverlay(this.settingsOverlay);
        });
        document.getElementById('settings-close').addEventListener('click', () => {
            this.closeOverlay(this.settingsOverlay);
        });
        this.musicToggle.addEventListener('change', (e) => {
            this.audio.setMusic(e.target.checked);
        });
        this.soundToggle.addEventListener('change', (e) => {
            this.audio.setSound(e.target.checked);
        });

        // Shop Overlay Triggers
        document.getElementById('shop-btn').addEventListener('click', () => {
            this.audio.init();
            this.renderShop();
            this.openOverlay(this.shopOverlay);
        });
        document.getElementById('shop-close').addEventListener('click', () => {
            this.closeOverlay(this.shopOverlay);
        });

        // Customize Screen Triggers
        document.getElementById('customize-btn').addEventListener('click', () => {
            this.audio.init();
            this.renderCustomizer();
            this.openOverlay(this.customizeOverlay);
        });
        document.getElementById('customize-close').addEventListener('click', () => {
            this.closeOverlay(this.customizeOverlay);
        });

        // Setup canvas tap/click jump controls
        const jumpAction = (e) => {
            if (e.type === 'keydown' && e.code !== 'Space') return;
            
            if (this.state === 'playing') {
                e.preventDefault();
                this.bird.flap();
            }
        };

        window.addEventListener('keydown', jumpAction);
        this.canvas.addEventListener('mousedown', jumpAction);
        this.canvas.addEventListener('touchstart', jumpAction, { passive: false });
    }

    openOverlay(overlay) {
        overlay.classList.remove('hidden');
        this.topBar.style.opacity = '0';
        this.topBar.style.pointerEvents = 'none';
    }

    closeOverlay(overlay) {
        overlay.classList.add('hidden');
        this.topBar.style.opacity = '1';
        this.topBar.style.pointerEvents = 'auto';
        this.refreshLobbyData();
    }

    showLobby() {
        this.state = 'start';
        this.gameOverScreen.classList.add('hidden');
        this.lobbyScreen.classList.remove('hidden');
        this.topBar.style.opacity = '1';
        this.topBar.style.pointerEvents = 'auto';
        this.refreshLobbyData();
    }

    start() {
        this.state = 'playing';
        this.score = 0;
        this.scoreEl.innerText = this.score;
        
        this.bird = new Bird(this);
        this.bird.flap(); // Launch bird with flap force
        this.pipeManager.reset();
        
        this.pipeManager.speed = 3;

        this.lobbyScreen.classList.add('hidden');
        this.gameOverScreen.classList.add('hidden');
        this.hud.classList.remove('hidden');
        this.topBar.style.opacity = '0';
        this.topBar.style.pointerEvents = 'none';
    }

    addScore() {
        this.score++;
        this.scoreEl.innerText = this.score;
        this.audio.playScore();

        // Earn 1 Coin per point scored
        const newCoins = StorageManager.getCoins() + 1;
        StorageManager.setCoins(newCoins);
        this.coinCountEl.innerText = newCoins;
        this.animateCoins();

        // Speed increases gradually
        if (this.score % 5 === 0) {
            this.pipeManager.speed += 0.5;
            this.environment.groundSpeed = this.pipeManager.speed;
        }
    }

    gameOver() {
        if (this.state === 'gameover') return;
        this.state = 'gameover';
        
        this.hud.classList.add('hidden');
        this.finalScoreEl.innerText = this.score;

        // Check and save highscore
        const currentHigh = StorageManager.getHighScore();
        if (this.score > currentHigh) {
            StorageManager.setHighScore(this.score);
        }

        this.gameOverScreen.classList.remove('hidden');
    }

    // Dynamic Shop Grid Generator
    renderShop() {
        const container = document.getElementById('shop-items-grid');
        container.innerHTML = '';

        const coins = StorageManager.getCoins();
        const owned = StorageManager.getOwnedSkins();

        Object.values(SKINS).forEach(skin => {
            const card = document.createElement('div');
            card.className = `skin-card`;

            const canvas = document.createElement('canvas');
            canvas.className = 'skin-preview-canvas';
            canvas.width = 60;
            canvas.height = 60;

            const name = document.createElement('div');
            name.className = 'skin-name';
            name.innerText = skin.name;

            const button = document.createElement('button');
            button.className = 'skin-action-btn';

            const isOwned = owned.includes(skin.id);

            if (isOwned) {
                button.className += ' select-style';
                button.innerText = 'OWNED';
                button.disabled = true;
            } else {
                button.className += ' buy-style';
                button.innerHTML = `<div class="coin-icon mini"></div> ${skin.price}`;
                
                // Purchase Action Handler
                button.addEventListener('click', (e) => {
                    e.stopPropagation();
                    if (coins >= skin.price) {
                        // Deduct Coins & Save ownership
                        const updatedCoins = coins - skin.price;
                        StorageManager.setCoins(updatedCoins);
                        
                        owned.push(skin.id);
                        StorageManager.setOwnedSkins(owned);
                        
                        // Equip skin immediately on purchase
                        StorageManager.setActiveSkin(skin.id);
                        
                        this.refreshLobbyData();
                        this.renderShop();
                        this.audio.playScore(); // Success sound effect
                    } else {
                        // Denied animation/audio effect
                        button.style.backgroundColor = '#FF5A5F';
                        setTimeout(() => {
                            button.style.backgroundColor = '';
                        }, 500);
                        this.audio.playTone(100, 80, 0.25, 'sawtooth', 0.2); // Reject buzz
                    }
                });
            }

            card.appendChild(canvas);
            card.appendChild(name);
            card.appendChild(button);
            container.appendChild(card);

            // Draw customized bird on the preview canvas
            this.drawSkinPreview(canvas, skin);
        });
    }

    // Dynamic Skin Customize Grid Generator
    renderCustomizer() {
        const container = document.getElementById('skins-select-grid');
        container.innerHTML = '';

        const owned = StorageManager.getOwnedSkins();
        const active = StorageManager.getActiveSkin();

        Object.values(SKINS).forEach(skin => {
            // Render skin only if unlocked
            if (!owned.includes(skin.id)) return;

            const card = document.createElement('div');
            const isActive = active === skin.id;
            card.className = `skin-card ${isActive ? 'selected' : ''}`;

            const canvas = document.createElement('canvas');
            canvas.className = 'skin-preview-canvas';
            canvas.width = 60;
            canvas.height = 60;

            const name = document.createElement('div');
            name.className = 'skin-name';
            name.innerText = skin.name;

            const button = document.createElement('button');
            button.className = 'skin-action-btn select-style';
            button.innerText = isActive ? 'ACTIVE' : 'EQUIP';
            
            if (isActive) {
                button.disabled = true;
            } else {
                button.addEventListener('click', () => {
                    StorageManager.setActiveSkin(skin.id);
                    this.renderCustomizer();
                    this.audio.playScore(); // Success click
                });
            }

            card.appendChild(canvas);
            card.appendChild(name);
            card.appendChild(button);
            container.appendChild(card);

            this.drawSkinPreview(canvas, skin);
        });
    }

    drawSkinPreview(canvas, skin) {
        const ctx = canvas.getContext('2d');
        const img = document.getElementById('img-bird-idle');

        const draw = () => {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.save();
            ctx.filter = skin.filter;
            // Draw centered
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            ctx.restore();
        };

        if (img.complete) {
            draw();
        } else {
            img.onload = draw;
        }
    }

    update() {
        this.environment.update();
        if (this.state === 'playing' || this.state === 'gameover') {
            this.bird.update();
        }
        if (this.state === 'playing') {
            this.pipeManager.update();
        }
        this.particleManager.update();
    }

    draw() {
        this.ctx.clearRect(0, 0, this.width, this.height);
        
        this.environment.drawBackground(this.ctx);
        this.pipeManager.draw(this.ctx);
        this.environment.drawGround(this.ctx);
        this.particleManager.draw(this.ctx);
        
        if (this.state === 'playing' || this.state === 'gameover') {
            this.bird.draw(this.ctx);
        }
    }

    loop() {
        this.update();
        this.draw();
        requestAnimationFrame(this.loop);
    }
}

// Initialise the game once content has loaded
window.addEventListener('DOMContentLoaded', () => {
    new Game();
});

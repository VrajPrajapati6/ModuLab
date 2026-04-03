/* 
    Background Particle System
    Author: Antigravity AI
*/

class Particle {
    constructor(canvas, color) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.x = Math.random() * canvas.width;
        this.y = Math.random() * canvas.height;
        this.size = Math.random() * 5 + 3;
        this.speedX = (Math.random() - 0.5) * 1.2;
        this.speedY = (Math.random() - 0.5) * 1.2;
        this.color = color;
    }

    update() {
        this.x += this.speedX;
        this.y += this.speedY;

        if (this.x > this.canvas.width) this.x = 0;
        if (this.x < 0) this.x = this.canvas.width;
        if (this.y > this.canvas.height) this.y = 0;
        if (this.y < 0) this.y = this.canvas.height;
    }

    draw() {
        this.ctx.fillStyle = this.color;
        this.ctx.globalAlpha = 0.4;
        this.ctx.beginPath();
        this.ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        this.ctx.fill();
    }
}

function initParticles() {
    const canvas = document.getElementById('bg-canvas');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    let particles = [];
    const count = 35;

    function resize() {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
    }

    function getThemeColor() {
        const theme = document.documentElement.getAttribute('data-theme') || 'light';
        const style = getComputedStyle(document.documentElement);
        // Using semi-transparent color for a subtle look
        return theme === 'dark' ? style.getPropertyValue('--accent').trim() : style.getPropertyValue('--primary').trim();
    }

    function createParticles() {
        particles = [];
        const color = getThemeColor();
        for (let i = 0; i < count; i++) {
            particles.push(new Particle(canvas, color));
        }
    }

    window.addEventListener('resize', () => {
        resize();
        createParticles();
    });

    // Observer for theme changes to update particle colors instantly
    const observer = new MutationObserver(() => {
        createParticles();
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

    function animate() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        particles.forEach(p => {
            p.update();
            p.draw();
        });
        requestAnimationFrame(animate);
    }

    resize();
    createParticles();
    animate();
}

document.addEventListener('DOMContentLoaded', initParticles);

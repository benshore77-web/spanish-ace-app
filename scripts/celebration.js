let canvas;
let ctx;
let animationFrame;
let particles = [];

function setupCanvas() {
  if (!canvas) {
    canvas = document.getElementById("celebration-canvas");
    if (!canvas) return;
    ctx = canvas.getContext("2d");
    window.addEventListener("resize", resizeCanvas);
    resizeCanvas();
  }
}

function resizeCanvas() {
  if (!canvas) return;
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}

function createParticles() {
  const colors = ["#1dd3b0", "#4e9fef", "#f2f230", "#ff7f50"];
  const count = 160;
  particles = new Array(count).fill(0).map(() => ({
    x: Math.random() * canvas.width,
    y: canvas.height + Math.random() * 40,
    velocityX: (Math.random() - 0.5) * 6,
    velocityY: -Math.random() * 12 - 8,
    size: Math.random() * 4 + 2,
    color: colors[Math.floor(Math.random() * colors.length)],
    rotation: Math.random() * Math.PI,
    rotationSpeed: (Math.random() - 0.5) * 0.2
  }));
}

function animate() {
  if (!ctx) return;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  particles.forEach((particle) => {
    particle.x += particle.velocityX;
    particle.y += particle.velocityY;
    particle.velocityY += 0.35;
    particle.rotation += particle.rotationSpeed;
    ctx.save();
    ctx.translate(particle.x, particle.y);
    ctx.rotate(particle.rotation);
    ctx.fillStyle = particle.color;
    ctx.fillRect(-particle.size / 2, -particle.size / 2, particle.size, particle.size * 2);
    ctx.restore();
  });
  particles = particles.filter((p) => p.y < canvas.height + 60);
  if (particles.length > 0) {
    animationFrame = requestAnimationFrame(animate);
  } else {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }
}

export function triggerCelebration() {
  setupCanvas();
  if (!canvas) return;
  cancelAnimationFrame(animationFrame);
  createParticles();
  animate();
}

// effects.js
const canvas = document.querySelector("#weather-canvas");
const ctx = canvas.getContext("2d");

let animationId = null;
let effectType = "clear";
let particles = [];
let lightningFlash = 0;

function redimensionnerCanvas() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}

window.addEventListener("resize", redimensionnerCanvas);
redimensionnerCanvas();

// Initialisation des particules selon l'effet
function initialiserParticules() {
  particles = [];
  const count = effectType === "rain" || effectType === "thunder" ? 180 : (effectType === "snow" ? 90 : 25);

  for (let i = 0; i < count; i++) {
    particles.push({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      length: Math.random() * 20 + 10,
      radius: Math.random() * 3 + 1,
      speedX: effectType === "snow" ? (Math.random() - 0.5) * 1.5 : (Math.random() - 0.5) * 0.5,
      speedY: effectType === "rain" || effectType === "thunder" ? Math.random() * 8 + 12 : (effectType === "snow" ? Math.random() * 2 + 1 : Math.random() * 0.4 + 0.2),
      opacity: Math.random() * 0.6 + 0.2
    });
  }
}

function animer() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Gestion des éclairs d'orage
  if (effectType === "thunder") {
    if (Math.random() < 0.015) {
      lightningFlash = Math.random() * 0.8 + 0.2;
    }
    if (lightningFlash > 0) {
      ctx.fillStyle = `rgba(255, 255, 255, ${lightningFlash})`;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      lightningFlash -= 0.05;
    }
  }

  // Animation des particules
  particles.forEach(p => {
    p.x += p.speedX;
    p.y += p.speedY;

    if (p.y > canvas.height) {
      p.y = -20;
      p.x = Math.random() * canvas.width;
    }
    if (p.x > canvas.width) p.x = 0;
    if (p.x < 0) p.x = canvas.width;

    ctx.beginPath();
    if (effectType === "rain" || effectType === "thunder") {
      ctx.strokeStyle = `rgba(174, 194, 224, ${p.opacity})`;
      ctx.lineWidth = 1.5;
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(p.x + p.speedX, p.y + p.length);
      ctx.stroke();
    } else if (effectType === "snow") {
      ctx.fillStyle = `rgba(255, 255, 255, ${p.opacity})`;
      ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      ctx.fill();
    } else {
      // Poussières solaires / atmosphère
      ctx.fillStyle = `rgba(255, 235, 160, ${p.opacity * 0.4})`;
      ctx.arc(p.x, p.y, p.radius * 1.5, 0, Math.PI * 2);
      ctx.fill();
    }
  });

  animationId = requestAnimationFrame(animer);
}

export function setWeatherEffect(code) {
  if (animationId) cancelAnimationFrame(animationId);

  // Détermination du type d'effet selon le code Open-Meteo
  if ([95, 96, 99].includes(code)) {
    effectType = "thunder";
  } else if ([51, 53, 55, 61, 63, 65, 80, 81, 82].includes(code)) {
    effectType = "rain";
  } else if ([71, 73, 75, 77, 85, 86].includes(code)) {
    effectType = "snow";
  } else {
    effectType = "clear";
  }

  initialiserParticules();
  animer();
}
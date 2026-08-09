const codesMeteo = {
  0: { texte: "Ciel dégagé", icone: "☀️" },
  1: { texte: "Principalement dégagé", icone: "🌤️" },
  2: { texte: "Partiellement nuageux", icone: "⛅" },
  3: { texte: "Couvert", icone: "☁️" },
  45: { texte: "Brouillard", icone: "🌫️" },
  51: { texte: "Bruine", icone: "🌦️" },
  61: { texte: "Pluie modérée", icone: "🌧️" },
  63: { texte: "Forte pluie", icone: "🌧️" },
  71: { texte: "Chutes de neige", icone: "❄️" },
  95: { texte: "Orage", icone: "⛈️" }
};

let donneesGlobales = null;

export function afficherMeteoActuelle(data, nomLieu) {
  donneesGlobales = data;
  const current = data.current;
  const daily = data.daily;

  document.querySelector("#ville").textContent = nomLieu;
  document.querySelector("#temperature").textContent = `${Math.round(current.temperature_2m)}°C`;
  document.querySelector("#vent").textContent = `${current.wind_speed_10m} km/h`;
  document.querySelector("#humidite").textContent = `${current.relative_humidity_2m}%`;

  const coucher = daily && daily.sunset ? daily.sunset[0].split("T")[1] : "--:--";
  document.querySelector("#soleil-apercu").textContent = coucher;

  const uvActuel = current.uv_index !== undefined ? Math.round(current.uv_index) : 0;
  document.querySelector("#indice-uv").textContent = `${uvActuel} / 11`;

  let codeInfo = codesMeteo[current.weather_code] || { texte: "Variable", icone: "🌡️" };
  let iconeAffichee = codeInfo.icone;
  if (!current.is_day && [0, 1].includes(current.weather_code)) iconeAffichee = "🌙";

  document.querySelector("#description").textContent = codeInfo.texte;
  document.querySelector("#icone").textContent = iconeAffichee;

  genererConseilsPratiques(current.temperature_2m, current.weather_code, current.wind_speed_10m, uvActuel, current.is_day);
  adapterFond(current.weather_code, current.is_day);

  document.querySelector("#bloc-meteo").style.display = "block";
  document.querySelector("#message-statut").style.display = "none";

  configurerInteractionsModales();
}

function genererConseilsPratiques(temp, code, vent, uv, isDay) {
  const conseils = [];
  if (temp < 8) conseils.push("🧥 Manteau chaud recommandé.");
  else if (temp < 18) conseils.push("🧥 Veste légère conseillée.");
  else conseils.push("👕 Tenue légère et confortable.");

  if ([51, 61, 63, 80, 95].includes(code)) conseils.push("☔ Prenez un parapluie.");

  if (isDay) {
    if (![51, 61, 63, 95].includes(code) && vent < 25 && temp >= 12 && temp <= 25) {
      conseils.push("🏃 Idéal pour courir ou faire du sport en extérieur.");
    }
    if (uv >= 6) conseils.push("🧴 Indice UV fort : lunettes et crème recommandées.");
  } else {
    conseils.push("🌙 Nuit calme : pensez à vous couvrir si vous sortez.");
  }

  document.querySelector("#conseils-box").innerHTML = `<strong>Conseils :</strong><br>${conseils.join("<br>")}`;
}

export function afficherPrevisions(daily) {
  const conteneur = document.querySelector("#previsions-7-jours");
  if (!conteneur) return;

  conteneur.innerHTML = daily.time.map((date, index) => {
    if (index === 0) return "";
    const max = Math.round(daily.temperature_2m_max[index]);
    const min = Math.round(daily.temperature_2m_min[index]);
    const code = daily.weather_code[index];
    const icone = (codesMeteo[code] || {}).icone || "🌡️";
    const jour = new Date(date).toLocaleDateString('fr-FR', { weekday: 'short' });

    return `
      <div class="prevision-item">
        <span>${jour}</span>
        <span>${icone}</span>
        <span>${max}°/${min}°</span>
      </div>
    `;
  }).join('');
}

export function afficherAlertePluie(hourly) {
  const conteneur = document.querySelector("#alerte-pluie");
  if (!conteneur || !hourly) return;

  const maintenant = new Date();
  const heureIndex = hourly.time.findIndex(t => new Date(t) >= maintenant);
  if (heureIndex === -1) {
    conteneur.textContent = "";
    return;
  }

  const codesPluie = [51, 53, 55, 61, 63, 65, 80, 81, 82, 95];
  let indexPluie = -1;

  for (let i = heureIndex; i < heureIndex + 24 && i < hourly.weather_code.length; i++) {
    if (codesPluie.includes(hourly.weather_code[i])) {
      indexPluie = i;
      break;
    }
  }

  if (indexPluie !== -1) {
    const diff = Math.round((new Date(hourly.time[indexPluie]) - maintenant) / 3600000);
    conteneur.textContent = diff <= 0 ? "🌧️ Pluie en cours ou imminente !" : `⚠️ Risque de pluie dans environ ${diff}h.`;
  } else {
    conteneur.textContent = "";
  }
}

// --- GESTION DES MODALES DÉTAILLÉES ---
function ouvrirModale(titre, htmlContent) {
  document.querySelector("#modal-titre").textContent = titre;
  document.querySelector("#modal-body").innerHTML = htmlContent;
  document.querySelector("#modal-details").style.display = "flex";
}

function configurerInteractionsModales() {
  const modal = document.querySelector("#modal-details");
  document.querySelector("#modal-close").onclick = () => modal.style.display = "none";
  window.onclick = (e) => { if (e.target === modal) modal.style.display = "none"; };

  // 1. Clic sur le Bloc Central : Détails heure par heure
  document.querySelector("#hero-meteo").onclick = () => {
    const hourly = donneesGlobales.hourly;
    const maintenant = new Date();
    const startIndex = hourly.time.findIndex(t => new Date(t) >= maintenant);
    
    const cartesHoraires = hourly.time.slice(startIndex, startIndex + 18).map((time, i) => {
      const idx = startIndex + i;
      const heure = new Date(time).getHours() + "h";
      const temp = Math.round(hourly.temperature_2m[idx]);
      const code = hourly.weather_code[idx];
      const proba = hourly.precipitation_probability ? hourly.precipitation_probability[idx] : 0;
      const icone = (codesMeteo[code] || {}).icone || "🌡️";

      return `
        <div class="hourly-card">
          <span>${heure}</span>
          <span style="font-size: 1.3em;">${icone}</span>
          <strong>${temp}°C</strong>
          <small style="color: #2980b9;">💧${proba}%</small>
        </div>
      `;
    }).join('');

    ouvrirModale("Prévisions des prochaines heures", `<div class="hourly-scroll">${cartesHoraires}</div>`);
  };

  // 2. Clic sur le Vent : Détails Rafales & Pression
  document.querySelector("#card-vent").onclick = () => {
    const c = donneesGlobales.current;
    const html = `
      <div class="detail-modal-list">
        <div class="detail-modal-row"><span>Vitesse moyenne</span><strong>${c.wind_speed_10m} km/h</strong></div>
        <div class="detail-modal-row"><span>Rafales maximales</span><strong>${c.wind_gusts_10m || c.wind_speed_10m} km/h</strong></div>
        <div class="detail-modal-row"><span>Direction</span><strong>${c.wind_direction_10m}°</strong></div>
        <div class="detail-modal-row"><span>Pression atmosphérique</span><strong>${Math.round(c.surface_pressure)} hPa</strong></div>
      </div>
    `;
    ouvrirModale("Détails du Vent & Atmosphère", html);
  };

  // 3. Clic sur le Soleil : Lever / Coucher
  document.querySelector("#card-soleil").onclick = () => {
    const d = donneesGlobales.daily;
    const lever = d.sunrise[0].split("T")[1];
    const coucher = d.sunset[0].split("T")[1];
    const html = `
      <div class="detail-modal-list">
        <div class="detail-modal-row"><span>🌅 Lever du soleil</span><strong>${lever}</strong></div>
        <div class="detail-modal-row"><span>🌇 Coucher du soleil</span><strong>${coucher}</strong></div>
        <div class="detail-modal-row"><span>Indice UV max aujourd'hui</span><strong>${Math.round(d.uv_index_max[0])} / 11</strong></div>
      </div>
    `;
    ouvrirModale("Cycle Solaire", html);
  };

  // 4. Clic sur l'Humidité & UV
  document.querySelector("#card-humidite").onclick = () => {
    const c = donneesGlobales.current;
    const html = `
      <div class="detail-modal-list">
        <div class="detail-modal-row"><span>Humidité relative</span><strong>${c.relative_humidity_2m}%</strong></div>
        <div class="detail-modal-row"><span>Température ressentie</span><strong>${Math.round(c.apparent_temperature)}°C</strong></div>
      </div>
    `;
    ouvrirModale("Ressenti & Humidité", html);
  };

  document.querySelector("#card-uv").onclick = document.querySelector("#card-soleil").onclick;
}

function adapterFond(code, isDay = 1) {
  const body = document.body;
  if (!isDay) {
    body.style.background = "linear-gradient(135deg, #0f2027 0%, #203a43 50%, #2c5364 100%)";
  } else if ([51, 61, 63, 95].includes(code)) {
    body.style.background = "linear-gradient(135deg, #3a6073 0%, #3a7bd5 100%)";
  } else if ([0, 1].includes(code)) {
    body.style.background = "linear-gradient(135deg, #f39c12 0%, #e74c3c 100%)";
  } else {
    body.style.background = "linear-gradient(135deg, #5D6D7E 0%, #2C3E50 100%)";
  }
}
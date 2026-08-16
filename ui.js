import { setWeatherEffect } from "./effects.js";

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
  95: { texte: "Orage", icone: "⛈️" },
};

let donneesGlobales = null;
let horlogeInterval = null;

export function afficherMeteoActuelle(data, nomLieu) {
  donneesGlobales = data;
  const current = data.current;
  const daily = data.daily;

  lancerHorloge(data.timezone);

  if (daily && daily.moon_phase && daily.moon_phase[0] !== undefined) {
    afficherPhaseLunaire(daily.moon_phase[0]);
  }

  document.querySelector("#ville").textContent = nomLieu;
  document.querySelector("#temperature").textContent = `${Math.round(current.temperature_2m)}°C`;
  document.querySelector("#vent").textContent = `${current.wind_speed_10m} km/h`;
  document.querySelector("#humidite").textContent = `${current.relative_humidity_2m}%`;

  const coucher = daily && daily.sunset && daily.sunset[0] ? daily.sunset[0].split("T")[1] : "--:--";
  document.querySelector("#soleil-apercu").textContent = coucher;

  const uvActuel = current.uv_index !== undefined ? Math.round(current.uv_index) : 0;
  document.querySelector("#indice-uv").textContent = `${uvActuel} / 11`;

  let codeMeteo = current.weather_code;
  const ilPleutVraiment = current.precipitation > 0 || current.rain > 0 || current.showers > 0;
  if (ilPleutVraiment && [0, 1, 2, 3].includes(codeMeteo)) {
    codeMeteo = 61;
  }

  let codeInfo = codesMeteo[codeMeteo] || { texte: "Variable", icone: "🌡️" };
  let iconeAffichee = codeInfo.icone;
  if (!current.is_day && [0, 1].includes(codeMeteo)) iconeAffichee = "🌙";

  document.querySelector("#description").textContent = codeInfo.texte;
  document.querySelector("#icone").textContent = iconeAffichee;

  genererConseilsPratiques(current.temperature_2m, codeMeteo, current.wind_speed_10m, uvActuel, current.is_day);
  
  const strollerEval = evaluateStrollerWalk(current.temperature_2m, codeMeteo, current.wind_speed_10m);
  const strollerBadgeElem = document.querySelector("#stroller-badge");
  if (strollerBadgeElem) {
      strollerBadgeElem.className = `stroller-badge ${strollerEval.className}`;
      strollerBadgeElem.textContent = strollerEval.text;
      strollerBadgeElem.title = strollerEval.description;
  }

  adapterFond(codeMeteo, current.is_day);
  setWeatherEffect(codeMeteo);

  verifierEtAfficherAlertes({
    temperature: current.temperature_2m,
    vent: current.wind_speed_10m,
    precipitation: current.precipitation || current.rain || current.showers || 0
  });

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
  if (!conteneur || !daily || !daily.time) return;

  conteneur.innerHTML = daily.time
    .map((date, index) => {
      if (index === 0) return "";
      const max = daily.temperature_2m_max[index] !== undefined ? Math.round(daily.temperature_2m_max[index]) : "--";
      const min = daily.temperature_2m_min[index] !== undefined ? Math.round(daily.temperature_2m_min[index]) : "--";
      const code = daily.weather_code[index];
      const icone = (codesMeteo[code] || {}).icone || "🌡️";
      const jour = new Date(date).toLocaleDateString("fr-FR", { weekday: "short" });

      return `
      <div class="prevision-item">
        <span>${jour}</span>
        <span>${icone}</span>
        <span>${max}°/${min}°</span>
      </div>
    `;
    })
    .join("");
}

export function afficherAlertePluie(hourly) {
  const conteneur = document.querySelector("#alerte-pluie");
  if (!conteneur || !hourly || !hourly.time) return;

  const codesPluie = [51, 53, 55, 61, 63, 65, 80, 81, 82, 95];
  const maintenant = new Date();

  let indexBase = 0;
  let ecartMin = Infinity;
  hourly.time.forEach((t, index) => {
    const diff = Math.abs(new Date(t) - maintenant);
    if (diff < ecartMin) {
      ecartMin = diff;
      indexBase = index;
    }
  });

  const fenetreActuelle = [indexBase, indexBase + 1].filter((idx) => idx < hourly.weather_code.length);
  const pluieImminente = fenetreActuelle.some((i) => {
    const code = hourly.weather_code[i];
    const precip = hourly.precipitation ? hourly.precipitation[i] : 0;
    const proba = hourly.precipitation_probability ? hourly.precipitation_probability[i] : 0;
    return codesPluie.includes(code) || precip > 0.05 || proba >= 35;
  });

  if (pluieImminente) {
    conteneur.textContent = "🌧️ Pluie ou averses en cours / imminentes.";
    envoyerNotificationPush("Attention !", "Risque de pluie imminent détecté 🌧️");
    return;
  }

  let indexProchaine = -1;
  for (let i = indexBase + 2; i < indexBase + 12 && i < hourly.weather_code.length; i++) {
    const code = hourly.weather_code[i];
    const precip = hourly.precipitation ? hourly.precipitation[i] : 0;
    const proba = hourly.precipitation_probability ? hourly.precipitation_probability[i] : 0;

    if (codesPluie.includes(code) || precip > 0.1 || proba >= 35) {
      indexProchaine = i;
      break;
    }
  }

  if (indexProchaine !== -1) {
    const diffHeures = indexProchaine - indexBase;
    conteneur.textContent = `⚠️ Risque de pluie dans environ ${diffHeures}h.`;
    if (diffHeures <= 1) {
      envoyerNotificationPush("Alerte Météo", `Risque de pluie dans environ ${diffHeures}h ⚠️`);
    }
  } else {
    conteneur.textContent = "";
  }
}

function envoyerNotificationPush(titre, message) {
  if (!("Notification" in window)) return;
  if (Notification.permission === "granted") {
    new Notification(titre, { body: message, icon: "./icon.png" });
  } else if (Notification.permission !== "denied") {
    Notification.requestPermission().then((permission) => {
      if (permission === "granted") {
        new Notification(titre, { body: message, icon: "./icon.png" });
      }
    });
  }
}

function ouvrirModale(titre, htmlContent) {
  document.querySelector("#modal-titre").textContent = titre;
  document.querySelector("#modal-body").innerHTML = htmlContent;
  document.querySelector("#modal-details").style.display = "flex";
}

function configurerInteractionsModales() {
  const modal = document.querySelector("#modal-details");
  const modalClose = document.querySelector("#modal-close");

  const fermer = () => { modal.style.display = "none"; };

  modalClose.onclick = fermer;
  modal.onclick = (e) => { if (e.target === modal) fermer(); };

  document.querySelector("#hero-meteo").onclick = () => {
    if (!donneesGlobales || !donneesGlobales.hourly || !donneesGlobales.hourly.time) {
      console.warn("Données horaires non disponibles.");
      return;
    }

    const hourly = donneesGlobales.hourly;
    const maintenant = new Date();
    const startIndex = hourly.time.findIndex((t) => new Date(t) >= maintenant);
    const safeStartIndex = startIndex !== -1 ? startIndex : 0;

    const heuresData = [];
    for (let i = safeStartIndex; i < safeStartIndex + 24 && i < hourly.time.length; i++) {
      heuresData.push({
        heure: new Date(hourly.time[i]).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
        temp: hourly.temperature_2m[i],
        icone: (codesMeteo[hourly.weather_code[i]] || {}).icone || "🌡️",
        proba: hourly.precipitation_probability ? hourly.precipitation_probability[i] : 0
      });
    }

    const temps = heuresData.map(h => h.temp);
    const minTemp = Math.min(...temps);
    const maxTemp = Math.max(...temps);
    const range = maxTemp - minTemp || 1;
    
    let points = "";
    const width = 600;
    const height = 100;
    
    heuresData.forEach((h, index) => {
      const x = (index / (heuresData.length - 1 || 1)) * width;
      const y = height - ((h.temp - minTemp) / range) * (height - 30) - 15;
      points += `${x},${y} `;
    });

    const svgGraph = `
      <div style="text-align: center; overflow-x: auto; padding: 10px 0; margin-bottom: 15px;">
        <svg width="100%" height="${height}" viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" style="overflow: visible;">
          <polyline fill="none" stroke="#3498db" stroke-width="3" points="${points}" />
          ${heuresData.map((h, index) => {
            const x = (index / (heuresData.length - 1 || 1)) * width;
            const y = height - ((h.temp - minTemp) / range) * (height - 30) - 15;
            return `<circle cx="${x}" cy="${y}" r="4" fill="#2980b9" /><text x="${x}" y="${y - 10}" font-size="10" text-anchor="middle" fill="#2c3e50">${Math.round(h.temp)}°</text>`;
          }).join('')}
        </svg>
      </div>
    `;

    const cartesHoraires = heuresData.map(h => `
      <div class="hourly-card">
        <span>${h.heure}</span>
        <span style="font-size: 1.3em;">${h.icone}</span>
        <strong>${Math.round(h.temp)}°C</strong>
        <small style="color: #2980b9;">💧${h.proba}%</small>
      </div>
    `).join("");

    ouvrirModale(
      "Évolution des 24 prochaines heures",
      `${svgGraph}<div class="hourly-scroll">${cartesHoraires}</div>`
    );
  };

  document.querySelector("#card-vent").onclick = () => {
    const c = donneesGlobales.current;
    ouvrirModale("Détails du Vent & Atmosphère", `
      <div class="detail-modal-list">
        <div class="detail-modal-row"><span>Vitesse moyenne</span><strong>${c.wind_speed_10m} km/h</strong></div>
        <div class="detail-modal-row"><span>Rafales maximales</span><strong>${c.wind_gusts_10m || c.wind_speed_10m} km/h</strong></div>
        <div class="detail-modal-row"><span>Direction</span><strong>${c.wind_direction_10m}°</strong></div>
      </div>
    `);
  };

  document.querySelector("#card-soleil").onclick = () => {
    const d = donneesGlobales.daily;
    ouvrirModale("Cycle Solaire", `
      <div class="detail-modal-list">
        <div class="detail-modal-row"><span>🌅 Lever du soleil</span><strong>${d.sunrise[0].split("T")[1]}</strong></div>
        <div class="detail-modal-row"><span>🌇 Coucher du soleil</span><strong>${d.sunset[0].split("T")[1]}</strong></div>
      </div>
    `);
  };

  document.querySelector("#card-humidite").onclick = () => {
    const c = donneesGlobales.current;
    ouvrirModale("Ressenti & Humidité", `
      <div class="detail-modal-list">
        <div class="detail-modal-row"><span>Humidité relative</span><strong>${c.relative_humidity_2m}%</strong></div>
        <div class="detail-modal-row"><span>Température ressentie</span><strong>${Math.round(c.apparent_temperature)}°C</strong></div>
      </div>
    `);
  };

  const cardLune = document.querySelector("#card-lune");
  if (cardLune) {
    cardLune.onclick = () => {
      const res = obtenirPhaseLunaireCalculee(new Date());
      const phasesPrincipales = [
        { nom: "Nouvelle lune", icone: "🌑", cible: 0 },
        { nom: "Premier quartier", icone: "🌓", cible: 7.38 },
        { nom: "Pleine lune", icone: "🌕", cible: 14.76 },
        { nom: "Dernier quartier", icone: "🌗", cible: 22.15 }
      ];
      
      const referenceDate = new Date(2000, 0, 6, 18, 14);
      const maintenant = new Date();
      const synodicMonth = 29.5305877057;
      let prochaines = [];

      for (let i = 0; i < 30; i++) {
        let d = new Date(maintenant);
        d.setDate(maintenant.getDate() + i);
        const diffDays = (d - referenceDate) / (1000 * 60 * 60 * 24);
        const age = (diffDays % synodicMonth + synodicMonth) % synodicMonth;
        
        phasesPrincipales.forEach(p => {
          let diff = Math.abs(age - p.cible);
          if (diff < 0.6 && !prochaines.some(r => r.nom === p.nom)) {
            prochaines.push({ nom: p.nom, icone: p.icone, date: d });
          }
        });
      }

      const listHtml = prochaines.slice(0, 4).map(p => `
        <div class="detail-modal-row">
          <span>${p.icone} ${p.nom}</span>
          <strong>${p.date.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })}</strong>
        </div>
      `).join("");

      ouvrirModale("Prochaines Phases de Lune", `
        <div class="detail-modal-list">
          <div class="detail-modal-row" style="background: #f1f2f6; margin-bottom: 8px;">
            <span>Phase actuelle</span>
            <strong>${res.icone} ${res.texte}</strong>
          </div>
          ${listHtml}
        </div>
      `);
    };
  }

  document.querySelector("#card-uv").onclick = document.querySelector("#card-soleil").onclick;
}

function adapterFond(code, isDay = 1) {
  let fond = "";
  if (!isDay) fond = "linear-gradient(135deg, #0b131c 0%, #152238 100%)";
  else if ([95, 96, 99].includes(code)) fond = "linear-gradient(135deg, #1c1e24 0%, #2f3542 100%)";
  else if ([71, 73, 75, 77, 85, 86].includes(code)) fond = "linear-gradient(135deg, #708090 0%, #a4b0be 100%)";
  else if ([51, 61, 63].includes(code)) fond = "linear-gradient(135deg, #2c3e50 0%, #3498db 100%)";
  else if ([0, 1].includes(code)) fond = "linear-gradient(135deg, #f39c12 0%, #e67e22 100%)";
  else fond = "linear-gradient(135deg, #57606f 0%, #2f3542 100%)";

  document.body.style.background = fond;
  document.documentElement.style.background = fond;
}

function lancerHorloge(tz) {
  if (horlogeInterval) clearInterval(horlogeInterval);
  const affichageDate = document.querySelector("#date-heure");
  if (!tz || !affichageDate) return;

  const maj = () => {
    const now = new Date();
    let texteDate = now.toLocaleString("fr-FR", { timeZone: tz, weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit", second: "2-digit" });
    affichageDate.textContent = texteDate.charAt(0).toUpperCase() + texteDate.slice(1);
  };
  maj();
  horlogeInterval = setInterval(maj, 1000);
}

function afficherPhaseLunaire() {
  const iconeElem = document.querySelector("#lune-icone");
  const texteElem = document.querySelector("#lune-texte");
  if (!iconeElem || !texteElem) return;

  const res = obtenirPhaseLunaireCalculee(new Date());
  iconeElem.textContent = res.icone;
  texteElem.textContent = res.texte;
}

function obtenirPhaseLunaireCalculee(date = new Date()) {
  const referenceDate = new Date(2000, 0, 6, 18, 14);
  const diffDays = (date - referenceDate) / (1000 * 60 * 60 * 24);
  const synodicMonth = 29.5305877057;
  const age = (diffDays % synodicMonth + synodicMonth) % synodicMonth;

  if (age < 1.84566) return { texte: "Nouvelle lune", icone: "🌑" };
  if (age < 5.53699) return { texte: "Premier croissant", icone: "🌒" };
  if (age < 9.22831) return { texte: "Premier quartier", icone: "🌓" };
  if (age < 12.91963) return { texte: "Gibbeuse croissante", icone: "🌔" };
  if (age < 16.61096) return { texte: "Pleine lune", icone: "🌕" };
  if (age < 20.30228) return { texte: "Gibbeuse décroissante", icone: "🌖" };
  if (age < 23.99361) return { texte: "Dernier quartier", icone: "🌗" };
  if (age < 27.68493) return { texte: "Dernier croissant", icone: "🌘" };
  return { texte: "Nouvelle lune", icone: "🌑" };
}

export function evaluateStrollerWalk(temp, weatherCode, windSpeed) {
    if (weatherCode < 50 && temp >= 12 && temp <= 26 && windSpeed < 20) {
        return { text: "Idéal pour la poussette 👶", className: "badge-ideal", description: "Température agréable, vent faible et pas de pluie." };
    } else if (weatherCode < 50 && windSpeed < 30) {
        return { text: "Correct (couvrir un peu) 🌤️", className: "badge-moderate", description: "Sortie possible, attention au vent." };
    } else {
        return { text: "Conditions non idéales 🌧️", className: "badge-poor", description: "Risque de pluie ou vent trop fort." };
    }
}

function verifierEtAfficherAlertes(meteoActuelle) {
  const banner = document.querySelector("#alert-banner");
  if (!banner) return;

  let alerteActive = null;

  if (meteoActuelle.temperature >= 35) {
    alerteActive = {
      classe: "canicule",
      texte: `🔥 <strong>Alerte Canicule :</strong> Température élevée de ${meteoActuelle.temperature}°C. Restez au frais et hydratez-vous.`
    };
  } else if (meteoActuelle.vent >= 50) {
    alerteActive = {
      classe: "vent",
      texte: `💨 <strong>Vent Violent :</strong> Rafales estimées à ${meteoActuelle.vent} km/h. Prudence lors de vos déplacements.`
    };
  } else if (meteoActuelle.precipitation && meteoActuelle.precipitation > 0) {
    alerteActive = {
      classe: "pluie",
      texte: `🌧️ <strong>Risque de Pluie :</strong> Des précipitations sont imminentes sur votre secteur.`
    };
  }

  if (alerteActive) {
    banner.className = `alert-banner ${alerteActive.classe}`;
    banner.innerHTML = alerteActive.texte;
    banner.style.display = "flex";
  } else {
    banner.style.display = "none";
  }
}
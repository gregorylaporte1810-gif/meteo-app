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

  // Lancement de l'horloge dynamique avec le fuseau horaire de la ville
  lancerHorloge(data.timezone);

  if (daily && daily.moon_phase && daily.moon_phase[0] !== undefined) {
    afficherPhaseLunaire(daily.moon_phase[0]);
  }


  document.querySelector("#ville").textContent = nomLieu;
  document.querySelector("#temperature").textContent =
    `${Math.round(current.temperature_2m)}°C`;
  document.querySelector("#vent").textContent =
    `${current.wind_speed_10m} km/h`;
  document.querySelector("#humidite").textContent =
    `${current.relative_humidity_2m}%`;

  const coucher =
    daily && daily.sunset && daily.sunset[0]
      ? daily.sunset[0].split("T")[1]
      : "--:--";
  document.querySelector("#soleil-apercu").textContent = coucher;

  const uvActuel =
    current.uv_index !== undefined ? Math.round(current.uv_index) : 0;
  document.querySelector("#indice-uv").textContent = `${uvActuel} / 11`;

  let codeMeteo = current.weather_code;

  const ilPleutVraiment =
    current.precipitation > 0 || current.rain > 0 || current.showers > 0;
  if (ilPleutVraiment && [0, 1, 2, 3].includes(codeMeteo)) {
    codeMeteo = 61;
  }

  let codeInfo = codesMeteo[codeMeteo] || { texte: "Variable", icone: "🌡️" };
  let iconeAffichee = codeInfo.icone;
  if (!current.is_day && [0, 1].includes(codeMeteo)) iconeAffichee = "🌙";

  document.querySelector("#description").textContent = codeInfo.texte;
  document.querySelector("#icone").textContent = iconeAffichee;

  genererConseilsPratiques(
    current.temperature_2m,
    codeMeteo,
    current.wind_speed_10m,
    uvActuel,
    current.is_day,
  );
  adapterFond(codeMeteo, current.is_day);

  // Déclenche l'animation météo correspondante
  setWeatherEffect(codeMeteo);

  document.querySelector("#bloc-meteo").style.display = "block";
  document.querySelector("#message-statut").style.display = "none";

  configurerInteractionsModales();
}

function genererConseilsPratiques(temp, code, vent, uv, isDay) {
  const conseils = [];
  if (temp < 8) conseils.push("🧥 Manteau chaud recommandé.");
  else if (temp < 18) conseils.push("🧥 Veste légère conseillée.");
  else conseils.push("👕 Tenue légère et confortable.");

  if ([51, 61, 63, 80, 95].includes(code))
    conseils.push("☔ Prenez un parapluie.");

  if (isDay) {
    if (
      ![51, 61, 63, 95].includes(code) &&
      vent < 25 &&
      temp >= 12 &&
      temp <= 25
    ) {
      conseils.push("🏃 Idéal pour courir ou faire du sport en extérieur.");
    }
    if (uv >= 6)
      conseils.push("🧴 Indice UV fort : lunettes et crème recommandées.");
  } else {
    conseils.push("🌙 Nuit calme : pensez à vous couvrir si vous sortez.");
  }

  document.querySelector("#conseils-box").innerHTML =
    `<strong>Conseils :</strong><br>${conseils.join("<br>")}`;
}

export function afficherPrevisions(daily) {
  const conteneur = document.querySelector("#previsions-7-jours");
  if (!conteneur || !daily || !daily.time) return;

  conteneur.innerHTML = daily.time
    .map((date, index) => {
      if (index === 0) return "";
      const max =
        daily.temperature_2m_max[index] !== undefined &&
        daily.temperature_2m_max[index] !== null
          ? Math.round(daily.temperature_2m_max[index])
          : "--";
      const min =
        daily.temperature_2m_min[index] !== undefined &&
        daily.temperature_2m_min[index] !== null
          ? Math.round(daily.temperature_2m_min[index])
          : "--";
      const code = daily.weather_code[index];
      const icone = (codesMeteo[code] || {}).icone || "🌡️";
      const jour = new Date(date).toLocaleDateString("fr-FR", {
        weekday: "short",
      });

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

  const fenetreActuelle = [indexBase, indexBase + 1].filter(
    (idx) => idx < hourly.weather_code.length,
  );
  const pluieImminente = fenetreActuelle.some((i) => {
    const code = hourly.weather_code[i];
    const precip = hourly.precipitation ? hourly.precipitation[i] : 0;
    const proba = hourly.precipitation_probability
      ? hourly.precipitation_probability[i]
      : 0;
    return codesPluie.includes(code) || precip > 0.05 || proba >= 35;
  });

  if (pluieImminente) {
    conteneur.textContent = "🌧️ Pluie ou averses en cours / imminentes.";
    return;
  }

  let indexProchaine = -1;
  for (
    let i = indexBase + 2;
    i < indexBase + 12 && i < hourly.weather_code.length;
    i++
  ) {
    const code = hourly.weather_code[i];
    const precip = hourly.precipitation ? hourly.precipitation[i] : 0;
    const proba = hourly.precipitation_probability
      ? hourly.precipitation_probability[i]
      : 0;

    if (codesPluie.includes(code) || precip > 0.1 || proba >= 35) {
      indexProchaine = i;
      break;
    }
  }

  if (indexProchaine !== -1) {
    const diffHeures = indexProchaine - indexBase;
    conteneur.textContent = `⚠️ Risque de pluie dans environ ${diffHeures}h.`;
  } else {
    conteneur.textContent = "";
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

  const fermer = () => {
    modal.style.display = "none";
  };

  modalClose.onclick = fermer;
  modal.onclick = (e) => {
    if (e.target === modal) fermer();
  };
  modal.ontouchstart = (e) => {
    if (e.target === modal) fermer();
  };
  document.querySelector("#card-lune").onclick = () => {
    const d = donneesGlobales.daily;
    if (!d || !d.moon_phase) return;

    // On génère la liste des phases pour les 7 prochains jours
    const lignesPrevisions = d.time.map((dateStr, i) => {
      const jour = new Date(dateStr).toLocaleDateString("fr-FR", { weekday: 'long', day: 'numeric', month: 'short' });
      const fraction = d.moon_phase[i];
      const { texte, icone } = obtenirTexteEtConeLune(fraction);

      return `
        <div class="detail-modal-row" style="display: flex; align-items: center; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #eee;">
          <span>${jour}</span>
          <div style="display: flex; align-items: center; gap: 8px;">
            <span style="font-size: 1.2em;">${icone}</span>
            <strong>${texte}</strong>
          </div>
        </div>
      `;
    }).join("");

    const html = `
      <div class="detail-modal-list">
        <div style="margin-bottom: 10px; font-size: 0.9em; color: #555;">Suivi du cycle lunaire et phases des prochains jours :</div>
        ${lignesPrevisions}
      </div>
    `;
    
    ouvrirModale("Phases Lunaires & Prochaines", html);
  };

  document.querySelector("#hero-meteo").onclick = () => {
    const hourly = donneesGlobales.hourly;
    const maintenant = new Date();
    const startIndex = hourly.time.findIndex((t) => new Date(t) >= maintenant);

    const cartesHoraires = hourly.time
      .slice(startIndex, startIndex + 18)
      .map((time, i) => {
        const idx = startIndex + i;
        const heure = new Date(time).getHours() + "h";
        const temp = Math.round(hourly.temperature_2m[idx]);
        const code = hourly.weather_code[idx];
        const proba = hourly.precipitation_probability
          ? hourly.precipitation_probability[idx]
          : 0;
        const icone = (codesMeteo[code] || {}).icone || "🌡️";

        return `
        <div class="hourly-card">
          <span>${heure}</span>
          <span style="font-size: 1.3em;">${icone}</span>
          <strong>${temp}°C</strong>
          <small style="color: #2980b9;">💧${proba}%</small>
        </div>
      `;
      })
      .join("");

    ouvrirModale(
      "Prévisions des prochaines heures",
      `<div class="hourly-scroll">${cartesHoraires}</div>`,
    );
  };

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

  document.querySelector("#card-uv").onclick =
    document.querySelector("#card-soleil").onclick;
}

function adapterFond(code, isDay = 1) {
  let fond = "";
  if (!isDay) {
    fond = "linear-gradient(135deg, #0b131c 0%, #152238 100%)";
  } else if ([95, 96, 99].includes(code)) {
    // Orage
    fond = "linear-gradient(135deg, #1c1e24 0%, #2f3542 100%)";
  } else if ([71, 73, 75, 77, 85, 86].includes(code)) {
    // Neige
    fond = "linear-gradient(135deg, #708090 0%, #a4b0be 100%)";
  } else if ([51, 61, 63].includes(code)) {
    // Pluie
    fond = "linear-gradient(135deg, #2c3e50 0%, #3498db 100%)";
  } else if ([0, 1].includes(code)) {
    // Soleil
    fond = "linear-gradient(135deg, #f39c12 0%, #e67e22 100%)";
  } else {
    // Nuageux
    fond = "linear-gradient(135deg, #57606f 0%, #2f3542 100%)";
  }

  document.body.style.background = fond;
  document.documentElement.style.background = fond; // Applique la couleur à tout l'écran iOS
}

// Gère l'affichage en temps réel de l'heure locale de la ville
function lancerHorloge(tz) {
  if (horlogeInterval) clearInterval(horlogeInterval);
  const affichageDate = document.querySelector("#date-heure");
  if (!tz || !affichageDate) return;

  const maj = () => {

    const now = new Date(); 
    
    // Options de formatage de la date locale
    const options = { 
      timeZone: tz, 
      weekday: 'long', day: 'numeric', month: 'long', 
      hour: '2-digit', minute: '2-digit', second: '2-digit' 
    };
    // On met la première lettre en majuscule
    let texteDate = now.toLocaleString('fr-FR', options);
    texteDate = texteDate.charAt(0).toUpperCase() + texteDate.slice(1);
    
    affichageDate.textContent = texteDate;
  };
  
  maj(); // Affichage immédiat
  horlogeInterval = setInterval(maj, 1000); // Mise à jour chaque seconde
}

function afficherPhaseLunaire(valeurFraction) {
  const iconeElem = document.querySelector("#lune-icone");
  const texteElem = document.querySelector("#lune-texte");
  if (!iconeElem || !texteElem) return;

  const res = obtenirTexteEtConeLune(valeurFraction);
  iconeElem.textContent = res.icone;
  texteElem.textContent = res.texte;

  // valeurFraction va de 0 à 1 (cycle lunaire)
  let texte = "Nouvelle lune";
  let icone = "🌑";

  if (valeurFraction > 0.03 && valeurFraction < 0.22) { texte = "Premier croissant"; icone = "🌒"; }
  else if (valeurFraction >= 0.22 && valeurFraction <= 0.28) { texte = "Premier quartier"; icone = "🌓"; }
  else if (valeurFraction > 0.28 && valeurFraction < 0.47) { texte = "Gibbeuse croissante"; icone = "🌔"; }
  else if (valeurFraction >= 0.47 && valeurFraction <= 0.53) { texte = "Pleine lune"; icone = "🌕"; }
  else if (valeurFraction > 0.53 && valeurFraction < 0.72) { texte = "Gibbeuse décroissante"; icone = "🌖"; }
  else if (valeurFraction >= 0.72 && valeurFraction <= 0.78) { texte = "Dernier quartier"; icone = "🌗"; }
  else if (valeurFraction > 0.78 && valeurFraction < 0.97) { texte = "Dernier croissant"; icone = "🌘"; }

  iconeElem.textContent = icone;
  texteElem.textContent = texte;
}

function obtenirTexteEtConeLune(valeurFraction) {
  let texte = "Nouvelle lune";
  let icone = "🌑";

  if (valeurFraction > 0.03 && valeurFraction < 0.22) { texte = "Premier croissant"; icone = "🌒"; }
  else if (valeurFraction >= 0.22 && valeurFraction <= 0.28) { texte = "Premier quartier"; icone = "🌓"; }
  else if (valeurFraction > 0.28 && valeurFraction < 0.47) { texte = "Gibbeuse croissante"; icone = "🌔"; }
  else if (valeurFraction >= 0.47 && valeurFraction <= 0.53) { texte = "Pleine lune"; icone = "🌕"; }
  else if (valeurFraction > 0.53 && valeurFraction < 0.72) { texte = "Gibbeuse décroissante"; icone = "🌖"; }
  else if (valeurFraction >= 0.72 && valeurFraction <= 0.78) { texte = "Dernier quartier"; icone = "🌗"; }
  else if (valeurFraction > 0.78 && valeurFraction < 0.97) { texte = "Dernier croissant"; icone = "🌘"; }

  return { texte, icone };
}
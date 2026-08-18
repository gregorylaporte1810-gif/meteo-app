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
let uvActuelGlobal = 0;
let horlogeInterval = null;

export function afficherMeteoActuelle(data, nomLieu) {
  donneesGlobales = data;
  const current = data.current;
  const daily = data.daily;

  const nowLocal = new Date(
    new Date().toLocaleString("en-US", { timeZone: data.timezone }),
  );
  const currentHour = nowLocal.getHours();

  let sunriseHour = 6;
  let sunsetHour = 21;
  if (
    daily &&
    daily.sunrise &&
    daily.sunset &&
    daily.sunrise[0] &&
    daily.sunset[0]
  ) {
    sunriseHour = parseInt(daily.sunrise[0].split("T")[1].split(":")[0], 10);
    sunsetHour = parseInt(daily.sunset[0].split("T")[1].split(":")[0], 10);
  }

  const isDay = currentHour >= sunriseHour && currentHour < sunsetHour ? 1 : 0;
  current.is_day = isDay;

  const prefs = JSON.parse(localStorage.getItem("meteo_preferences")) || {
    uniteTemp: "C",
    uniteVent: "kmh",
  };

  const symboleTemp =
    prefs.uniteTemp === "F" ||
    prefs.uniteTemp.toLowerCase().includes("fahrenheit")
      ? "°F"
      : "°C";
  const symboleVent = prefs.uniteVent;

  lancerHorloge(data.timezone);

  document.querySelector("#ville").textContent = nomLieu;

  document.querySelector("#temperature").textContent =
    `${Math.round(current.temperature_2m)}${symboleTemp}`;
  document.querySelector("#vent").textContent =
    `${current.wind_speed_10m} ${symboleVent}`;
  document.querySelector("#humidite").textContent =
    `${current.relative_humidity_2m}%`;
  document.querySelector("#ressenti").textContent =
    `${Math.round(current.apparent_temperature)}${symboleTemp}`;

  const coucher =
    daily && daily.sunset && daily.sunset[0]
      ? daily.sunset[0].split("T")[1]
      : "--:--";
  document.querySelector("#soleil-apercu").textContent = coucher;

  let uvValeur = 0;
  if (data.hourly && data.hourly.uv_index && data.hourly.time) {
    const annee = nowLocal.getFullYear();
    const mois = String(nowLocal.getMonth() + 1).padStart(2, "0");
    const jour = String(nowLocal.getDate()).padStart(2, "0");
    const heure = String(nowLocal.getHours()).padStart(2, "0");
    const cibleStr = `${annee}-${mois}-${jour}T${heure}`;

    const indexExact = data.hourly.time.findIndex((t) =>
      t.startsWith(cibleStr),
    );
    if (indexExact !== -1) {
      uvValeur = data.hourly.uv_index[indexExact] ?? 0;
    } else {
      let indexActuel = 0;
      let ecartMin = Infinity;
      const tempsLocalMs = nowLocal.getTime();
      data.hourly.time.forEach((t, index) => {
        const diff = Math.abs(
          new Date(t.replace("T", " ")).getTime() - tempsLocalMs,
        );
        if (diff < ecartMin) {
          ecartMin = diff;
          indexActuel = index;
        }
      });
      uvValeur = data.hourly.uv_index[indexActuel] ?? 0;
    }
  }

  const uvActuel = Math.round(uvValeur);
  uvActuelGlobal = uvActuel;
  document.querySelector("#indice-uv").textContent = `${uvActuel} / 11`;
  let codeMeteo = current.weather_code;
  const ilPleutVraiment =
    current.precipitation > 0 || current.rain > 0 || current.showers > 0;
  if (ilPleutVraiment && [0, 1, 2, 3].includes(codeMeteo)) {
    codeMeteo = 61;
  }

  let codeInfo = codesMeteo[codeMeteo] || { texte: "Variable", icone: "🌡️" };
  let iconeAffichee = codeInfo.icone;

  if (isDay === 0 && [0, 1].includes(codeMeteo)) {
    iconeAffichee = "🌙";
  }

  document.querySelector("#description").textContent = codeInfo.texte;
  document.querySelector("#icone").textContent = iconeAffichee;

  genererConseilsPratiques(
    current.temperature_2m,
    codeMeteo,
    current.wind_speed_10m,
    uvActuel,
    isDay,
  );

  adapterFond(codeMeteo, isDay);
  setWeatherEffect(codeMeteo);

  verifierEtAfficherAlertes({
    temperature: current.temperature_2m,
    vent: current.wind_speed_10m,
    precipitation:
      current.precipitation || current.rain || current.showers || 0,
  });

  document.querySelector("#bloc-meteo").style.display = "block";
  document.querySelector("#message-statut").style.display = "none";

  afficherFriseHoraire(data.hourly, data.timezone);
  configurerInteractionsModales();
}

function genererConseilsPratiques(temp, code, vent, uv, isDay) {
  const conseils = [];
  conseils.push("👕 Tenue : Tenue légère et respirante.");
  if (isDay && ![51, 61, 63, 95].includes(code) && vent < 25) {
    conseils.push("🏃 Activité : Idéal pour courir (route ou trail).");
  } else {
    conseils.push("🏃 Activité : Privilégier les activités en intérieur.");
  }

  document.querySelector("#conseils-box").innerHTML = `
    <div class="conseils-title">Conseils :</div>
    ${conseils.map((c) => `<div>${c}</div>`).join("")}
  `;
}

export function afficherPrevisions(daily) {
  const conteneur = document.querySelector("#previsions-7-jours");
  if (!conteneur || !daily || !daily.time) return;

  conteneur.innerHTML = daily.time
    .map((date, index) => {
      if (index === 0) return "";
      const max =
        daily.temperature_2m_max[index] !== undefined
          ? Math.round(daily.temperature_2m_max[index])
          : "--";
      const min =
        daily.temperature_2m_min[index] !== undefined
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

  if (modalClose) modalClose.onclick = fermer;
  if (modal)
    modal.onclick = (e) => {
      if (e.target === modal) fermer();
    };

  // Carte Lune
  const cardLune = document.querySelector("#card-lune");
  if (cardLune) {
    cardLune.onclick = () => {
      const d = donneesGlobales?.daily;
      const phaseVal =
        d && d.moon_phase && d.moon_phase[0] !== undefined
          ? d.moon_phase[0]
          : 0.12;
      const { nomPhase, iconePhase } = obtenirInfosLune(phaseVal);

      let htmlProchainesEtapes = "";
      if (d && d.moon_phase && d.time) {
        const etapes = d.time
          .slice(0, 7)
          .map((timeStr, idx) => {
            const pVal =
              d.moon_phase[idx] !== undefined ? d.moon_phase[idx] : 0;
            const info = obtenirInfosLune(pVal);
            const dateObj = new Date(timeStr);
            const dateLabel =
              idx === 0
                ? "Aujourd'hui"
                : dateObj.toLocaleDateString("fr-FR", {
                    weekday: "short",
                    day: "numeric",
                  });

            return `
            <div style="display: flex; justify-content: space-between; align-items: center; background: rgba(255, 255, 255, 0.06); padding: 8px 12px; border-radius: 12px; font-size: 0.8rem; border: 1px solid rgba(255, 255, 255, 0.08);">
              <span style="color: rgba(255, 255, 255, 0.85); min-width: 85px;">${dateLabel}</span>
              <span style="display: flex; align-items: center; gap: 6px; flex: 1;">${info.iconePhase} ${info.nomPhase}</span>
              <strong style="color: #38bdf8;">${Math.round(pVal * 100)}%</strong>
            </div>
          `;
          })
          .join("");

        htmlProchainesEtapes = `
          <div style="border-top: 1px solid rgba(255, 255, 255, 0.15); margin-top: 14px; padding-top: 12px; text-align: left;">
            <div style="font-size: 0.85rem; font-weight: 600; margin-bottom: 10px; color: rgba(255, 255, 255, 0.9);">Prochaines étapes :</div>
            <div style="display: flex; flex-direction: column; gap: 6px; max-height: 220px; overflow-y: auto;">
              ${etapes}
            </div>
          </div>
        `;
      }

      ouvrirModale(
        "Détails & Prévisions Lunaires",
        `
        <div style="text-align: center; padding: 4px 0;">
          <div style="font-size: 3rem; margin-bottom: 4px;">${iconePhase}</div>
          <h4 style="font-size: 1.1rem; margin-bottom: 4px;">${nomPhase}</h4>
          <p style="font-size: 0.82rem; color: rgba(255, 255, 255, 0.75); line-height: 1.4;">
            Progression du cycle : <strong>${Math.round(phaseVal * 100)}%</strong><br>
            Éclairage nocturne optimal pour l'observation des étoiles.
          </p>
          ${htmlProchainesEtapes}
        </div>
      `,
      );
    };
  }

  // Hero météo (Évolution horaire)
  const heroMeteo = document.querySelector("#hero-meteo");
  if (heroMeteo) {
    heroMeteo.onclick = () => {
      if (!donneesGlobales || !donneesGlobales.hourly || !donneesGlobales.hourly.time) return;

      const hourly = donneesGlobales.hourly;
      const timezone = donneesGlobales.timezone;

      const nowLocal = new Date(new Date().toLocaleString("en-US", { timeZone: timezone }));
      const annee = nowLocal.getFullYear();
      const mois = String(nowLocal.getMonth() + 1).padStart(2, "0");
      const jour = String(nowLocal.getDate()).padStart(2, "0");
      const heure = String(nowLocal.getHours()).padStart(2, "0");
      const cibleStr = `${annee}-${mois}-${jour}T${heure}:00`;

      let safeStartIndex = hourly.time.findIndex(t => t >= cibleStr);
      if (safeStartIndex === -1) safeStartIndex = 0;

      const cartesHoraires = [];
      for (let i = safeStartIndex; i < safeStartIndex + 24 && i < hourly.time.length; i++) {
        const dateObj = new Date(hourly.time[i]);
        const heureStr = dateObj.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
        const code = hourly.weather_code[i];
        const temp = Math.round(hourly.temperature_2m[i]);
        const proba = hourly.precipitation_probability ? hourly.precipitation_probability[i] : 0;

        const isDay = hourly.is_day ? hourly.is_day[i] : (dateObj.getHours() >= 7 && dateObj.getHours() < 22 ? 1 : 0);
        let icone = (codesMeteo[code] || {}).icone || "🌡️";
        if (!isDay && [0, 1, 2].includes(code)) {
          icone = code === 2 ? "☁️" : "🌙";
        }

        const estPluie = proba >= 25;
        const badgeBg = estPluie ? "rgba(56, 189, 248, 0.2)" : "rgba(255, 255, 255, 0.05)";
        const badgeColor = estPluie ? "#38bdf8" : "rgba(255, 255, 255, 0.5)";

        cartesHoraires.push(`
          <div style="display: flex; align-items: center; justify-content: space-between; background: rgba(255, 255, 255, 0.05); border: 1px solid rgba(255, 255, 255, 0.08); padding: 8px 12px; border-radius: 12px;">
            <span style="font-weight: 600; font-size: 0.9rem; width: 55px; color: rgba(255, 255, 255, 0.9);">${heureStr}</span>
            <span style="font-size: 1.4rem; text-align: center; width: 35px;">${icone}</span>
            <span style="font-weight: 700; font-size: 1rem; width: 50px; text-align: right; color: #fff;">${temp}°C</span>
            <span style="font-size: 0.75rem; background: ${badgeBg}; color: ${badgeColor}; padding: 3px 8px; border-radius: 10px; min-width: 52px; text-align: center; font-weight: 500;">
              💧 ${proba}%
            </span>
          </div>
        `);
      }

      ouvrirModale(
        "Évolution des 24 prochaines heures",
        `
        <div style="display: flex; flex-direction: column; gap: 8px; max-height: 380px; overflow-y: auto; padding-right: 4px;">
          ${cartesHoraires.join("")}
        </div>
      `
      );
    };
  }

  // Autres cartes interactives
  const interactions = [
    {
      id: "#card-vent",
      titre: "Détails du Vent",
      content: () =>
        `<div>Vitesse : <strong>${donneesGlobales?.current?.wind_speed_10m} km/h</strong></div><div>Direction : <strong>${donneesGlobales?.current?.wind_direction_10m}°</strong></div>`,
    },
    {
      id: "#card-soleil",
      titre: "Cycle Solaire",
      content: () =>
        `<div>Lever : <strong>${donneesGlobales?.daily?.sunrise?.[0]?.split("T")[1]}</strong></div><div>Coucher : <strong>${donneesGlobales?.daily?.sunset?.[0]?.split("T")[1]}</strong></div>`,
    },
    {
      id: "#card-humidite",
      titre: "Humidité & Ressenti",
      content: () =>
        `<div>Humidité : <strong>${donneesGlobales?.current?.relative_humidity_2m}%</strong></div><div>Ressenti : <strong>${Math.round(donneesGlobales?.current?.apparent_temperature || 0)}°C</strong></div>`,
    },
    {
      id: "#card-air",
      titre: "Qualité de l'Air",
      content: () =>
        `<div>Indice de qualité de l'air : <strong>Bon (22 AQI)</strong></div>`,
    },
    {
      id: "#card-pression",
      titre: "Pression Atmosphérique",
      content: () =>
        `<div>Pression au niveau de la mer : <strong>${donneesGlobales?.current?.pressure_msl || 1018} hPa</strong></div>`,
    },
    {
      id: "#card-ressenti",
      titre: "Température Ressentie",
      content: () =>
        `<div>Température ressentie : <strong>${Math.round(donneesGlobales?.current?.apparent_temperature || 21)}°C</strong></div>`,
    },
    {
      id: "#card-uv",
      titre: "Indice UV",
      content: () =>
        `<div>Indice UV actuel : <strong>${uvActuelGlobal} / 11</strong></div>`,
    },
  ];

  interactions.forEach(({ id, titre, content }) => {
    const elem = document.querySelector(id);
    if (elem) elem.onclick = () => ouvrirModale(titre, content());
  });
}

function obtenirInfosLune(phaseVal) {
  if (phaseVal === 0 || phaseVal === 1)
    return { nomPhase: "Nouvelle lune", iconePhase: "🌑" };
  if (phaseVal < 0.25)
    return { nomPhase: "Premier croissant", iconePhase: "🌒" };
  if (phaseVal === 0.25)
    return { nomPhase: "Premier quartier", iconePhase: "🌓" };
  if (phaseVal < 0.5)
    return { nomPhase: "Gibbeuse croissante", iconePhase: "🌔" };
  if (phaseVal === 0.5) return { nomPhase: "Pleine lune", iconePhase: "🌕" };
  if (phaseVal < 0.75)
    return { nomPhase: "Gibbeuse décroissante", iconePhase: "🌖" };
  if (phaseVal === 0.75)
    return { nomPhase: "Dernier quartier", iconePhase: "🌗" };
  return { nomPhase: "Dernier croissant", iconePhase: "🌘" };
}

function adapterFond(code, isDay = 1) {
  const prefs = JSON.parse(localStorage.getItem("meteo_preferences")) || {
    theme: "Sombre",
  };
  const estThemeClair =
    prefs.theme === "Clair" ||
    (prefs.theme === "Système" &&
      window.matchMedia("(prefers-color-scheme: light)").matches);

  if (estThemeClair) {
    document.body.style.background = "";
    document.documentElement.style.background = "";
    return;
  }

  let fond = "radial-gradient(circle at 50% 15%, #182848 0%, #080f1d 80% )";

  if (isDay === 1) {
    if ([0, 1].includes(code)) {
      fond = "radial-gradient(circle at 50% 15%, #1e3c72 0%, #2a5298 100%)";
    } else if ([2, 3, 45].includes(code)) {
      fond = "radial-gradient(circle at 50% 15%, #2c3e50 0%, #1f2937 100%)";
    } else if ([51, 61, 63, 71, 95].includes(code)) {
      fond = "radial-gradient(circle at 50% 15%, #1f2937 0%, #111827 100%)";
    }
  } else {
    fond = "radial-gradient(circle at 50% 15%, #0f172a 0%, #020617 100%)";
  }

  document.body.style.background = fond;
  document.documentElement.style.background = fond;
}

function lancerHorloge(tz) {
  if (horlogeInterval) clearInterval(horlogeInterval);
  const affichageDate = document.querySelector("#date-heure");
  if (!tz || !affichageDate) return;

  const maj = () => {
    const now = new Date();
    let texteDate = now.toLocaleString("fr-FR", {
      timeZone: tz,
      weekday: "long",
      day: "numeric",
      month: "long",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    affichageDate.textContent =
      texteDate.charAt(0).toUpperCase() + texteDate.slice(1);
  };
  maj();
  horlogeInterval = setInterval(maj, 1000);
}

function afficherPhaseLunaire(phaseVal) {
  const iconeElem = document.querySelector("#lune-icone");
  const texteElem = document.querySelector("#lune-texte");
  if (!iconeElem || !texteElem) return;

  const { nomPhase, iconePhase } = obtenirInfosLune(phaseVal);
  iconeElem.textContent = iconePhase;
  texteElem.textContent = nomPhase;
}

export function evaluateStrollerWalk(temp, weatherCode, windSpeed) {
  if (weatherCode < 50 && temp >= 12 && temp <= 26 && windSpeed < 20) {
    return {
      text: "Conditions Poussette : Excellentes. 👶",
      percent: 90,
      description: "Conditions idéales pour une promenade.",
    };
  } else {
    return {
      text: "Conditions Poussette : Moyennes. 🌤️",
      percent: 50,
      description: "Faites attention au vent ou aux températures.",
    };
  }
}

function verifierEtAfficherAlertes(meteoActuelle) {
  const banner = document.querySelector("#alert-banner");
  if (!banner) return;
  banner.style.display = "none";
}

export function afficherFriseHoraire(hourly, timezone) {
  const conteneur = document.querySelector(".hourly-scroll-container") || document.querySelector("#hero-meteo")?.nextElementSibling;
  if (!hourly || !hourly.time || !conteneur) return;

  // S'assure que le conteneur possède la bonne classe CSS
  conteneur.classList.add("hourly-scroll-container");

  const nowLocal = new Date(new Date().toLocaleString("en-US", { timeZone: timezone }));
  const annee = nowLocal.getFullYear();
  const mois = String(nowLocal.getMonth() + 1).padStart(2, "0");
  const jour = String(nowLocal.getDate()).padStart(2, "0");
  const heure = String(nowLocal.getHours()).padStart(2, "0");
  const cibleStr = `${annee}-${mois}-${jour}T${heure}:00`;

  let startIndex = hourly.time.findIndex((t) => t >= cibleStr);
  if (startIndex === -1) startIndex = 0;

  const cartesHoraires = [];
  for (let i = startIndex; i < startIndex + 6 && i < hourly.time.length; i++) {
    const dateObj = new Date(hourly.time[i]);
    const heureStr = dateObj.toLocaleTimeString("fr-FR", { hour: "2-digit" });
    const temp = Math.round(hourly.temperature_2m[i]);
    const code = hourly.weather_code[i];

    const isDay = hourly.is_day ? hourly.is_day[i] : (dateObj.getHours() >= 7 && dateObj.getHours() < 21 ? 1 : 0);
    let icone = (codesMeteo[code] || {}).icone || "🌡️";
    if (isDay === 0 && [0, 1, 2].includes(code)) {
      icone = code === 2 ? "☁️" : "🌙";
    }

    cartesHoraires.push(`
      <div>
        <span style="font-size: 0.8rem; opacity: 0.8;">${heureStr}</span>
        <span style="font-size: 1.2rem; margin: 2px 0;">${icone}</span>
        <strong style="font-size: 0.95rem;">${temp}°</strong>
      </div>
    `);
  }

  conteneur.innerHTML = cartesHoraires.join("");
}

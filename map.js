import { fetchMeteoComplete, fetchNomParCoordonnees } from "./api.js";

let map = null;
let point1 = null;
let point2 = null;

export function initialiserCarte() {
  const btnMap = document.querySelector("#btn-map");
  const modalMap = document.querySelector("#modal-map");
  const btnClose = document.querySelector("#modal-map-close");
  const instructions = document.querySelector("#map-instructions");

  btnMap.addEventListener("click", () => {
    modalMap.style.display = "flex";

    // On ne crée la carte qu'à la première ouverture
    if (!map) {
      map = L.map("map-container").setView([20, 0], 2);

      // Fond de carte propre
      L.tileLayer(
        "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
        {
          attribution: "&copy; OpenStreetMap",
          subdomains: "abcd",
          maxZoom: 19,
        },
      ).addTo(map);

      // Gestion du clic sur la carte
      map.on("click", async (e) => {
        const { lat, lng } = e.latlng;
        instructions.innerHTML = "⏳ <em>Analyse de la zone en cours...</em>";

        try {
          const nom = await fetchNomParCoordonnees(lat, lng);
          const meteo = await fetchMeteoComplete(lat, lng);
          const tz = meteo.timezone || "UTC";
          const code = meteo.current.weather_code;

          // Texte rapide pour l'état météo (pluie, orage, neige, etc.)
          let meteoTexte = "Dégagé / Nuageux ⛅";
          if ([51, 61, 63, 65, 80, 81, 82].includes(code))
            meteoTexte = "Pluie 🌧️";
          if ([71, 73, 75, 77, 85, 86].includes(code)) meteoTexte = "Neige ❄️";
          if ([95, 96, 99].includes(code)) meteoTexte = "Orage ⛈️";

          if (!point1 || (point1 && point2)) {
            // C'est le premier clic (ou on recommence un cycle)
            point1 = {
              nom,
              tz,
              meteoTexte,
              temp: Math.round(meteo.current.temperature_2m),
            };
            point2 = null;
            afficherUnPoint(point1, instructions);
          } else {
            // C'est le deuxième clic : on compare !
            point2 = {
              nom,
              tz,
              meteoTexte,
              temp: Math.round(meteo.current.temperature_2m),
            };
            afficherComparaison(point1, point2, instructions);
          }
        } catch (err) {
          instructions.innerHTML = "❌ Impossible de lire les données ici.";
        }
      });
    }

    // Répare un bug d'affichage de Leaflet quand il est chargé dans une modale cachée
    setTimeout(() => map.invalidateSize(), 300);
  });

  btnClose.addEventListener("click", () => {
    modalMap.style.display = "none";
  });
}

function afficherUnPoint(p, conteneur) {
  const heure = new Date().toLocaleTimeString("fr-FR", {
    timeZone: p.tz,
    hour: "2-digit",
    minute: "2-digit",
  });
  conteneur.innerHTML = `
    <strong>1️⃣ ${p.nom} sélectionné !</strong><br>
    Heure locale : ${heure} (${p.tz}) | Météo : ${p.meteoTexte} (${p.temp}°C)<br>
    <span style="color:#2980b9;">👉 <em>Cliquez sur un autre pays pour comparer.</em></span>
  `;
}

function afficherComparaison(p1, p2, conteneur) {
  const d = new Date();
  // Astuce pour calculer le décalage : on convertit l'heure actuelle dans les deux fuseaux
  const d1 = new Date(d.toLocaleString("en-US", { timeZone: p1.tz }));
  const d2 = new Date(d.toLocaleString("en-US", { timeZone: p2.tz }));

  // Calcul de la différence en heures
  const diffHours = Math.round((d1 - d2) / (1000 * 60 * 60));

  let texteDecalage = "";
  if (diffHours === 0) texteDecalage = "⏱️ Aucun décalage horaire.";
  else if (diffHours > 0)
    texteDecalage = `⏱️ <strong>${p1.nom}</strong> a <strong>${diffHours}h d'avance</strong> sur ${p2.nom}.`;
  else
    texteDecalage = `⏱️ <strong>${p1.nom}</strong> a <strong>${Math.abs(diffHours)}h de retard</strong> sur ${p2.nom}.`;

  const t1 = d1.toLocaleTimeString("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
  });
  const t2 = d2.toLocaleTimeString("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
  });

  conteneur.innerHTML = `
    <div style="display:flex; justify-content:space-between; text-align:left; font-size: 0.95em;">
      <div style="flex:1;"><strong>📍 ${p1.nom}</strong><br>Heure : ${t1}<br>Temps : ${p1.meteoTexte} (${p1.temp}°C)</div>
      <div style="flex:1;"><strong>📍 ${p2.nom}</strong><br>Heure : ${t2}<br>Temps : ${p2.meteoTexte} (${p2.temp}°C)</div>
    </div>
    <hr style="margin: 6px 0; border:0; border-top:1px solid #ccc;">
    <span style="color: #d35400;">${texteDecalage}</span>
  `;
}

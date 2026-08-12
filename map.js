import { fetchMeteoComplete, fetchNomParCoordonnees } from './api.js';

let map = null;
let point1 = null;
let point2 = null;
let modeComparaison = false; // Permet de savoir si on a cliqué sur le bouton "Comparer"

export function initialiserCarte() {
  const btnMap = document.querySelector("#btn-map");
  const modalMap = document.querySelector("#modal-map");
  const btnClose = document.querySelector("#modal-map-close");
  const instructions = document.querySelector("#map-instructions");

  btnMap.addEventListener("click", () => {
    modalMap.style.display = "flex";

    // On ne crée la carte qu'à la première ouverture
    if (!map) {
      map = L.map('map-container').setView([20, 0], 2);
      
      // 1. FOND DE CARTE COLORÉ (OpenStreetMap standard)
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap',
        maxZoom: 19
      }).addTo(map);

      // Gestion du clic sur la carte
      map.on('click', async (e) => {
        const { lat, lng } = e.latlng;
        instructions.innerHTML = "⏳ <em>Analyse de la zone en cours...</em>";

        try {
          const nom = await fetchNomParCoordonnees(lat, lng);
          const meteo = await fetchMeteoComplete(lat, lng);
          const tz = meteo.timezone || "UTC";
          const code = meteo.current.weather_code;
          
          let meteoTexte = "Dégagé / Nuageux ⛅";
          if ([51,61,63,65,80,81,82].includes(code)) meteoTexte = "Pluie 🌧️";
          if ([71,73,75,77,85,86].includes(code)) meteoTexte = "Neige ❄️";
          if ([95,96,99].includes(code)) meteoTexte = "Orage ⛈️";

          // 2. GESTION DE L'OPTION DE COMPARAISON
          if (!modeComparaison) {
            // Mode normal : chaque clic affiche juste le lieu cliqué
            point1 = { nom, tz, meteoTexte, temp: Math.round(meteo.current.temperature_2m) };
            afficherUnPoint(point1, instructions);
          } else {
            // Si on a cliqué sur le bouton "Comparer", le clic suivant active la comparaison
            point2 = { nom, tz, meteoTexte, temp: Math.round(meteo.current.temperature_2m) };
            afficherComparaison(point1, point2, instructions);
            modeComparaison = false; // On désactive le mode pour le prochain clic
          }
        } catch (err) {
          instructions.innerHTML = "❌ Impossible de lire les données ici.";
        }
      });
    }
    
    // Répare un bug d'affichage de Leaflet dans les modales
    setTimeout(() => map.invalidateSize(), 300);
  });

  btnClose.addEventListener("click", () => {
    modalMap.style.display = "none";
    // On réinitialise l'état quand on ferme la fenêtre
    modeComparaison = false;
    instructions.innerHTML = "🌍 Cliquez sur un pays pour voir sa météo.";
  });
}

function afficherUnPoint(p, conteneur) {
  const heure = new Date().toLocaleTimeString('fr-FR', { timeZone: p.tz, hour: '2-digit', minute: '2-digit' });
  conteneur.innerHTML = `
    <strong>📍 ${p.nom}</strong><br>
    Heure locale : ${heure} (${p.tz}) | Météo : ${p.meteoTexte} (${p.temp}°C)<br>
    <button id="btn-activer-comparaison" style="margin-top: 8px; padding: 6px 12px; background: #2980b9; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 0.9em;">
      ⚖️ Comparer avec un autre lieu
    </button>
  `;

  // On écoute le clic sur le nouveau bouton
  document.querySelector("#btn-activer-comparaison").addEventListener("click", () => {
    modeComparaison = true;
    conteneur.innerHTML = `
      <strong>📍 ${p.nom} mémorisé.</strong><br>
      <span style="color:#2980b9;">👉 <em>Maintenant, cliquez sur un 2ème lieu sur la carte !</em></span>
    `;
  });
}

function afficherComparaison(p1, p2, conteneur) {
  const d = new Date();
  const d1 = new Date(d.toLocaleString("en-US", { timeZone: p1.tz }));
  const d2 = new Date(d.toLocaleString("en-US", { timeZone: p2.tz }));
  
  const diffHours = Math.round((d1 - d2) / (1000 * 60 * 60));
  
  let texteDecalage = "";
  if (diffHours === 0) texteDecalage = "⏱️ Aucun décalage horaire.";
  else if (diffHours > 0) texteDecalage = `⏱️ <strong>${p1.nom}</strong> a <strong>${diffHours}h d'avance</strong> sur ${p2.nom}.`;
  else texteDecalage = `⏱️ <strong>${p1.nom}</strong> a <strong>${Math.abs(diffHours)}h de retard</strong> sur ${p2.nom}.`;

  const t1 = d1.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  const t2 = d2.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

  conteneur.innerHTML = `
    <div style="display:flex; justify-content:space-between; text-align:left; font-size: 0.95em;">
      <div style="flex:1;"><strong>1️⃣ ${p1.nom}</strong><br>${t1} | ${p1.temp}°C</div>
      <div style="flex:1;"><strong>2️⃣ ${p2.nom}</strong><br>${t2} | ${p2.temp}°C</div>
    </div>
    <hr style="margin: 6px 0; border:0; border-top:1px solid #ccc;">
    <span style="color: #d35400; display: block; margin-bottom: 6px;">${texteDecalage}</span>
    <button id="btn-reset" style="padding: 4px 10px; background: #7f8c8d; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 0.8em;">
      🔄 Nouvelle recherche
    </button>
  `;

  document.querySelector("#btn-reset").addEventListener("click", () => {
    modeComparaison = false;
    conteneur.innerHTML = "🌍 Cliquez sur un pays pour voir sa météo.";
  });
}
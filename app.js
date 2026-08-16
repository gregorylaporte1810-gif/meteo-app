import {
  fetchCoordonnees,
  fetchMeteoComplete,
  fetchNomParCoordonnees,
} from "./api.js";
import {
  afficherMeteoActuelle,
  afficherPrevisions,
  afficherAlertePluie,
} from "./ui.js";
import { initialiserCarte } from "./map.js";

const inputVille = document.querySelector("#input-ville");
const btnRechercher = document.querySelector("#btn-rechercher");
const btnGeoloc = document.querySelector("#btn-geoloc");
const btnFav = document.querySelector("#btn-toggle-favori");
const suggestionsList = document.querySelector("#suggestions-list");
const favorisBar = document.querySelector("#favoris-bar");
const messageStatut = document.querySelector("#message-statut");

let villeActuelleNom = "";
let debounceTimer = null;
let indexSuggestion = -1;

function setBoutonChargement(actif) {
  if (actif) {
    btnRechercher.innerHTML = "⏳";
    btnRechercher.disabled = true;
  } else {
    btnRechercher.innerHTML = "🔍";
    btnRechercher.disabled = false;
  }
}

function getFavoris() {
  return (
    JSON.parse(localStorage.getItem("favoris_meteo")) || [
      "Ichy",
      "Bois-le-Roi",
      "Paris",
    ]
  );
}

function sauvegarderFavoris(favoris) {
  localStorage.setItem("favoris_meteo", JSON.stringify(favoris));
  afficherFavoris();
  actualiserBoutonFavori();
}

function actualiserBoutonFavori() {
  if (!btnFav) return;
  const favoris = getFavoris();
  if (favoris.includes(villeActuelleNom)) {
    btnFav.textContent = "⭐";
    btnFav.title = "Retirer des favoris";
  } else {
    btnFav.textContent = "☆";
    btnFav.title = "Ajouter aux favoris";
  }
}

function saveWeatherData(data) {
  const cachePayload = {
    timestamp: Date.now(),
    data: data,
  };
  localStorage.setItem("last_weather_cache", JSON.stringify(cachePayload));
}

function afficherFavoris() {
  const favoris = getFavoris();
  // Ajout d'un bouton de comparateur rapide à la fin de la barre de favoris
  favorisBar.innerHTML = favoris
    .map(
      (v) => `
    <span class="fav-badge">
      <span class="fav-label">${v}</span>
      <span class="fav-delete" data-ville="${v}" title="Supprimer">×</span>
    </span>
  `,
    )
    .join("") + `<span class="fav-badge" id="btn-comparateur" style="background: #3498db; color: white; cursor: pointer;" title="Comparer les favoris">📊 Comparer</span>`;

  document.querySelectorAll(".fav-label").forEach((label) => {
    label.addEventListener("click", () => {
      inputVille.value = label.textContent;
      chargerMeteoParNom(label.textContent);
    });
  });

  document.querySelectorAll(".fav-delete").forEach((delBtn) => {
    delBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      const villeASupprimer = delBtn.dataset.ville;
      const liste = getFavoris().filter((v) => v !== villeASupprimer);
      sauvegarderFavoris(liste);
    });
  });

  const btnComp = document.getElementById("btn-comparateur");
  if (btnComp) {
    btnComp.onclick =ouvrirComparateurFavoris;
  }
}

// Fonction du Comparateur Rapide de Favoris
async function ouvrirComparateurFavoris() {
  const favoris = getFavoris();
  const modal = document.querySelector("#modal-details");
  const titre = document.querySelector("#modal-titre");
  const body = document.querySelector("#modal-body");

  titre.textContent = "Comparateur Rapide des Favoris";
  body.innerHTML = "<p style='text-align:center;'>Chargement des favoris...</p>";
  modal.style.display = "flex";

  let resultatsHtml = "<div style='display: flex; flex-direction: column; gap: 10px;'>";

  for (const villeNom of favoris) {
    try {
      const results = await fetchCoordonnees(villeNom);
      if (results.length > 0) {
        const v = results[0];
        const data = await fetchMeteoComplete(v.latitude, v.longitude);
        const temp = Math.round(data.current.temperature_2m);
        const vent = Math.round(data.current.wind_speed_10m);
        
        // Utilisation de += pour cumuler toutes les villes
        resultatsHtml += `
          <div style="display: flex; justify-content: space-between; align-items: center; padding: 10px; background: #f8f9fa; border-radius: 8px; color: #2c3e50;">
            <strong>${v.name}</strong>
            <span style="font-size: 1.2em;">${temp}°C</span>
            <span style="font-size: 0.85em; color: #666;">Vent: ${vent} km/h</span>
          </div>
        `;
      }
    } catch (e) {
      console.error(`Erreur pour ${villeNom}`, e);
    }
  }
  resultatsHtml += "</div>";
  body.innerHTML = resultatsHtml;
}

if (btnFav) {
  btnFav.addEventListener("click", () => {
    if (!villeActuelleNom || villeActuelleNom === "Ma position") return;
    const favoris = getFavoris();
    const index = favoris.indexOf(villeActuelleNom);

    if (index === -1) {
      favoris.push(villeActuelleNom);
    } else {
      favoris.splice(index, 1);
    }
    sauvegarderFavoris(favoris);
  });
}

async function chargerMeteoParNom(nom) {
  if (!nom.trim()) return;
  messageStatut.textContent = `Recherche de "${nom}"...`;
  messageStatut.style.display = "block";
  suggestionsList.style.display = "none";
  setBoutonChargement(true);

  try {
    const results = await fetchCoordonnees(nom);
    if (results.length === 0) {
      messageStatut.textContent = "Aucune ville trouvée.";
      setBoutonChargement(false);
      return;
    }
    const ville = results[0];
    villeActuelleNom = ville.name;
    inputVille.value = "";

    const codePostal = ville.postcodes && ville.postcodes.length > 0 ? ` (${ville.postcodes[0]})` : "";
    const nomComplet = `${ville.name}${codePostal}, ${ville.country || ""}`;

    const data = await fetchMeteoComplete(ville.latitude, ville.longitude);

    saveWeatherData(data);

    afficherMeteoActuelle(data, nomComplet);
    afficherPrevisions(data.daily);
    afficherAlertePluie(data.hourly);
    actualiserBoutonFavori();

    localStorage.setItem("derniere_ville", ville.name);
  } catch (err) {
    messageStatut.textContent = "Erreur de chargement ou réseau instable.";
    console.error(err);
  } finally {
    setBoutonChargement(false);
  }
}

inputVille.addEventListener("input", () => {
  indexSuggestion = -1;
  clearTimeout(debounceTimer);
  const requete = inputVille.value.trim();

  if (requete.length < 2) {
    suggestionsList.style.display = "none";
    suggestionsList.innerHTML = "";
    return;
  }

  debounceTimer = setTimeout(async () => {
    try {
      const suggestions = await fetchCoordonnees(requete);
      if (!suggestions || suggestions.length === 0) {
        suggestionsList.style.display = "none";
        suggestionsList.innerHTML = "";
        return;
      }

      suggestionsList.innerHTML = suggestions
        .map((s) => {
          const cp = s.postcodes && s.postcodes.length > 0 ? ` (${s.postcodes[0]})` : "";
          return `<div class="suggestion-item" data-name="${s.name}">${s.name}${cp}, ${s.country || ""}</div>`;
        })
        .join("");

      suggestionsList.style.display = "block";

      suggestionsList.querySelectorAll(".suggestion-item").forEach((item) => {
        item.addEventListener("click", () => {
          const villeChoisie = item.dataset.name;
          suggestionsList.style.display = "none";
          suggestionsList.innerHTML = "";
          chargerMeteoParNom(villeChoisie);
        });
      });
    } catch (err) {
      console.error("Erreur autocomplétion :", err);
      suggestionsList.style.display = "none";
    }
  }, 250);
});

document.addEventListener("click", (e) => {
  if (!e.target.closest(".search-container")) {
    suggestionsList.style.display = "none";
  }
});

btnRechercher.addEventListener("click", () => chargerMeteoParNom(inputVille.value));

inputVille.addEventListener("keydown", (e) => {
  const items = suggestionsList.querySelectorAll(".suggestion-item");
  if (e.key === "ArrowDown") {
    e.preventDefault();
    if (items.length > 0) {
      indexSuggestion = (indexSuggestion + 1) % items.length;
      mettreAJourSelection(items);
    }
  } else if (e.key === "ArrowUp") {
    e.preventDefault();
    if (items.length > 0) {
      indexSuggestion = (indexSuggestion - 1 + items.length) % items.length;
      mettreAJourSelection(items);
    }
  } else if (e.key === "Enter") {
    e.preventDefault();
    suggestionsList.style.display = "none";
    if (indexSuggestion >= 0 && items[indexSuggestion]) {
      chargerMeteoParNom(items[indexSuggestion].dataset.name);
    } else {
      chargerMeteoParNom(inputVille.value);
    }
  }
});

function mettreAJourSelection(items) {
  items.forEach((item, index) => {
    item.style.background = index === indexSuggestion ? "#f1f2f6" : "transparent";
  });
}

function lancerGeolocalisation() {
  setBoutonChargement(true);
  navigator.geolocation.getCurrentPosition(
    async (pos) => {
      try {
        const { latitude, longitude } = pos.coords;
        const nomReel = await fetchNomParCoordonnees(latitude, longitude);
        const data = await fetchMeteoComplete(latitude, longitude);

        saveWeatherData(data);

        villeActuelleNom = nomReel;
        inputVille.value = "";
        afficherMeteoActuelle(data, `📍 ${nomReel}`);
        afficherPrevisions(data.daily);
        afficherAlertePluie(data.hourly);
        actualiserBoutonFavori();
      } catch (err) {
        console.error("Erreur de géolocalisation:", err);
      } finally {
        setBoutonChargement(false);
      }
    },
    () => {
      setBoutonChargement(false);
      alert("Impossible d'accéder à votre position.");
    },
  );
}

btnGeoloc.addEventListener("click", lancerGeolocalisation);

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("./sw.js").catch(() => {});
}

const btnFullscreen = document.querySelector("#btn-fullscreen");
if (btnFullscreen) {
  btnFullscreen.addEventListener("click", () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch((err) => {
        console.warn(`Erreur plein écran: ${err.message}`);
      });
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      }
    }
  });

  document.addEventListener("fullscreenchange", () => {
    btnFullscreen.textContent = document.fullscreenElement ? "🗗" : "⛶";
  });
}

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    document.querySelectorAll(".modal").forEach((m) => (m.style.display = "none"));
    suggestionsList.style.display = "none";
  }
});

afficherFavoris();
initialiserCarte();

// Gestion des paramètres d'URL (Raccourcis PWA)
const urlParams = new URLSearchParams(window.location.search);
const action = urlParams.get("action");

if (action === "geoloc") {
  lancerGeolocalisation();
} else if (action === "favoris") {
  ouvrirComparateurFavoris();
} else {
  const villeInitiale = localStorage.getItem("derniere_ville") || "Ichy";
  inputVille.value = villeInitiale;
  chargerMeteoParNom(villeInitiale);
}
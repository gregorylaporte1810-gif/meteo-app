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

// --- SÉLECTEURS HTML ---
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
let suggestionsActuelles = [];

// --- GESTION DES PRÉFÉRENCES & PROFIL ---
const PREFS_KEY = "meteo_preferences";

const defaultPreferences = {
  uniteTemp: "C",
  uniteVent: "kmh",
  villeDefaut: "",
  geolocAuto: false,
  theme: "sombre",
  alertesPluie: true,
};

export function getPreferences() {
  const sauv = localStorage.getItem(PREFS_KEY);
  return sauv ? { ...defaultPreferences, ...JSON.parse(sauv) } : defaultPreferences;
}

function chargerFormulairePreferences() {
  const prefs = getPreferences();
  document.querySelector("#pref-unite-temp").value = prefs.uniteTemp;
  document.querySelector("#pref-unite-vent").value = prefs.uniteVent;
  document.querySelector("#pref-ville-defaut").value = prefs.villeDefaut;
  document.querySelector("#pref-geoloc-auto").checked = prefs.geolocAuto;
  document.querySelector("#pref-theme").value = prefs.theme;
  document.querySelector("#pref-alertes-pluie").checked = prefs.alertesPluie;
}

function appliquerTheme(theme) {
  if (theme === "clair") {
    document.body.classList.add("theme-clair");
  } else if (theme === "sombre") {
    document.body.classList.remove("theme-clair");
  } else if (theme === "systeme") {
    const prefersLight = window.matchMedia("(prefers-color-scheme: light)").matches;
    document.body.classList.toggle("theme-clair", prefersLight);
  }
}

// --- LOGIQUE BOUTON RECHERCHE & ÉTATS ---
function setBoutonChargement(actif) {
  if (!btnRechercher) return;
  btnRechercher.innerHTML = actif ? "⏳" : "🔍";
  btnRechercher.disabled = actif;
}

if (btnRechercher) {
  btnRechercher.addEventListener("click", () =>
    chargerMeteoParNom(inputVille.value)
  );
}

if (btnGeoloc) {
  btnGeoloc.addEventListener("click", lancerGeolocalisation);
}

// --- FAVORIS ---
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
  favorisBar.innerHTML =
    favoris
      .map(
        (v) => `
    <span class="fav-badge">
      <span class="fav-label">${v}</span>
      <span class="fav-delete" data-ville="${v}" title="Supprimer">×</span>
    </span>
  `
      )
      .join("") +
    `<span class="fav-badge" id="btn-comparateur" style="background: #3498db; color: white; cursor: pointer;" title="Comparer les favoris">📊 Comparer</span>`;

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
    btnComp.onclick = ouvrirComparateurFavoris;
  }
}

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

// --- CHARGEMENT MÉTÉO ---
async function chargerMeteoParVilleObjet(ville) {
  messageStatut.textContent = `Chargement de "${ville.name}"...`;
  messageStatut.style.display = "block";
  suggestionsList.style.display = "none";
  setBoutonChargement(true);

  try {
    villeActuelleNom = ville.name;
    inputVille.value = "";

    const estUnPays =
      ville.feature_code === "PCLI" ||
      (ville.country && ville.country.toLowerCase() === ville.name.toLowerCase());

    let nomComplet = ville.name;

    if (!estUnPays) {
      const codePostal =
        ville.postcodes && ville.postcodes.length > 0
          ? ` (${ville.postcodes[0]})`
          : "";
      const pays = ville.country ? `, ${ville.country}` : "";
      nomComplet = `${ville.name}${codePostal}${pays}`;
    }

    const data = await fetchMeteoComplete(ville.latitude, ville.longitude);

    saveWeatherData(data);

    afficherMeteoActuelle(data, nomComplet);
    afficherPrevisions(data.daily);
    afficherAlertePluie(data.hourly);
    actualiserBoutonFavori();

    localStorage.setItem("derniere_ville", ville.name);
    messageStatut.style.display = "none";
  } catch (err) {
    messageStatut.textContent = "Erreur de chargement ou réseau instable.";
    console.error(err);
  } finally {
    setBoutonChargement(false);
  }
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
    await chargerMeteoParVilleObjet(results[0]);
  } catch (err) {
    messageStatut.textContent = "Erreur de chargement ou réseau instable.";
    console.error(err);
  } finally {
    setBoutonChargement(false);
  }
}

// --- AUTOCOMPLÉTION ---
inputVille.addEventListener("input", () => {
  indexSuggestion = -1;
  clearTimeout(debounceTimer);
  const requete = inputVille.value.trim();

  if (requete.length < 2) {
    suggestionsList.style.display = "none";
    suggestionsList.innerHTML = "";
    suggestionsActuelles = [];
    return;
  }

  debounceTimer = setTimeout(async () => {
    try {
      suggestionsActuelles = await fetchCoordonnees(requete);
      if (!suggestionsActuelles || suggestionsActuelles.length === 0) {
        suggestionsList.style.display = "none";
        suggestionsList.innerHTML = "";
        return;
      }

      suggestionsList.innerHTML = suggestionsActuelles
        .map((s, idx) => {
          const cp =
            s.postcodes && s.postcodes.length > 0 ? ` (${s.postcodes[0]})` : "";
          const suffixePays =
            s.country && s.country.toLowerCase() !== s.name.toLowerCase()
              ? `, ${s.country}`
              : "";
          return `<div class="suggestion-item" data-index="${idx}">${s.name}${cp}${suffixePays}</div>`;
        })
        .join("");

      suggestionsList.style.display = "block";

      suggestionsList.querySelectorAll(".suggestion-item").forEach((item) => {
        item.addEventListener("click", () => {
          const idx = parseInt(item.dataset.index, 10);
          const villeChoisie = suggestionsActuelles[idx];
          suggestionsList.style.display = "none";
          suggestionsList.innerHTML = "";
          if (villeChoisie) {
            chargerMeteoParVilleObjet(villeChoisie);
          }
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
    if (indexSuggestion >= 0 && suggestionsActuelles[indexSuggestion]) {
      chargerMeteoParVilleObjet(suggestionsActuelles[indexSuggestion]);
    } else {
      chargerMeteoParNom(inputVille.value);
    }
  }
});

function mettreAJourSelection(items) {
  items.forEach((item, index) => {
    item.style.background =
      index === indexSuggestion ? "#f1f2f6" : "transparent";
  });
}

// --- GÉOLOCALISATION & DIVERS ---
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
        messageStatut.style.display = "none";
      } catch (err) {
        console.error("Erreur de géolocalisation:", err);
      } finally {
        setBoutonChargement(false);
      }
    },
    () => {
      setBoutonChargement(false);
      alert("Impossible d'accéder à votre position.");
    }
  );
}

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
    } else if (document.exitFullscreen) {
      document.exitFullscreen();
    }
  });

  document.addEventListener("fullscreenchange", () => {
    btnFullscreen.textContent = document.fullscreenElement ? "🗗" : "⛶";
  });
}

// --- GESTION DES MODALES (CARTE & DÉTAILS) ---
const btnMap = document.querySelector("#btn-map");
const modalMap = document.querySelector("#modal-map");
const btnCloseMap = document.querySelector("#modal-map-close");
const modalDetails = document.querySelector("#modal-details");
const btnCloseDetails = document.querySelector("#modal-close");

if (btnMap && modalMap) {
  btnMap.addEventListener("click", () => {
    modalMap.style.display = "flex";
  });
}

if (btnCloseMap && modalMap) {
  btnCloseMap.addEventListener("click", () => {
    modalMap.style.display = "none";
  });
}

if (btnCloseDetails && modalDetails) {
  btnCloseDetails.addEventListener("click", () => {
    modalDetails.style.display = "none";
  });
}

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    document
      .querySelectorAll(".modal")
      .forEach((m) => (m.style.display = "none"));
    suggestionsList.style.display = "none";
  }
});

// --- MODALE PROFIL (ÉVÉNEMENTS) ---
const btnProfil = document.querySelector("#btn-profil");
const modalProfil = document.querySelector("#modal-profil");
const btnCloseProfil = document.querySelector("#modal-profil-close");
const formPreferences = document.querySelector("#form-preferences");

if (btnProfil && modalProfil) {
  btnProfil.addEventListener("click", () => {
    chargerFormulairePreferences();
    modalProfil.style.display = "flex";
  });

  if (btnCloseProfil) {
    btnCloseProfil.addEventListener("click", () => {
      modalProfil.style.display = "none";
    });
  }

  if (formPreferences) {
    formPreferences.addEventListener("submit", (e) => {
      e.preventDefault();
      const nouvellesPrefs = {
        uniteTemp: document.querySelector("#pref-unite-temp").value,
        uniteVent: document.querySelector("#pref-unite-vent").value,
        villeDefaut: document.querySelector("#pref-ville-defaut").value.trim(),
        geolocAuto: document.querySelector("#pref-geoloc-auto").checked,
        theme: document.querySelector("#pref-theme").value,
        alertesPluie: document.querySelector("#pref-alertes-pluie").checked,
      };

      localStorage.setItem(PREFS_KEY, JSON.stringify(nouvellesPrefs));
      appliquerTheme(nouvellesPrefs.theme);
      modalProfil.style.display = "none";

      if (villeActuelleNom) {
        chargerMeteoParNom(villeActuelleNom);
      }
    });
  }
}

// --- INITIALISATION DE L'APPLICATION ---
afficherFavoris();
initialiserCarte();
appliquerTheme(getPreferences().theme);

const urlParams = new URLSearchParams(window.location.search);
const action = urlParams.get("action");
const prefs = getPreferences();

if (action === "geoloc" || prefs.geolocAuto) {
  lancerGeolocalisation();
} else if (action === "favoris") {
  ouvrirComparateurFavoris();
} else {
  const villeInitiale = prefs.villeDefaut || localStorage.getItem("derniere_ville") || "Ichy";
  inputVille.value = villeInitiale;
  chargerMeteoParNom(villeInitiale);
}
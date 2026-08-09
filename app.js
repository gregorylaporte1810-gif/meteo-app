import { fetchCoordonnees, fetchMeteoComplete } from './api.js';
import { afficherMeteoActuelle, afficherPrevisions, afficherAlertePluie } from './ui.js';

const inputVille = document.querySelector("#input-ville");
const btnRechercher = document.querySelector("#btn-rechercher");
const btnGeoloc = document.querySelector("#btn-geoloc");
const btnFav = document.querySelector("#btn-toggle-favori");
const suggestionsList = document.querySelector("#suggestions-list");
const favorisBar = document.querySelector("#favoris-bar");
const messageStatut = document.querySelector("#message-statut");

let villeActuelleNom = "";
let debounceTimer = null;

// --- GESTION DES FAVORIS ---
function getFavoris() {
  return JSON.parse(localStorage.getItem("favoris_meteo")) || ["Paris", "Lyon", "Marseille"];
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

function afficherFavoris() {
  const favoris = getFavoris();
  favorisBar.innerHTML = favoris.map(v => `
    <span class="fav-badge">
      <span class="fav-label">${v}</span>
      <span class="fav-delete" data-ville="${v}" title="Supprimer">×</span>
    </span>
  `).join('');
  
  // Clic sur le nom pour charger la météo
  document.querySelectorAll(".fav-label").forEach(label => {
    label.addEventListener("click", () => {
      inputVille.value = label.textContent;
      chargerMeteoParNom(label.textContent);
    });
  });

  // Clic sur la croix pour supprimer le favori
  document.querySelectorAll(".fav-delete").forEach(delBtn => {
    delBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      const villeASupprimer = delBtn.dataset.ville;
      const liste = getFavoris().filter(v => v !== villeASupprimer);
      sauvegarderFavoris(liste);
    });
  });
}

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

// --- CHARGEMENT MÉTÉO ---
async function chargerMeteoParNom(nom) {
  if (!nom.trim()) return;
  messageStatut.textContent = `Recherche de "${nom}"...`;
  messageStatut.style.display = "block";
  suggestionsList.style.display = "none";

  try {
    const results = await fetchCoordonnees(nom);
    if (results.length === 0) {
      messageStatut.textContent = "Aucune ville trouvée.";
      return;
    }
    const ville = results[0];
    villeActuelleNom = ville.name;
    inputVille.value = ville.name; // Garde le nom propre dans la barre
    const nomComplet = `${ville.name}, ${ville.country || ""}`;

    const data = await fetchMeteoComplete(ville.latitude, ville.longitude);
    afficherMeteoActuelle(data, nomComplet);
    afficherPrevisions(data.daily);
    afficherAlertePluie(data.hourly);
    actualiserBoutonFavori();

    localStorage.setItem("derniere_ville", ville.name);
  } catch (err) {
    messageStatut.textContent = "Erreur de chargement.";
    console.error(err);
  }
}

// --- AUTOCOMPLÉTION ---
inputVille.addEventListener("input", () => {
  clearTimeout(debounceTimer);
  const requete = inputVille.value.trim();

  if (requete.length < 2) {
    suggestionsList.style.display = "none";
    return;
  }

  debounceTimer = setTimeout(async () => {
    const suggestions = await fetchCoordonnees(requete);
    if (suggestions.length === 0) {
      suggestionsList.style.display = "none";
      return;
    }

    suggestionsList.innerHTML = suggestions.map(s => `
      <div class="suggestion-item" data-name="${s.name}">${s.name} (${s.country || ""})</div>
    `).join('');
    suggestionsList.style.display = "block";

    document.querySelectorAll(".suggestion-item").forEach(item => {
      item.addEventListener("click", () => {
        inputVille.value = item.dataset.name;
        suggestionsList.style.display = "none";
        chargerMeteoParNom(item.dataset.name);
      });
    });
  }, 250);
});

// Masquer les suggestions au clic en dehors
document.addEventListener("click", (e) => {
  if (!e.target.closest(".search-container")) {
    suggestionsList.style.display = "none";
  }
});

// --- ÉVÉNEMENTS GLOBAUX ---
btnRechercher.addEventListener("click", () => chargerMeteoParNom(inputVille.value));
inputVille.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    suggestionsList.style.display = "none";
    chargerMeteoParNom(inputVille.value);
  }
});

btnGeoloc.addEventListener("click", () => {
  navigator.geolocation.getCurrentPosition(async (pos) => {
    const { latitude, longitude } = pos.coords;
    const data = await fetchMeteoComplete(latitude, longitude);
    villeActuelleNom = "Ma position";
    inputVille.value = "";
    afficherMeteoActuelle(data, "Ma position actuelle");
    afficherPrevisions(data.daily);
    afficherAlertePluie(data.hourly);
    actualiserBoutonFavori();
  });
});

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js').catch(() => {});
}

// Lancement initial
afficherFavoris();
const villeInitiale = localStorage.getItem("derniere_ville") || "Paris";
inputVille.value = villeInitiale;
chargerMeteoParNom(villeInitiale);
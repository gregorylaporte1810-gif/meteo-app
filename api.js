// Fonction utilitaire pour éviter que la requête tourne dans le vide indéfiniment
async function fetchAvecTimeout(url, timeout = 8000) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  try {
    const reponse = await fetch(url, { signal: controller.signal });
    clearTimeout(id);
    return reponse;
  } catch (err) {
    clearTimeout(id);
    throw new Error("Délai d'attente dépassé ou réseau instable.");
  }
}

export async function fetchCoordonnees(nomVille) {
  const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(nomVille)}&count=5&language=fr&format=json`;
  const reponse = await fetchAvecTimeout(url);
  const data = await reponse.json();
  return data.results || [];
}

export async function fetchMeteoComplete(latitude, longitude) {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,rain,showers,weather_code,wind_speed_10m,wind_gusts_10m,wind_direction_10m,surface_pressure,uv_index,is_day&daily=temperature_2m_max,temperature_2m_min,sunrise,sunset,uv_index_max,weather_code,moon_phase&timezone=auto`;

    const response = await fetch(url);
    if (!response.ok) {
        throw new Error("Erreur lors de la récupération des données météo");
    }
    return await response.json();
}

export async function fetchNomParCoordonnees(lat, lon) {
  try {
    // zoom=14 permet de cibler spécifiquement les villages, bourgs et villes
    const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=14&accept-language=fr`;
    const reponse = await fetchAvecTimeout(url, 5000);
    const data = await reponse.json();

    if (data && data.address) {
      const addr = data.address;
      // Recherche prioritaire du nom exact de la commune/village
      return (
        addr.village ||
        addr.town ||
        addr.hamlet ||
        addr.city ||
        addr.municipality ||
        addr.suburb ||
        addr.county ||
        "Position actuelle"
      );
    }
    return "Position actuelle";
  } catch (err) {
    return "Position actuelle";
  }
}
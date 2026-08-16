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

export async function fetchMeteoComplete(lat, lon) {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,rain,showers,weather_code,cloud_cover,wind_speed_10m,wind_direction_10m,wind_gusts_10m,uv_index,is_day&hourly=temperature_2m,weather_code,precipitation,precipitation_probability&daily=weather_code,temperature_2m_max,temperature_2m_min,sunrise,sunset,moon_phase&timezone=auto`;
  
  const reponse = await fetch(url);
  if (!reponse.ok) throw new Error("Erreur réseau météo");
  return await reponse.json();
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
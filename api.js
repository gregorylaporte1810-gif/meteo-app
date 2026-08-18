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
  // Récupérer les préférences stockées dans le localStorage
  const prefs = JSON.parse(localStorage.getItem("meteo_preferences")) || {
    uniteTemp: "C",
    uniteVent: "kmh",
  };

  // Adapter les valeurs pour l'API Open-Meteo
  const tempUnit =
    prefs.uniteTemp === "F" || prefs.uniteTemp.toLowerCase().includes("fahrenheit")
      ? "fahrenheit"
      : "celsius";
  const windUnit = prefs.uniteVent; // "kmh", "mph", "ms", "knots"

  // URL avec les paramètres dynamiques d'unités
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m,wind_direction_10m,surface_pressure&hourly=temperature_2m,precipitation_probability,weather_code,uv_index&daily=weather_code,temperature_2m_max,temperature_2m_min,sunrise,sunset,uv_index_max&temperature_unit=${tempUnit}&windspeed_unit=${windUnit}&timezone=auto`;

  // CORRECTION : Utilisation de l'utilitaire sécurisé au lieu d'un fetch standard
  const response = await fetchAvecTimeout(url);
  if (!response.ok) {
    throw new Error("Erreur réseau lors de la récupération de la météo.");
  }
  return await response.json();
}

export async function fetchNomParCoordonnees(lat, lon) {
  try {
    // CORRECTION : zoom=12 cible l'échelle des villes/agglomérations
    const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=12&accept-language=fr`;
    const reponse = await fetchAvecTimeout(url, 5000);
    const data = await reponse.json();

    if (data && data.address) {
      // Retourne la ville, le village, ou à défaut le pays
      return (
        data.address.city ||
        data.address.town ||
        data.address.village ||
        data.address.municipality ||
        data.address.country ||
        "Position actuelle"
      );
    }
    return "Position actuelle";
  } catch (err) {
    return "Position actuelle";
  }
}

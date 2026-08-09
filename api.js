export async function fetchCoordonnees(nomVille) {
  const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(nomVille)}&count=5&language=fr&format=json`;
  const reponse = await fetch(url);
  const data = await reponse.json();
  return data.results || [];
}

export async function fetchMeteoComplete(lat, lon) {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m,wind_direction_10m,wind_gusts_10m,surface_pressure,is_day,uv_index&hourly=temperature_2m,weather_code,precipitation_probability&daily=temperature_2m_max,temperature_2m_min,weather_code,sunrise,sunset,uv_index_max&timezone=auto`;
  const reponse = await fetch(url);
  return await reponse.json();
}
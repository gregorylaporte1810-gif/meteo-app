export async function fetchMeteoComplete(latitude, longitude) {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,rain,showers,weather_code,wind_speed_10m,wind_gusts_10m,wind_direction_10m,surface_pressure,uv_index,is_day&daily=temperature_2m_max,temperature_2m_min,sunrise,sunset,uv_index_max,weather_code,moon_phase&timezone=auto`;

    const response = await fetch(url);
    if (!response.ok) {
        throw new Error("Erreur lors de la récupération des données météo");
    }
    return await response.json();
}
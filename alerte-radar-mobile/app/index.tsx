import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View, ActivityIndicator, SafeAreaView, ScrollView, TextInput, TouchableOpacity } from 'react-native';
import * as Location from 'expo-location';

const codesMeteo: { [key: number]: { texte: string; icone: string } } = {
  0: { texte: "Ciel dégagé", icone: "☀️" },
  1: { texte: "Principalement dégagé", icone: "🌤️" },
  2: { texte: "Partiellement nuageux", icone: "⛅" },
  3: { texte: "Couvert", icone: "☁️" },
  45: { texte: "Brouillard", icone: "🌫️" },
  51: { texte: "Bruine", icone: "🌦️" },
  61: { texte: "Pluie modérée", icone: "🌧️" },
  63: { texte: "Forte pluie", icone: "🌧️" },
  71: { texte: "Chutes de neige", icone: "❄️" },
  95: { texte: "Orage", icone: "⛈️" },
};

export default function HomeScreen() {
    const [weather, setWeather] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);
    const [cityName, setCityName] = useState("Ma Position");
    const [query, setQuery] = useState("");
    
    // Vos favoris intégrés (avec Ichy par défaut)
    const [favorites] = useState([
        { name: "Ichy", lat: 48.2333, lon: 2.5333 }
    ]);

    const fetchWeatherData = async (lat: number, lon: number, name: string) => {
        setLoading(true);
        try {
            const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m,wind_direction_10m,wind_gusts_10m,surface_pressure,uv_index,is_day&hourly=temperature_2m,weather_code,precipitation_probability&daily=temperature_2m_max,temperature_2m_min,weather_code,sunrise,sunset,uv_index_max&timezone=auto`;
            const response = await fetch(url);
            const data = await response.json();
            setWeather(data);
            setCityName(name);
        } catch (err) {
            setErrorMsg('Erreur de chargement des données météo');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        (async () => {
            let { status } = await Location.requestForegroundPermissionsAsync();
            if (status !== 'granted') {
                fetchWeatherData(48.2333, 2.5333, "Ichy (77890)");
                return;
            }

            try {
                let location = await Location.getCurrentPositionAsync({});
                const { latitude, longitude } = location.coords;
                fetchWeatherData(latitude, longitude, "Ma Position");
            } catch (err) {
                fetchWeatherData(48.2333, 2.5333, "Ichy (77890)");
            }
        })();
    }, []);

    const handleSearch = async () => {
        if (!query.trim()) return;
        try {
            const geoUrl = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=1&language=fr&format=json`;
            const res = await fetch(geoUrl);
            const data = await res.json();
            if (data.results && data.results.length > 0) {
                const loc = data.results[0];
                fetchWeatherData(loc.latitude, loc.longitude, `${loc.name} (${loc.country || ''})`);
                setQuery("");
            }
        } catch (e) {
            console.error(e);
        }
    };

    const evaluateStrollerWalk = (temp: number, code: number, wind: number) => {
        const isNoRain = code < 50;
        const isGoodTemp = temp >= 12 && temp <= 26;
        const isLowWind = wind < 20;

        if (isNoRain && isGoodTemp && isLowWind) {
            return { text: "Idéal pour la poussette 👶", style: styles.badgeIdeal };
        } else if (isNoRain && wind < 30) {
            return { text: "Correct (couvrir un peu) 🌤️", style: styles.badgeModerate };
        } else {
            return { text: "Conditions non idéales 🌧️", style: styles.badgePoor };
        }
    };

    if (loading && !weather) {
        return (
            <View style={styles.containerCenter}>
                <ActivityIndicator size="large" color="#ffffff" />
            </View>
        );
    }

    const current = weather?.current;
    const hourly = weather?.hourly;
    const daily = weather?.daily;
    const codeInfo = current ? (codesMeteo[current.weather_code] || { texte: "Variable", icone: "🌡️" }) : null;
    const strollerEval = current ? evaluateStrollerWalk(current.temperature_2m, current.weather_code, current.wind_speed_10m) : null;

    return (
        <SafeAreaView style={styles.container}>
            <ScrollView contentContainerStyle={styles.scrollContainer} showsVerticalScrollIndicator={false}>
                
                {/* Barre de recherche */}
                <View style={styles.searchContainer}>
                    <TextInput
                        style={styles.searchInput}
                        placeholder="Rechercher une ville..."
                        placeholderTextColor="#999"
                        value={query}
                        onChangeText={setQuery}
                        onSubmitEditing={handleSearch}
                    />
                    <TouchableOpacity style={styles.searchButton} onPress={handleSearch}>
                        <Text style={styles.searchButtonText}>🔍</Text>
                    </TouchableOpacity>
                </View>

                {/* Barre de favoris */}
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.favorisBar}>
                    {favorites.map((fav, index) => (
                        <TouchableOpacity key={index} style={styles.favBadge} onPress={() => fetchWeatherData(fav.lat, fav.lon, fav.name)}>
                            <Text style={styles.favLabel}>⭐ {fav.name}</Text>
                        </TouchableOpacity>
                    ))}
                </ScrollView>

                {/* Carte Météo Principale */}
                <View style={styles.weatherCard}>
                    
                    {/* Nom de la ville */}
                    <View style={styles.headerCity}>
                        <Text style={styles.cityName}>{cityName}</Text>
                    </View>

                    {/* Bloc Météo Actuel (Héros) */}
                    {current && codeInfo && (
                        <View style={styles.heroMeteo}>
                            <Text style={styles.weatherIcon}>{codeInfo.icone}</Text>
                            <Text style={styles.temp}>{Math.round(current.temperature_2m)}°C</Text>
                            <Text style={styles.description}>{codeInfo.texte}</Text>
                        </View>
                    )}

                    {/* Badge Poussette */}
                    {strollerEval && (
                        <View style={[styles.badge, strollerEval.style]}>
                            <Text style={styles.badgeText}>{strollerEval.text}</Text>
                        </View>
                    )}

                    {/* Grille des détails (Vent, Humidité, Coucher, UV) */}
                    {current && (
                        <View style={styles.detailsGrid}>
                            <View style={styles.detailItem}>
                                <Text style={styles.detailLabel}>Vent</Text>
                                <Text style={styles.detailValue}>{current.wind_speed_10m} km/h</Text>
                            </View>
                            <View style={styles.detailItem}>
                                <Text style={styles.detailLabel}>Humidité</Text>
                                <Text style={styles.detailValue}>{current.relative_humidity_2m}%</Text>
                            </View>
                            <View style={styles.detailItem}>
                                <Text style={styles.detailLabel}>Coucher</Text>
                                <Text style={styles.detailValue}>
                                    {daily?.sunset ? daily.sunset[0].split('T')[1] : '--:--'}
                                </Text>
                            </View>
                            <View style={styles.detailItem}>
                                <Text style={styles.detailLabel}>Indice UV</Text>
                                <Text style={styles.detailValue}>{Math.round(current.uv_index || 0)} / 11</Text>
                            </View>
                        </View>
                    )}

                    {/* Prévisions horaires */}
                    {hourly && (
                        <View style={styles.sectionContainer}>
                            <Text style={styles.sectionTitle}>Prochaines heures</Text>
                            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.hourlyScroll}>
                                {hourly.time.slice(0, 18).map((time: string, index: number) => {
                                    const heure = new Date(time).getHours() + 'h';
                                    const tempHoraire = Math.round(hourly.temperature_2m[index]);
                                    const codeH = hourly.weather_code[index];
                                    const iconeH = (codesMeteo[codeH] || {}).icone || "🌡️";
                                    return (
                                        <View key={index} style={styles.hourlyCard}>
                                            <Text style={styles.hourlyHour}>{heure}</Text>
                                            <Text style={{fontSize: 18}}>{iconeH}</Text>
                                            <Text style={styles.hourlyTemp}>{tempHoraire}°</Text>
                                        </View>
                                    );
                                })}
                            </ScrollView>
                        </View>
                    )}

                    {/* Prévisions sur 7 jours */}
                    {daily && (
                        <View style={styles.sectionContainer}>
                            <Text style={styles.sectionTitle}>Prévisions sur 7 jours</Text>
                            <View style={styles.previsionsGrid}>
                                {daily.time.slice(1, 6).map((date: string, index: number) => {
                                    const jour = new Date(date).toLocaleDateString('fr-FR', { weekday: 'short' });
                                    const max = Math.round(daily.temperature_2m_max[index + 1]);
                                    const min = Math.round(daily.temperature_2m_min[index + 1]);
                                    const codeD = daily.weather_code[index + 1];
                                    const iconeD = (codesMeteo[codeD] || {}).icone || "🌡️";
                                    return (
                                        <View key={index} style={styles.previsionItem}>
                                            <Text style={styles.prevJour}>{jour}</Text>
                                            <Text style={{fontSize: 16}}>{iconeD}</Text>
                                            <Text style={styles.prevTemp}>{max}°/{min}°</Text>
                                        </View>
                                    );
                                })}
                            </View>
                        </View>
                    )}

                </View>
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#0f2027' },
    containerCenter: { flex: 1, backgroundColor: '#0f2027', justifyContent: 'center', alignItems: 'center' },
    scrollContainer: { padding: 16, alignItems: 'center' },
    searchContainer: { flexDirection: 'row', width: '100%', maxWidth: 450, marginBottom: 10, gap: 8 },
    searchInput: { flex: 1, backgroundColor: 'rgba(255,255,255,0.9)', padding: 10, borderRadius: 12, fontSize: 14, color: '#333' },
    searchButton: { backgroundColor: '#2a5298', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 14, borderRadius: 12 },
    searchButtonText: { fontSize: 16 },
    favorisBar: { flexDirection: 'row', marginBottom: 14, width: '100%', maxWidth: 450 },
    favBadge: { backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 14, marginRight: 8 },
    favLabel: { color: '#fff', fontSize: 13, fontWeight: '500' },
    weatherCard: {
        backgroundColor: 'rgba(255, 255, 255, 0.95)',
        borderRadius: 24,
        padding: 20,
        width: '100%',
        maxWidth: 450,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.25,
        shadowRadius: 15,
        elevation: 8,
    },
    headerCity: { alignItems: 'center', marginBottom: 10 },
    cityName: { fontSize: 20, fontWeight: 'bold', color: '#2c3e50' },
    heroMeteo: { alignItems: 'center', marginBottom: 14 },
    weatherIcon: { fontSize: 50, marginVertical: 4 },
    temp: { fontSize: 48, fontWeight: '800', color: '#1e272e' },
    description: { color: '#7f8c8d', fontSize: 15 },
    badge: { paddingVertical: 10, paddingHorizontal: 14, borderRadius: 14, marginBottom: 16, alignItems: 'center' },
    badgeIdeal: { backgroundColor: '#e1f5fe' },
    badgeModerate: { backgroundColor: '#fff9c4' },
    badgePoor: { backgroundColor: '#ffebee' },
    badgeText: { fontWeight: '600', fontSize: 14, textAlign: 'center' },
    detailsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 16 },
    detailItem: { flex: 1, minWidth: '45%', backgroundColor: '#f8f9fa', padding: 12, borderRadius: 14, alignItems: 'center' },
    detailLabel: { fontSize: 12, color: '#7f8c8d', marginBottom: 4 },
    detailValue: { fontSize: 15, fontWeight: 'bold', color: '#2c3e50' },
    sectionContainer: { marginTop: 12 },
    sectionTitle: { fontSize: 14, fontWeight: 'bold', color: '#2c3e50', marginBottom: 8 },
    hourlyScroll: { flexDirection: 'row', paddingBottom: 4 },
    hourlyCard: { backgroundColor: '#f8f9fa', padding: 8, borderRadius: 12, alignItems: 'center', marginRight: 8, minWidth: 55 },
    hourlyHour: { fontSize: 11, color: '#7f8c8d', marginBottom: 4 },
    hourlyTemp: { fontSize: 13, fontWeight: 'bold', color: '#1e272e' },
    previsionsGrid: { flexDirection: 'row', justifyContent: 'space-between', backgroundColor: '#f8f9fa', padding: 10, borderRadius: 14 },
    previsionItem: { alignItems: 'center', gap: 4 },
    prevJour: { fontSize: 11, color: '#7f8c8d', fontWeight: 'bold' },
    prevTemp: { fontSize: 12, fontWeight: 'bold', color: '#1e272e' },
    errorText: { color: '#ef4444', fontSize: 16, textAlign: 'center' },
});
import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View, ActivityIndicator, SafeAreaView } from 'react-native';
import * as Location from 'expo-location';
import { fetchMeteoComplete } from '../api/weatherApi';
import StrollerBadge from '../components/StrollerBadge';

export default function HomeScreen() {
    const [weather, setWeather] = useState(null);
    const [loading, setLoading] = useState(true);
    const [errorMsg, setErrorMsg] = useState(null);

    useEffect(() => {
        (async () => {
            let { status } = await Location.requestForegroundPermissionsAsync();
            if (status !== 'granted') {
                setErrorMsg('Permission de géolocalisation refusée');
                setLoading(false);
                return;
            }

            try {
                let location = await Location.getCurrentPositionAsync({});
                const data = await fetchMeteoComplete(
                    location.coords.latitude,
                    location.coords.longitude
                );
                setWeather(data);
            } catch (err) {
                setErrorMsg('Erreur de chargement des données météo');
            } finally {
                setLoading(false);
            }
        })();
    }, []);

    if (loading) {
        return (
            <View style={styles.container}>
                <ActivityIndicator size="large" color="#ffffff" />
            </View>
        );
    }

    if (errorMsg) {
        return (
            <View style={styles.container}>
                <Text style={styles.errorText}>{errorMsg}</Text>
            </View>
        );
    }

    const current = weather?.current;

    return (
        <SafeAreaView style={styles.container}>
            <Text style={styles.title}>Météo Native</Text>
            {current && (
                <View style={styles.weatherBox}>
                    <Text style={styles.temp}>{Math.round(current.temperature_2m)}°C</Text>
                    <StrollerBadge 
                        temp={current.temperature_2m} 
                        weatherCode={current.weather_code} 
                        windSpeed={current.wind_speed_10m} 
                    />
                </View>
            )}
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#0f172a', alignItems: 'center', justifyContent: 'center' },
    title: { color: '#ffffff', fontSize: 22, fontWeight: 'bold', marginBottom: 20 },
    weatherBox: { alignItems: 'center' },
    temp: { color: '#ffffff', fontSize: 48, fontWeight: 'bold' },
    errorText: { color: '#ef4444', fontSize: 16 },
});
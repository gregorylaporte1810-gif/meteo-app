import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

export default function StrollerBadge({ temp, weatherCode, windSpeed }) {
    const evaluateStrollerWalk = (t, code, wind) => {
        const isNoRain = code < 50;
        const isGoodTemp = t >= 12 && t <= 26;
        const isLowWind = wind < 20;

        if (isNoRain && isGoodTemp && isLowWind) {
            return { text: "Idéal pour la poussette 👶", style: styles.ideal };
        } else if (isNoRain && wind < 30) {
            return { text: "Correct (couvrir un peu) 🌤️", style: styles.moderate };
        } else {
            return { text: "Conditions non idéales 🌧️", style: styles.poor };
        }
    };

    const evalResult = evaluateStrollerWalk(temp, weatherCode, windSpeed);

    return (
        <View style={[styles.badge, evalResult.style]}>
            <Text style={styles.badgeText}>{evalResult.text}</Text>
        </View>
    );
}

const styles = StyleSheet.create({
    badge: {
        paddingVertical: 8,
        paddingHorizontal: 14,
        borderRadius: 8,
        marginVertical: 10,
        alignSelf: 'center',
    },
    badgeText: { fontWeight: 'bold', fontSize: 14 },
    ideal: { backgroundColor: '#e1f5fe' },
    moderate: { backgroundColor: '#fff9c4' },
    poor: { backgroundColor: '#ffebee' },
});
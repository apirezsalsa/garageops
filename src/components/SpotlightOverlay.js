import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, Animated, Dimensions, Platform } from 'react-native';
import { useTranslation } from 'react-i18next';
import { ChevronRight, Check, Layout, Bike, Wrench, ShieldCheck, Zap, Plus, Search, Gauge, Home, ClipboardList, Share2 } from 'lucide-react-native';

const { width, height } = Dimensions.get('window');

const ICON_MAP = {
    'layout': Layout,
    'bike': Bike,
    'wrench': Wrench,
    'shield': ShieldCheck,
    'zap': Zap,
    'plus': Plus,
    'search': Search,
    'gauge': Gauge,
    'home': Home,
    'history': ClipboardList,
    'share': Share2,
};

const SpotlightOverlay = ({ visible, steps, onFinished }) => {
    const { t } = useTranslation();
    const [currentStepIndex, setCurrentStepIndex] = useState(0);
    const fadeAnim = useRef(new Animated.Value(0)).current;
    const slideAnim = useRef(new Animated.Value(50)).current;

    const currentStep = steps[currentStepIndex];

    useEffect(() => {
        if (visible) {
            animateIn();
        }
    }, [visible, currentStepIndex]);

    const animateIn = () => {
        fadeAnim.setValue(0);
        slideAnim.setValue(30);
        Animated.parallel([
            Animated.timing(fadeAnim, {
                toValue: 1,
                duration: 400,
                useNativeDriver: true,
            }),
            Animated.spring(slideAnim, {
                toValue: 0,
                tension: 50,
                friction: 8,
                useNativeDriver: true,
            })
        ]).start();
    };

    const handleNext = () => {
        if (currentStepIndex < steps.length - 1) {
            setCurrentStepIndex(currentStepIndex + 1);
        } else {
            handleFinish();
        }
    };

    const handleFinish = () => {
        Animated.timing(fadeAnim, {
            toValue: 0,
            duration: 300,
            useNativeDriver: true,
        }).start(() => {
            setCurrentStepIndex(0);
            onFinished();
        });
    };

    if (!visible || !currentStep) return null;

    const StepIcon = currentStep.icon ? (ICON_MAP[currentStep.icon] || Layout) : Layout;

    return (
        <Modal transparent visible={visible} animationType="none">
            <View style={styles.container}>
                {/* Visual Backdrop */}
                <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.85)' }]} />

                <Animated.View
                    style={[
                        styles.content,
                        {
                            opacity: fadeAnim,
                            transform: [{ translateY: slideAnim }]
                        }
                    ]}
                >
                    <View style={styles.card}>
                        <View style={styles.iconCircle}>
                            <StepIcon size={40} color="#F2780D" />
                        </View>

                        <Text style={styles.title}>{t(currentStep.title)}</Text>
                        <Text style={styles.description}>{t(currentStep.description)}</Text>

                        {/* Pagination Dots */}
                        <View style={styles.dotsContainer}>
                            {steps.map((_, index) => (
                                <View
                                    key={index}
                                    style={[
                                        styles.dot,
                                        index === currentStepIndex ? styles.activeDot : null
                                    ]}
                                />
                            ))}
                        </View>

                        <View style={styles.footer}>
                            <TouchableOpacity onPress={handleFinish} style={styles.skipButton}>
                                <Text style={styles.skipText}>{t('skip', 'Saltar')}</Text>
                            </TouchableOpacity>

                            <TouchableOpacity onPress={handleNext} style={styles.nextButton}>
                                <Text style={styles.nextText}>
                                    {currentStepIndex === steps.length - 1 ? t('finish', 'Entendido') : t('next', 'Siguiente')}
                                </Text>
                                {currentStepIndex === steps.length - 1 ? (
                                    <Check size={18} color="#121212" />
                                ) : (
                                    <ChevronRight size={18} color="#121212" />
                                )}
                            </TouchableOpacity>
                        </View>
                    </View>
                </Animated.View>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 24,
    },
    content: {
        width: '100%',
        maxWidth: 400,
    },
    card: {
        backgroundColor: '#1E1E1E',
        borderRadius: 32,
        padding: 32,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#333',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 20 },
        shadowOpacity: 0.5,
        shadowRadius: 30,
        elevation: 10,
    },
    iconCircle: {
        width: 100,
        height: 100,
        borderRadius: 50,
        backgroundColor: 'rgba(242, 120, 13, 0.1)',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 24,
        borderWidth: 1,
        borderColor: 'rgba(242, 120, 13, 0.3)',
    },
    title: {
        fontSize: 26,
        fontWeight: 'bold',
        color: '#FFF',
        marginBottom: 16,
        textAlign: 'center',
    },
    description: {
        fontSize: 16,
        color: '#AAA',
        lineHeight: 24,
        textAlign: 'center',
        marginBottom: 32,
    },
    dotsContainer: {
        flexDirection: 'row',
        marginBottom: 32,
    },
    dot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: '#333',
        marginHorizontal: 4,
    },
    activeDot: {
        backgroundColor: '#F2780D',
        width: 24,
    },
    footer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        width: '100%',
    },
    skipButton: {
        paddingVertical: 12,
        paddingHorizontal: 8,
    },
    skipText: {
        color: '#666',
        fontSize: 15,
        fontWeight: '600',
    },
    nextButton: {
        backgroundColor: '#F2780D',
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 28,
        paddingVertical: 14,
        borderRadius: 16,
        shadowColor: '#F2780D',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
    },
    nextText: {
        color: '#121212',
        fontWeight: 'bold',
        fontSize: 16,
        marginRight: 6,
    },
});

export default SpotlightOverlay;

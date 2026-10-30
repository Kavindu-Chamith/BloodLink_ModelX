import { useThemedStyles } from '../theme/useThemedStyles';
import type { AppColors } from '../theme/palette';
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  StatusBar,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const { width } = Dimensions.get('window');

interface OnboardingCarouselScreenProps {
  onComplete: () => void;
  onSignIn: () => void;
}

const slides = [
  {
    id: 1,
    tag: 'Smart Matching',
    title: 'Your donation\nreaches who needs\nit most',
    description:
      'BloodLink privately matches you with blood requests from verified hospitals near you.',
    image: require('../../assets/images/onboarding1.jpg'),
    buttonText: 'Next',
  },
  {
    id: 2,
    tag: 'Verified & Secure',
    title: 'Every request\ncomes from a\nverified hospital',
    description:
      'All institutions are administrator-verified before they can create blood requests on BloodLink.',
    image: require('../../assets/images/onboarding2.jpg'),
    buttonText: 'Next',
  },
  {
    id: 3,
    tag: 'Privacy First',
    title: 'Your location\nis always \nprotected',
    description:
      'Hospitals never see your exact location. Only your approximate distance and availability are shared.',
    image: require('../../assets/images/onboarding3.jpg'),
    buttonText: 'Continue',
  },
];

export const OnboardingCarouselScreen: React.FC<OnboardingCarouselScreenProps> = ({
  onComplete,
  onSignIn,
}) => {
  const { styles, colors, isDark } = useThemedStyles(createStyles);
  const [currentIndex, setCurrentIndex] = useState(0);

  const handleNext = () => {
    if (currentIndex < slides.length - 1) {
      setCurrentIndex((prev) => prev + 1);
    } else {
      onComplete();
    }
  };

  const currentSlide = slides[currentIndex];

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} backgroundColor={colors.card} />

      {/* Top Header Logo */}
      <View style={styles.header}>
        <View style={styles.brandRow}>
          <Image
            source={require('../../assets/images/logo.png')}
            style={styles.headerLogo}
            resizeMode="contain"
          />
          <Text style={styles.brandName}>BloodLink</Text>
        </View>
      </View>

      {/* Main Content */}
      <View style={styles.content}>
        {/* Visual Image */}
        <View style={styles.imageContainer}>
          <Image
            source={currentSlide.image}
            style={styles.slideImage}
            resizeMode="cover"
          />
        </View>

        {/* Text information */}
        <View style={styles.textContainer}>
          <View style={styles.tagBadge}>
            <Text style={styles.tagText}>{currentSlide.tag}</Text>
          </View>

          <Text style={styles.title}>{currentSlide.title}</Text>

          <Text style={styles.description}>{currentSlide.description}</Text>

          {/* Carousel dots */}
          <View style={styles.dotsRow}>
            {slides.map((_, index) => {
              const isActive = index === currentIndex;
              return (
                <TouchableOpacity
                  key={index}
                  onPress={() => setCurrentIndex(index)}
                  activeOpacity={0.7}
                  style={[
                    styles.dot,
                    isActive ? styles.activeDot : styles.inactiveDot,
                  ]}
                />
              );
            })}
          </View>
        </View>
      </View>

      {/* Bottom Action Area */}
      <View style={styles.bottomArea}>
        <TouchableOpacity
          style={styles.primaryButton}
          activeOpacity={0.85}
          onPress={handleNext}
        >
          <Text style={styles.primaryButtonText}>{currentSlide.buttonText}</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.signInLink}
          activeOpacity={0.7}
          onPress={onSignIn}
        >
          <Text style={styles.signInText}>
            Already have account? <Text style={styles.signInHighlight}>Sign In</Text>
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const createStyles = (c: AppColors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: c.card,
  },
  header: {
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 8,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerLogo: {
    width: 22,
    height: 22,
  },
  brandName: {
    fontSize: 18,
    fontWeight: '800',
    color: c.text,
    letterSpacing: -0.3,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: 'center',
  },
  imageContainer: {
    width: '100%',
    height: width * 0.58,
    borderRadius: 18,
    overflow: 'hidden',
    backgroundColor: c.surface,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 3,
  },
  slideImage: {
    width: '100%',
    height: '100%',
  },
  textContainer: {
    alignItems: 'flex-start',
  },
  tagBadge: {
    backgroundColor: c.primaryBadgeBg,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
    marginBottom: 12,
  },
  tagText: {
    fontSize: 11,
    fontWeight: '700',
    color: c.primaryBadgeText,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: c.text,
    lineHeight: 32,
    letterSpacing: -0.4,
    marginBottom: 12,
  },
  description: {
    fontSize: 13,
    color: c.textMuted,
    lineHeight: 20,
    marginBottom: 20,
  },
  dotsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dot: {
    height: 5,
    borderRadius: 2.5,
  },
  activeDot: {
    width: 20,
    backgroundColor: c.action,
  },
  inactiveDot: {
    width: 6,
    backgroundColor: c.surface,
  },
  bottomArea: {
    paddingHorizontal: 24,
    paddingBottom: 24,
    paddingTop: 8,
  },
  primaryButton: {
    backgroundColor: c.action,
    height: 52,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 14,
  },
  primaryButtonText: {
    color: c.onPrimary,
    fontSize: 16,
    fontWeight: '700',
  },
  signInLink: {
    alignItems: 'center',
    paddingVertical: 6,
  },
  signInText: {
    fontSize: 13,
    color: c.textMuted,
  },
  signInHighlight: {
    color: c.primary,
    fontWeight: '700',
  },
});

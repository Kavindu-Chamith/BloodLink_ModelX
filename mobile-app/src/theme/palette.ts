export interface ColorPalette {
  background: string;
  card: string;
  surface: string;
  border: string;
  text: string;
  textSecondary: string;
  textMuted: string;
  primary: string;
  action: string;
  primarySoft: string;
  success: string;
  successFill: string;
  successSoft: string;
  warning: string;
  warningSoft: string;
  danger: string;
  dangerSoft: string;
  info: string;
  infoSoft: string;
  dark: string;
  onDark: string;
  onPrimary: string;
  heroDark: string;
  heroMuted: string;
  overlay: string;
  focus: string;
  mapBackground: string;
  mapPark: string;
  mapRiver: string;
  mapRoad: string;
  mapMainRoad: string;
}

export const lightColors: ColorPalette = {
  background: '#F7F8FC', card: '#FFFFFF', surface: '#EEF2F8', border: '#DCE3ED',
  text: '#0F172A', textSecondary: '#42526B', textMuted: '#5E6E86',
  primary: '#BD1732', action: '#BE1730', primarySoft: '#FDECEF',
  success: '#087B52', successFill: '#087B52', successSoft: '#E6F7F0', warning: '#945400', warningSoft: '#FFF4DC',
  danger: '#B91C35', dangerSoft: '#FDEDEE', info: '#245BCC', infoSoft: '#EAF1FF',
  dark: '#0F172A', onDark: '#FFFFFF', onPrimary: '#FFFFFF',
  heroDark: '#101B2E', heroMuted: '#B8C6DA', overlay: 'rgba(2, 8, 20, 0.62)', focus: '#245BCC',
  mapBackground: '#E8EEF2', mapPark: '#DCEEE5', mapRiver: '#C4DDEB', mapRoad: '#FFFFFF', mapMainRoad: '#FFDAA0',
};

export const darkColors: ColorPalette = {
  background: '#0C1424', card: '#152137', surface: '#202E45', border: '#35445D',
  text: '#F1F5FB', textSecondary: '#CCD6E6', textMuted: '#A6B5CC',
  primary: '#FF8FA2', action: '#BE1730', primarySoft: '#3A2030',
  success: '#6CE0B3', successFill: '#087B52', successSoft: '#14382F', warning: '#FFD17A', warningSoft: '#3C301C',
  danger: '#FF9CA9', dangerSoft: '#3D202D', info: '#95BDFF', infoSoft: '#203554',
  dark: '#E5EDF8', onDark: '#0C1424', onPrimary: '#FFFFFF',
  heroDark: '#101B2E', heroMuted: '#B8C6DA', overlay: 'rgba(2, 8, 20, 0.76)', focus: '#95BDFF',
  mapBackground: '#202E42', mapPark: '#1D3D36', mapRiver: '#294C66', mapRoad: '#52627A', mapMainRoad: '#9C794D',
};

// Compatibility names for the registration and recovery components.
export function withLegacyColors(c: ColorPalette) {
  return {
    ...c, primaryDark: '#9F1223', primaryLight: c.primary, primaryMuted: c.primarySoft,
    primaryBadgeBg: c.primarySoft, primaryBadgeText: c.primary,
    backgroundAlt: c.background, cardBg: c.card, borderLight: c.border, borderFocus: c.primary,
    textPrimary: c.text, textWhite: c.onPrimary,
    successLight: c.successSoft, successBorder: c.success, warningLight: c.warningSoft,
    warningBorder: c.warning, warningText: c.warning, infoLight: c.infoSoft, infoBorder: c.info,
    gradientTop: '#D31B32', gradientBottom: '#8D0F1F',
  };
}
export type AppColors = ReturnType<typeof withLegacyColors>;

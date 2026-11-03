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
  background: '#F7F6F2', card: '#FFFFFF', surface: '#EFEEE9', border: '#E2E0DA',
  text: '#242723', textSecondary: '#50564F', textMuted: '#686F65',
  primary: '#A6253B', action: '#AB243B', primarySoft: '#FAECEE',
  success: '#087B52', successFill: '#087B52', successSoft: '#E6F7F0', warning: '#945400', warningSoft: '#FFF4DC',
  danger: '#B91C35', dangerSoft: '#FDEDEE', info: '#245BCC', infoSoft: '#EAF1FF',
  dark: '#242723', onDark: '#FFFFFF', onPrimary: '#FFFFFF',
  heroDark: '#262C28', heroMuted: '#C1C8BE', overlay: 'rgba(20, 25, 21, 0.55)', focus: '#A6253B',
  mapBackground: '#E8EEF2', mapPark: '#DCEEE5', mapRiver: '#C4DDEB', mapRoad: '#FFFFFF', mapMainRoad: '#FFDAA0',
};

export const darkColors: ColorPalette = {
  background: '#151817', card: '#202522', surface: '#2B322D', border: '#414B43',
  text: '#F2F3ED', textSecondary: '#CDD3CA', textMuted: '#ABB7AB',
  primary: '#F09AA9', action: '#AB243B', primarySoft: '#3C262C',
  success: '#6CE0B3', successFill: '#087B52', successSoft: '#14382F', warning: '#FFD17A', warningSoft: '#3C301C',
  danger: '#FF9CA9', dangerSoft: '#3D202D', info: '#95BDFF', infoSoft: '#203554',
  dark: '#E5EDE5', onDark: '#151817', onPrimary: '#FFFFFF',
  heroDark: '#202822', heroMuted: '#BECBBE', overlay: 'rgba(5, 10, 7, 0.76)', focus: '#F09AA9',
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

// Static light palette for non-React consumers. Screens use useTheme().
import { lightColors, withLegacyColors } from './palette';
export const colors = withLegacyColors(lightColors);

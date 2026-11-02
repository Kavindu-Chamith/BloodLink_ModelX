import { useThemedStyles } from '../../theme/useThemedStyles';
import { Ionicons } from '@expo/vector-icons';
import { IconPop } from '../../components/Motion';
import type { AppColors } from '../../theme/palette';
// src/requests/components/RequestsTabs.tsx
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { RequestTabType } from '../types/requests';

interface RequestsTabsProps {
  activeTab: RequestTabType;
  onTabChange: (tab: RequestTabType) => void;
  alertsCount?: number;
  activeCount?: number;
}

export const RequestsTabs: React.FC<RequestsTabsProps> = ({
  activeTab,
  onTabChange,
  alertsCount = 0,
  activeCount = 0,
}) => {
  const { styles, colors } = useThemedStyles(createStyles);
  const isAlertsActive = activeTab === 'alerts';
  const isActiveMissionActive = activeTab === 'active';

  return (
    <View style={styles.outerContainer}>
      <View style={styles.pillContainer} accessibilityRole="tablist" accessibilityLabel="Request status">
        {/* New Alerts Tab */}
        <TouchableOpacity
          style={[
            styles.tabButton,
            isAlertsActive ? styles.activeTabButton : styles.inactiveTabButton,
          ]}
          onPress={() => onTabChange('alerts')}
          activeOpacity={0.85}
          accessibilityRole="tab"
          accessibilityState={{ selected: isAlertsActive }}
          aria-selected={isAlertsActive}
          accessibilityLabel={`New Alerts, ${alertsCount} available`}
        >
          <IconPop active={isAlertsActive}><Ionicons name="notifications-outline" size={16} color={isAlertsActive ? colors.primary : colors.textMuted} /></IconPop>
          <Text
            style={[
              styles.tabText,
              isAlertsActive ? styles.activeTabText : styles.inactiveTabText,
            ]}
          >
            New Alerts
          </Text>
          <View
            style={[
              styles.countBadge,
              isAlertsActive ? styles.activeCountBadge : styles.inactiveCountBadge,
            ]}
          >
            <Text
              style={[
                styles.countText,
                isAlertsActive ? styles.activeCountText : styles.inactiveCountText,
              ]}
            >
              {alertsCount}
            </Text>
          </View>
        </TouchableOpacity>

        {/* Active Tab */}
        <TouchableOpacity
          style={[
            styles.tabButton,
            isActiveMissionActive ? styles.activeTabButton : styles.inactiveTabButton,
          ]}
          onPress={() => onTabChange('active')}
          activeOpacity={0.85}
          accessibilityRole="tab"
          accessibilityState={{ selected: isActiveMissionActive }}
          aria-selected={isActiveMissionActive}
          accessibilityLabel={`Active requests, ${activeCount} active`}
        >
          <IconPop active={isActiveMissionActive}><Ionicons name="navigate-outline" size={16} color={isActiveMissionActive ? colors.primary : colors.textMuted} /></IconPop>
          <Text
            style={[
              styles.tabText,
              isActiveMissionActive ? styles.activeTabText : styles.inactiveTabText,
            ]}
          >
            Active
          </Text>
          <View
            style={[
              styles.countBadge,
              isActiveMissionActive ? styles.activeCountBadge : styles.inactiveCountBadge,
            ]}
          >
            <Text
              style={[
                styles.countText,
                isActiveMissionActive ? styles.activeCountText : styles.inactiveCountText,
              ]}
            >
              {activeCount}
            </Text>
          </View>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const createStyles = (c: AppColors) => StyleSheet.create({
  outerContainer: { paddingHorizontal: 22, backgroundColor: c.card },
  pillContainer: { flexDirection: 'row', borderBottomWidth: 1, borderColor: c.border },
  tabButton: { flex: 1, minHeight: 50, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 7, borderBottomWidth: 2 },
  activeTabButton: { borderBottomColor: c.primary }, inactiveTabButton: { borderBottomColor: 'transparent' },
  tabText: { fontSize: 13, fontWeight: '500' }, activeTabText: { color: c.primary }, inactiveTabText: { color: c.textMuted },
  countBadge: { minWidth: 18, paddingHorizontal: 5, height: 20, alignItems: 'center', justifyContent: 'center', borderRadius: 4 },
  activeCountBadge: { backgroundColor: c.primarySoft }, inactiveCountBadge: { backgroundColor: c.surface },
  countText: { fontSize: 10, fontWeight: '500' }, activeCountText: { color: c.primary }, inactiveCountText: { color: c.textMuted },
});

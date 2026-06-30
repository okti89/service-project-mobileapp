import { sp } from '@/theme/scale';

// 8pt Grid System (Dynamic Scaled)
export const spacing = {
    none: 0,
    xxs: sp(2),
    xs: sp(4),
    s: sp(8),
    m: sp(12),
    l: sp(16),
    xl: sp(20),
    xxl: sp(24),
    '3xl': sp(32),
    '4xl': sp(40),
    '5xl': sp(48),
    '6xl': sp(64),

    // Semantic Spacing
    gutter: sp(16),        // Screen padding
    itemGap: sp(12),       // Gap between list items
    sectionGap: sp(24),    // Gap between sections
    safeAreaTop: sp(44),   // Default safe area (can be overridden by useSafeAreaInsets)
    safeAreaBottom: sp(34),
};

// Minimum Touch Area Standard (44x44 or 48x48) - These usually shouldn't scale down too much
export const touchTarget = {
    minHeight: sp(48),
    minWidth: sp(48),
};

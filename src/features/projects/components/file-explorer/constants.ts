// BASE PADDING FOR ROOT LEVEL ITEMS (AFTER PROJECT HEADER)
export const BASE_PADDING = 12;

// ADDITIONAL PADDING FOR NESTED LEVELS
export const LEVEL_PADDING = 12;

export const getItemPadding = (level: number, isFile: boolean) => {
  // FILES NEED EXTRA PADDING SINCE THEY DON'T HAVE THE CHEVRON
  const fileOffset = isFile ? 16 : 0;
  return BASE_PADDING + LEVEL_PADDING * level + fileOffset;
};

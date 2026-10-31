import {validatePageDesign} from './page-design.mjs';
// Only invalid legacy campaign fields are migrated. Current valid designs survive.
const retiredPageDesignFields = new Set(['campaign']);

function migrateTheme(theme, onChange) {
  if (!theme || typeof theme !== 'object' || Array.isArray(theme)) return;
  const pageDesign = theme.pageDesign;
  if (!pageDesign || typeof pageDesign !== 'object' || Array.isArray(pageDesign)) return;

  for (const [page, config] of Object.entries(pageDesign)) {
    if (!config || typeof config !== 'object' || Array.isArray(config)) continue;
    for (const key of Object.keys(config)) {
      if (retiredPageDesignFields.has(key)) {
        try {
          validatePageDesign({[page]: {[key]: config[key]}});
          continue;
        } catch { /* Remove only the known legacy field rejected by the current contract. */ }
        delete config[key];
        onChange();
      }
    }
  }
}

/**
 * Remove known invalid legacy fields from persisted page designs outside
 * the fixed theme protocol. New theme input remains strict because this
 * migration only runs on already persisted application state.
 */
export function migratePersistedState(input) {
  const state = structuredClone(input);
  let changed = false;
  const markChanged = () => { changed = true; };

  migrateTheme(state?.draft, markChanged);
  migrateTheme(state?.published, markChanged);
  if (Array.isArray(state?.templates)) {
    for (const template of state.templates) {
      migrateTheme(template?.draft, markChanged);
      migrateTheme(template?.published, markChanged);
    }
  }

  return { state, changed };
}

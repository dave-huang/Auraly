// The Expo app lives in mobile/ with its own node_modules, but references the
// repo-root shared/ directory. Today shared/schema.ts is consumed via
// type-only imports (erased at compile time, so Metro never resolves them);
// watchFolders is here so runtime code can be shared later without surprise.
//
// Note: do NOT set resolver.disableHierarchicalLookup — Expo relies on nested
// node_modules resolution (e.g. expo-modules-core) and it breaks bundling.
const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '..');

const config = getDefaultConfig(projectRoot);

config.watchFolders = [path.resolve(workspaceRoot, 'shared')];

module.exports = config;

// features/vocabulary/relations/index.ts

// Composables
export { useRelationGraph, relationColors, relationTypeOptions } from './useRelationGraph'
export type { RelationFilters } from './useRelationGraph'

// Components
export { default as RelatedWordsPanel } from './RelatedWordsPanel.vue'
export { default as RelationGraphFilters } from './RelationGraphFilters.vue'
export { default as RelationGraphSearch } from './RelationGraphSearch.vue'
export { default as RelationGraphCanvas } from './RelationGraphCanvas.vue'
export { default as RelationGraphContextMenu } from './RelationGraphContextMenu.vue'
export { default as AddRelationDialog } from './AddRelationDialog.vue'

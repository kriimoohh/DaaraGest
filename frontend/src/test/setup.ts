// Setup global des tests : ajoute les matchers jest-dom (toBeInTheDocument, etc.)
// et augmente le type de `expect` de Vitest.
import '@testing-library/jest-dom/vitest';

// i18n réel : les composants partagés rendent les traductions (fr par défaut).
import '../i18n';

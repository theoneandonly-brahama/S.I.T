import tseslint from 'typescript-eslint';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));

export default tseslint.config(...tseslint.configs.recommended, {
  languageOptions: {
    parserOptions: {
      projectService: true,
      tsconfigRootDir: __dirname,
    },
  },
});

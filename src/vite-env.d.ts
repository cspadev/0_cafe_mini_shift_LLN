/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** "1" = náhledový build bez hlavní hry (např. pro sdílený náhled). V ostré verzi se nenastavuje. */
  readonly VITE_STANDALONE_PREVIEW?: string;
}

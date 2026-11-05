/// <reference types="vite/client" />
declare const __DEMO__: boolean;
/** La demo lleva el catálogo de ejemplo (y no uno real indicado con DEMO_CATALOGO). */
declare const __DEMO_EJEMPLO__: boolean;

declare module 'catalogo-demo.json' {
  const valor: unknown;
  export default valor;
}

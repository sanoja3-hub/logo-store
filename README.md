# Showroom de uniformes (B2B)

Catálogo mayorista de uniformes para que el cliente vea cada prenda en 3D con su logo, arme el pedido por
tallas y lo envíe al asesor por WhatsApp con una orden en PDF.

## Qué hace

- **Panel (`#admin`)**: importa el catálogo desde **PDF** (varios artículos por página: cada foto con el
  texto más cercano) o **Excel .xlsx** (una fila por artículo, con la foto pegada en la fila o «dentro de la
  celda»). Todo pasa por una pantalla de revisión antes de publicar. No se inventan datos: lo que falta queda
  vacío y marcado.
- **Catálogo para clientes (`#catalogo`)**: búsqueda, categorías, ficha con **visor 3D** (three.js, sin modelos
  externos) en el color elegido y con el **logo PNG** del cliente en pecho, espalda, manga o gorra.
- **Pedido**: cantidades por talla, técnica (bordado, DTF, etc.), datos de la empresa (RIF, contacto) y notas.
- **Para el asesor**: orden en **PDF** (foto, vista 3D con el logo, tallas, totales y logo del cliente),
  **Excel** y mensaje de **WhatsApp**. En el teléfono comparte el PDF y el logo directamente.

## Comandos

```bash
bun install
bun run dev     # http://localhost:3000
bun run check   # tipos, pruebas y build
bun run demo    # dist-demo/index.html: un solo archivo con un catálogo de ejemplo
```

## Publicar el catálogo

1. En `#admin`: Importar → Revisar → Ajustes (nombre, WhatsApp del asesor, moneda) → Publicar.
2. «Descargar catalogo.json» y colocarlo en `public/` (o junto al `index.html` ya publicado).
3. `bun run build` y subir `dist/` a cualquier hosting estático (Netlify, Vercel, GitHub Pages, Firebase Hosting).

## Límites conocidos

- El panel no tiene contraseña: cualquiera que abra `#admin` puede preparar un catálogo **en su propio
  navegador**, pero no cambia lo que ven los clientes (eso solo cambia al subir `catalogo.json`).
- Los PDF escaneados (sin texto seleccionable) no se pueden leer; el `.xls` antiguo hay que guardarlo como `.xlsx`.
- Las prendas 3D son modelos genéricos por tipo (franela, chemise, camisa, chaqueta, chaleco, pantalón,
  gorra) en el color elegido; la foto real del catálogo se ve en la pestaña «Foto».

# Showroom de uniformes (B2B)

Catálogo mayorista de uniformes para que el cliente vea cada prenda en 3D con su logo, arme el pedido por
tallas y lo envíe al asesor por WhatsApp con una orden en PDF.

## Qué hace

- **Panel (`#admin`)**: importa el catálogo desde **PDF** (varios artículos por página: cada foto con el
  texto más cercano) o **Excel .xlsx** (una fila por artículo, con la foto pegada en la fila o «dentro de la
  celda»). Todo pasa por una pantalla de revisión antes de publicar. No se inventan datos: lo que falta queda
  vacío y marcado.
- **Catálogo para clientes (`#catalogo`)**: búsqueda, categorías y ficha de cada artículo con:
  - **Foto 3D**: la foto real del catálogo montada como una pieza que gira; si el catálogo trae la espalda, al
    girarla se ve la espalda. Debajo, las fotos de detalle.
  - **Modelo 3D** (three.js, sin modelos externos) en el color elegido y con el **logo PNG** del cliente en
    pecho, espalda, manga o gorra. El calzado y los accesorios (forma «otro») solo tienen Foto 3D.
  - **Ficha técnica** (tallas, material, características, advertencias) y colores con su código y su miniatura.
- **Pedido**: cantidades por talla, técnica (bordado, DTF, etc.), datos de la empresa (RIF, contacto) y notas.
- **Para el asesor**: orden en **PDF** (foto, vista 3D con el logo, tallas, totales y logo del cliente),
  **Excel** y mensaje de **WhatsApp**. En el teléfono comparte el PDF y el logo directamente.

## Comandos

```bash
bun install
bun run dev     # http://localhost:3000
bun run check   # tipos, pruebas y build
bun run demo    # dist-demo/index.html: un solo archivo con un catálogo de ejemplo
DEMO_CATALOGO=ruta/catalogo.json bun run demo   # la misma demo con un catálogo real
```

## Catálogo Maestro Showroom (PDF de Kavak, gorras y correas)

Ese PDF tiene un diseño propio (un artículo por página, frente y espalda, carta de colores con miniaturas y
algunos títulos dibujados en vez de escritos), así que se convierte con un script aparte:

```bash
pip install pymupdf pillow
python3 herramientas/extraer_catalogo_pdf.py Catalogo_Maestro_Showroom_Optimizado.pdf catalogo.json
```

Luego, en `#admin` → Publicar → «Abrir un catalogo.json» para revisarlo, o se coloca directo en `public/`.
Las cartas de colores de Lanitex (sin códigos de artículo) y los bolsos (sin código) no se importan.

## Publicar el catálogo

1. En `#admin`: Importar → Revisar → Ajustes (nombre, WhatsApp del asesor, moneda) → Publicar.
2. «Descargar catalogo.json» y colocarlo en `public/` (o junto al `index.html` ya publicado).
3. `bun run build` y subir `dist/` a cualquier hosting estático (Netlify, Vercel, GitHub Pages, Firebase Hosting).

## Límites conocidos

- El panel no tiene contraseña: cualquiera que abra `#admin` puede preparar un catálogo **en su propio
  navegador**, pero no cambia lo que ven los clientes (eso solo cambia al subir `catalogo.json`).
- Los PDF escaneados (sin texto seleccionable) no se pueden leer; el `.xls` antiguo hay que guardarlo como `.xlsx`.
- El modelo 3D es genérico por tipo (franela, chemise, camisa manga larga o corta, chaqueta, chaleco, pantalón,
  gorra) en el color elegido; la prenda real se ve en «Foto 3D», que es una foto que gira, no un escaneo 3D.

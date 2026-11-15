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
- **Pedido**: matriz de tallas con el stock de cada una (no deja pedir más de lo que hay), personalización
  opcional con el logo (PNG, JPG o PDF) en varias posiciones, cada una con su técnica y tamaño (pequeño 10 cm,
  mediano 18 cm, grande 28 cm), y el precio calculado en vivo. Datos del cliente (empresa, RIF, teléfono, notas).
- **Motor de precios (`src/core/reglas.ts`)**: tres precios por artículo (detal, mayor y distribuidor) según la
  cantidad del artículo o del pedido completo; tallas grandes (2XL en adelante, configurable) con recargo en % o
  monto fijo, o con su propio precio; tarifa de cada técnica por tamaño, mínimo por técnica, descuento por
  volumen en la personalización y matrices tela × técnica y posición × tamaño. Todo se edita en
  «Precios y reglas».
- **Sucursales y vendedores, sin usuarios**: cada vendedor tiene su enlace (`?vendedor=<id>#catalogo`); el
  cliente que entra por él le envía el pedido a su WhatsApp. Por el enlace general, el cliente elige quién lo
  atiende.
- **Para el asesor**: orden en **PDF** (foto, vista 3D con el logo, tallas, totales y logo del cliente),
  **Excel**, **CSV** y mensaje de **WhatsApp** con el desglose por talla y personalización. En el teléfono
  comparte el PDF y el logo directamente.
- **Configuración en JSON**: «Publicar → Exportar configuración» guarda reglas, ajustes, sucursales y, por
  código, precios, tela y stock (sin fotos). Importarla en otro navegador o tienda actualiza todo de una vez.

## Comandos

```bash
bun install
bun run dev     # http://localhost:3000
bun run check   # tipos, pruebas y build
bun run demo    # dist-demo/index.html: un solo archivo con public/catalogo.json y sus fotos adentro
DEMO_CATALOGO=ruta/catalogo.json bun run demo   # la misma demo con otro catálogo (sus fotos/ al lado)
```

El repositorio no trae catálogo ni fotos: viven en `public/catalogo.json` y `public/fotos/`, que no se suben.

## Fotos del catálogo

Las fotos son archivos sueltos en `fotos/`, nombrados con el código del artículo, y `catalogo.json` solo las
enlaza (`"foto": "fotos/2800.webp"`). Para cargar fotos nuevas: `#admin` → Revisar → «Cargar fotos por código»,
y se seleccionan todas a la vez con estos nombres:

| Archivo               | Qué es                                          |
| --------------------- | ----------------------------------------------- |
| `2800.jpg`            | Frente (la foto principal y la cara de «Foto 3D») |
| `2800-espalda.jpg`    | Espalda (la otra cara de «Foto 3D»)             |
| `2800-2.jpg`          | Detalle 2 (bolsillos, cierres, suela…)          |
| `2800-color-06.jpg`   | La prenda en el color de código 06 (o de nombre «06»): es la foto que se ve al elegir ese color |

Cada foto reemplaza solo lo suyo (los detalles nuevos reemplazan a los anteriores). Lo que no se reconoce no se
asigna y se lista con su motivo. «Quitar todas las fotos» deja el borrador sin fotos, con los códigos, tallas y
colores intactos, para cargar una tanda nueva desde cero.

Un `catalogo.json` viejo con las fotos incrustadas se separa así:

```bash
python3 herramientas/separar_fotos.py catalogo.json public/
```

## Catálogo Maestro Showroom (PDF de Kavak, gorras y correas)

Ese PDF tiene un diseño propio (un artículo por página, frente y espalda, carta de colores con miniaturas y
algunos títulos dibujados en vez de escritos), así que se convierte con un script aparte:

```bash
pip install pymupdf pillow
python3 herramientas/extraer_catalogo_pdf.py Catalogo_Maestro_Showroom_Optimizado.pdf catalogo.json
```

Luego, en `#admin` → Publicar → «Abrir un catálogo (.zip o .json)» para revisarlo, o se separan sus fotos con
`herramientas/separar_fotos.py` directo en `public/`.
Las cartas de colores de Lanitex (sin códigos de artículo) y los bolsos (sin código) no se importan.

## Publicar el catálogo

1. En `#admin`: Importar → Revisar → Ajustes (nombre, WhatsApp del asesor, moneda) → Publicar.
2. «Descargar catalogo.zip» y descomprimirlo en `public/` (o junto al `index.html` ya publicado): trae
   `catalogo.json` y la carpeta `fotos/`.
3. `bun run build` y subir `dist/` a cualquier hosting estático (Netlify, Vercel, GitHub Pages, Firebase Hosting).

## Límites conocidos

- El panel pide un PIN (por defecto `1234`, se cambia en Ajustes). No es seguridad real: el PIN viaja en el
  catálogo publicado. Lo que ven los clientes solo cambia al subir `catalogo.json`.
- El stock y los precios se comparten entre sucursales al publicar el catálogo o la configuración: no hay
  sincronización en tiempo real (eso pide un servidor, por ejemplo Firebase).
- Los PDF escaneados (sin texto seleccionable) no se pueden leer; el `.xls` antiguo hay que guardarlo como `.xlsx`.
- El modelo 3D es genérico por tipo (franela, chemise, camisa manga larga o corta, chaqueta, chaleco, pantalón,
  gorra) en el color elegido; la prenda real se ve en «Foto 3D», que es una foto que gira, no un escaneo 3D.

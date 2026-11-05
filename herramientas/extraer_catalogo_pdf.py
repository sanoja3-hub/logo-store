"""Lee el «Catálogo Maestro Showroom» (Kavak, gorras y correas) y arma el catalogo.json de la app.

Uso:  python3 herramientas/extraer_catalogo_pdf.py Catalogo.pdf catalogo.json
Necesita PyMuPDF y Pillow (pip install pymupdf pillow).

El diseño de ese PDF (un artículo por página, fotos de frente y espalda, carta de colores con miniaturas)
no lo entiende el importador genérico de la app, por eso va aparte. No inventa datos: lo que no se lee se
deja vacío; los títulos que en el PDF son dibujos (no texto) están transcritos en TITULOS.
"""
import io, json, re, base64, sys
import warnings
warnings.filterwarnings('ignore')
import pymupdf as fitz
from PIL import Image

if len(sys.argv) < 3:
    sys.exit('Uso: extraer_catalogo_pdf.py Catalogo.pdf catalogo.json')
d = fitz.open(sys.argv[1])

# Títulos que en el PDF están dibujados como curvas (no son texto): leídos de la página tal cual.
TITULOS = {
    38: ('CHEMISE MODELO', '2103'), 39: ('CHEMISE MODELO', '2104'),
    41: ('JERSEY MANGA LARGA', 'N1939'), 42: ('JERSEY MANGA LARGA', 'N1940'),
    43: ('FRANELA DRY FIT', 'N1937'), 44: ('FRANELA DRY FIT', 'N1938'),
    46: ('CHAQUETA CORTAVIENTOS', 'N4710'),
    49: ('PANTALÓN JEAN STRETCH ONIX', '161202'), 50: ('PANTALÓN JEAN STRETCH AZUL', '160604'),
    51: ('PANTALÓN 3 COSTURAS', '160204'), 52: ('PANTALÓN TÁCTICO', '161802'),
    53: ('PANTALÓN CLASSIC', '1624'), 54: ('PANTALÓN ELEGANT', '1622'),
    55: ('PANTALÓN JEAN STRETCH ONIX', '161302'), 56: ('PANTALÓN JEAN STRETCH', '160304'),
    57: ('PANTALÓN CLASSIC', '1625'), 58: ('PANTALÓN ELEGANT', '1623'),
    62: ('BOTAS CLÁSICAS', 'B051402'), 63: ('BOTAS DIELÉCTRICAS', 'B051502'),
    64: ('BOTAS CLÁSICAS', 'B051602'), 65: ('BOTAS SOLDADOR', 'B051738'), 66: ('BOTAS TÁCTICAS', 'B051802'),
}

def seccion(pn):
    if 7 <= pn <= 12: return 'Camisas manga corta', 'Caballero', 'camisa_corta'
    if 15 <= pn <= 19: return 'Camisas manga corta', 'Dama', 'camisa_corta'
    if 23 <= pn <= 28: return 'Camisas manga larga', 'Caballero', 'camisa'
    if 31 <= pn <= 35: return 'Camisas manga larga', 'Dama', 'camisa'
    if pn == 38: return 'Chemises', 'Caballero', 'chemise'
    if pn == 39: return 'Chemises', 'Dama', 'chemise'
    if pn in (41, 43): return 'Jerseys y franelas', 'Caballero', 'franela'
    if pn in (42, 44): return 'Jerseys y franelas', 'Dama', 'franela'
    if pn == 46: return 'Chaquetas', '', 'chaqueta'
    if 49 <= pn <= 54: return 'Pantalones', 'Caballero', 'pantalon'
    if 55 <= pn <= 58: return 'Pantalones', 'Dama', 'pantalon'
    if 62 <= pn <= 66: return 'Botas', '', 'otro'
    if 85 <= pn <= 94: return 'Gorras', '', 'gorra'
    if 95 <= pn <= 100: return 'Correas', '', 'otro'
    return None

HEX = [
    (r'NARANJA NE', '#ff6a13'), (r'ROSADO NE', '#ff4fa3'), (r'VERDE NE', '#57e83a'), (r'AMARILLO NE', '#e6f53a'),
    (r'CORAL', '#f77b6b'), (r'MELANGE OSC', '#6e6f7a'), (r'MELANGE', '#c9c9cc'), (r'LILA', '#a58cc9'),
    (r'AZUL COBALTO', '#1d3f8f'), (r'VERDE BOTELLA', '#1f4d36'), (r'VERDE BENETTON', '#138a4c'),
    (r'AMARILLO CATERPILLAR', '#f2b300'), (r'AMARILLO CLARO', '#f6e27a'), (r'GRIS CLARO', '#b9bcc2'),
    (r'AZUL MARINO|NAVY|MARINO', '#1f2a44'), (r'AZUL CEL|CELESTE|AZUL CIELO', '#7fb3e0'), (r'AZUL REY|ROYAL', '#1f4fb4'),
    (r'AQUAMARINA|AGUAMARINA', '#7fd1c1'), (r'TURQUESA', '#1aa3b3'), (r'AZUL', '#2b5ca8'),
    (r'NEGRO', '#1b1c1f'), (r'BLANCO', '#f2f2ee'), (r'GRIS OSC|PLOMO|GRAFITO', '#4a4e57'), (r'GRIS', '#9a9ea6'),
    (r'VINOTINTO|VINO', '#6b1f2a'), (r'ROJO', '#b3232f'), (r'NARANJA', '#e46a1c'), (r'AMARILLO', '#e8b923'),
    (r'VERDE MANZ|LIM', '#7cb342'), (r'VERDE OLIVA|OLIVA|MILITAR', '#5b6236'), (r'VERDE', '#2e7d4f'),
    (r'BEIGE|KAKI|KAKY|KHAKI|ARENA', '#c2a878'), (r'MARR|CAF|CHOCOLATE', '#5e4030'), (r'FUCSIA', '#c2187a'),
    (r'ROSAD|ROSA', '#e48aa6'), (r'MORADO|PURPURA|PÚRPURA|LILA', '#5d3a8c'), (r'MOSTAZA', '#c9a227'),
]

def hex_de(nombre, muestra=None):
    for patron, h in HEX:
        if re.search(patron, nombre.upper()):
            return h
    return muestra or '#80848c'

def foto_webp(img, maximo=900):
    img = img.convert('RGB')
    k = min(1, maximo / max(img.size))
    if k < 1:
        img = img.resize((round(img.width * k), round(img.height * k)), Image.LANCZOS)
    b = io.BytesIO()
    img.save(b, 'WEBP', quality=80)
    return 'data:image/webp;base64,' + base64.b64encode(b.getvalue()).decode()

def render(page, zoom):
    pix = page.get_pixmap(matrix=fitz.Matrix(zoom, zoom), alpha=False)
    return Image.open(io.BytesIO(pix.tobytes('png')))

def palabras_en(page, y0, y1, x0=0, x1=1e9):
    return [w for w in page.get_text('words') if y0 <= w[1] < y1 and x0 <= w[0] < x1]

def lineas(page):
    out = []
    for b in page.get_text('blocks'):
        t = re.sub(r'\s+', ' ', b[4]).strip()
        if t:
            out.append((b[0], b[1], b[2], b[3], t))
    return out

def capitalizar(t):
    pequeñas = {'de', 'del', 'la', 'y', 'con', 'a'}
    return ' '.join(p.lower() if p.lower() in pequeñas and i else p.capitalize() for i, p in enumerate(t.lower().split()))

productos = []
avisos = []

def lineas_de(page):
    out = []
    for b in page.get_text('dict')['blocks']:
        for l in b.get('lines', []):
            t = re.sub(r'\s+', ' ', ''.join(s['text'] for s in l['spans'])).strip()
            if t:
                out.append((*l['bbox'], t))
    return out

def repartir(palabras, codigos):
    """Reparte palabras (ordenadas por x) en grupos contiguos, uno por código, minimizando la distancia."""
    n, k = len(palabras), len(codigos)
    if n < k:
        return [[w for w in palabras if min(codigos, key=lambda c: abs(c - (w[0]+w[2])/2)) == c0] for c0 in codigos]
    INF = 1e18
    cx = [(w[0]+w[2])/2 for w in palabras]
    def coste(i, j, c):  # palabras i..j-1 al código c
        centro = (palabras[i][0] + palabras[j-1][2]) / 2
        return abs(centro - c)
    best = [[INF]*(n+1) for _ in range(k+1)]; prev = [[0]*(n+1) for _ in range(k+1)]
    best[0][0] = 0
    for g in range(1, k+1):
        for j in range(g, n+1):
            for i in range(g-1, j):
                v = best[g-1][i] + coste(i, j, codigos[g-1])
                if v < best[g][j]:
                    best[g][j] = v; prev[g][j] = i
    grupos = []; j = n
    for g in range(k, 0, -1):
        i = prev[g][j]; grupos.append(palabras[i:j]); j = i
    return grupos[::-1]

BASES = {'BLANCO','NEGRO','ROJO','AZUL','VERDE','GRIS','AMARILLO','NARANJA','BEIGE','TURQUESA','AQUAMARINA','CELESTE',
         'FUCSIA','MORADO','VINOTINTO','LILA','CORAL','MELANGE','ROSADO','KAKY','MARRÓN','CAQUI'}

def unir_compuestos(ws):
    vistos, limpio = set(), []
    for w in ws:
        k = (round(w[0]), round(w[1]), w[4])
        if k not in vistos:
            vistos.add(k); limpio.append(w)
    out = []
    for w in limpio:
        if out and out[-1][4].split()[0].upper() in {'AZUL','VERDE','GRIS','AMARILLO','NARANJA','ROSADO','MELANGE'} \
                and w[4].upper() not in BASES and len(out[-1][4].split()) == 1:
            p = out[-1]; out[-1] = (p[0], p[1], w[2], max(p[3], w[3]), p[4] + ' ' + w[4])
        else:
            out.append(tuple(w[:5]))
    return out

def kavak(pn):
    page = d[pn - 1]
    sec, publico, forma = seccion(pn)
    L = lineas_de(page)
    ws = page.get_text('words')
    # Título
    tit = next((l for l in L if re.fullmatch(r"[A-ZÁÉÍÓÚÑ0-9 ]+?\s*[A-Z]?\d{3,7}", l[4]) and l[1] < 1110 and l[0] < 300 and (l[1] < 150 or l[1] > 950)), None)
    if pn in TITULOS:
        nombre, codigo = TITULOS[pn]
        y_tit = 1050
    elif tit:
        m = re.fullmatch(r"(.+?)\s*([A-Z]?\d{3,7})", tit[4]); nombre, codigo = m.group(1), m.group(2); y_tit = tit[1]
    else:
        avisos.append(f'pág. {pn}: sin título'); return
    arriba = y_tit < 500
    codigos = [w for w in ws if re.fullmatch(r'\d{2}', w[4]) and w[1] > 1500]
    y0, y1 = (0, 470) if arriba else (980, min([1640] + [c[1] - 15 for c in codigos]))
    texto = [l for l in L if y0 <= l[1] < y1 and not re.fullmatch(r'[\d\s]+|.*P[ÁA]G\.?', l[4]) and l is not tit
             and not re.fullmatch(r'(TALLAS|MATERIAL|CARACTER[ÍI]STICAS|DESCRIPCI[ÓO]N|COLORES)\s*:?', l[4].upper())
             and not re.fullmatch(r"[A-ZÁÉÍÓÚÑ ]+?\s*[A-Z]?\d{3,7}", l[4]) and l[4].upper() != nombre.upper()]
    izq = sorted([l for l in texto if l[0] < 500], key=lambda l: l[1])
    der = sorted([l for l in texto if l[0] >= 500], key=lambda l: (round(l[1]), l[0]))
    tallas_txt = next((l[4] for l in izq if re.search(r'^(XS|S)-|\d+ a la \d+', l[4])), '')
    resto = [l[4] for l in izq if l[4] != tallas_txt]
    material = [t for t in resto if re.search(r'%|Cuero|Poli|Algod', t)]
    caract = [t for t in resto if t not in material]
    adv_i = next((i for i, l in enumerate(der) if l[4].upper() == 'ADVERTENCIA'), None)
    advert = ''
    if adv_i is not None:
        partes = []
        for l in sorted(der[adv_i+1:], key=lambda l: l[1]):
            if l[4].startswith('THE ') or 'POCKETS' in l[4]:
                break
            if l[4].isupper():
                partes.append(l[4])
        advert = ' '.join(partes)
        der = der[:adv_i]
    der = [l for l in der if not l[4].isupper() or len(l[4]) < 4]
    descripcion = ''
    for l in der:
        t = l[4]
        if descripcion.endswith('-'):
            descripcion = descripcion[:-1] + t
        else:
            descripcion = (descripcion + ' ' + t).strip()
    descripcion = re.sub(r'\s+', ' ', descripcion).replace(' .', '.')
    # Colores
    img1 = render(page, 1)
    img3 = render(page, 3)
    swatches = [i['bbox'] for i in page.get_image_info() if 35 < (i['bbox'][3]-i['bbox'][1]) < 110 and i['bbox'][1] > 1500]
    colores = []
    filas = []
    vistos = set()
    for c in sorted(codigos, key=lambda w: (w[1], w[0])):
        if c[4] in vistos:
            continue
        vistos.add(c[4])
        if filas and abs(filas[-1][0][1] - c[1]) < 10:
            filas[-1].append(c)
        else:
            filas.append([c])
    ys_filas = [f[0][1] for f in filas]
    for fila in filas:
        fila.sort(key=lambda w: w[0])
        yc = fila[0][1]
        nombres = sorted([w for w in ws if not re.fullmatch(r'\d{2}', w[4]) and yc + 20 < w[1] < min([y for y in ys_filas if y > yc + 5] + [yc + 140]) - 5 and w[4].upper() != 'COLORES:'
                          and fila[0][0] - 60 < w[0] < fila[-1][2] + 60], key=lambda w: w[0])
        # solo la primera línea de nombres debajo de esta fila
        if nombres:
            ymin = min(w[1] for w in nombres); nombres = [w for w in nombres if w[1] < ymin + 12]
        nombres = unir_compuestos(nombres)
        if len(nombres) == len(fila):
            grupos = [[n] for n in nombres]
        else:
            grupos = repartir(nombres, [(c[0]+c[2])/2 for c in fila]) if nombres else [[] for _ in fila]
        for c, g in zip(fila, grupos):
            cx = (c[0]+c[2])/2
            sw = next((s for s in swatches if abs((s[0]+s[2])/2 - cx) < 30 and c[3] - 5 < s[1] < c[3] + 40), None)
            caja = sw or (cx - 28, c[3] + 6, cx + 28, c[3] + 70)
            mx, my = int((caja[0]+caja[2])/2), int(caja[1] + (caja[3]-caja[1])*0.45)
            reg = img1.crop((mx-6, my-6, mx+7, my+7)).convert('RGB').resize((1, 1), Image.BOX).getpixel((0, 0))
            muestra = '#%02x%02x%02x' % reg
            nombre_c = ' '.join(w[4] for w in g).strip()
            mini = img3.crop(tuple(int(v*3) for v in caja))
            colores.append({'codigo': c[4], 'nombre': capitalizar(nombre_c) if nombre_c else '', 'hex': hex_de(nombre_c, muestra) if nombre_c else muestra,
                            'foto': foto_webp(mini, 200)})
    # Fotos
    infos = page.get_image_info()
    fotos = []
    if arriba:
        fotos.append(img1.crop((0, 400, 1080, 1700)))
    else:
        grandes = [i['bbox'] for i in infos if (i['bbox'][3] - i['bbox'][1]) > 600 and i['bbox'][1] < 60]
        if any(b[0] > 300 for b in grandes) and any(b[0] < 100 for b in grandes):
            fotos = [img1.crop((0, 100, 540, 1020)), img1.crop((540, 100, 1080, 1020))]
        else:
            fotos = [img1.crop((0, 0, 1080, 1020))]
    n_principal = len(fotos)
    detalles = sorted([i['bbox'] for i in infos if 120 < (i['bbox'][3]-i['bbox'][1]) < 600 and 120 < (i['bbox'][2]-i['bbox'][0]) < 700
                       and i['bbox'][0] > -5 and i['bbox'][2] < 1090 and i['bbox'][3] < 1925 and not (i['bbox'][1] < 30)], key=lambda b: (b[1], b[0]))
    for b in detalles:
        fotos.append(img3.crop(tuple(int(max(0, v)*3) for v in b)))
    ficha = []
    if publico: ficha.append({'titulo': 'Línea', 'texto': publico})
    if tallas_txt: ficha.append({'titulo': 'Tallas', 'texto': tallas_txt})
    if material: ficha.append({'titulo': 'Material', 'texto': ' '.join(material)})
    if caract: ficha.append({'titulo': 'Características', 'texto': ' '.join(caract)})
    if advert: ficha.append({'titulo': 'Advertencia', 'texto': advert.capitalize()})
    productos.append(dict(
        pagina=pn, codigo=codigo, nombre=capitalizar(nombre) + (f' · {publico}' if publico and sec in ('Pantalones', 'Chemises', 'Jerseys y franelas') else ''),
        descripcion=descripcion, categoria=sec, forma=forma, colores=colores, tallas_txt=tallas_txt,
        fotos=[foto_webp(f, 1000 if i < 2 else 600) for i, f in enumerate(fotos)], ficha=ficha, precio=None, n_principal=n_principal))

GORRAS = {}

def gorra(pn):
    page = d[pn - 1]
    t = page.get_text()
    portada = {85: ('LOW PRO OTTOMAN', 'BLANCO/NEGRO', 'G0090801'), 91: ('LOW PRO MALLA', 'NEGRO', 'G0091102')}
    if pn in portada:  # portada de cada línea: la gorra grande con su referencia (las demás tienen su página)
        modelo, color, ref = portada[pn]
        tallas = []
    else:
        lin = [l.strip() for l in t.split('\n') if l.strip()]
        i_ref = next((i for i, l in enumerate(lin) if l.startswith('Ref')), None)
        if i_ref is None:
            return
        ref = lin[i_ref].split(':')[1].strip()
        color = lin[i_ref - 1]
        modelo = lin[i_ref - 2]
        tallas = [l for l in lin[i_ref + 1:] if re.match(r'[SML]:', l)]
    img = render(page, 1.6)
    k = 1.6
    W, H = page.rect.width, page.rect.height
    def visible(b):
        w = max(0, min(W, b[2]) - max(0, b[0])); h = max(0, min(H, b[3]) - max(0, b[1]))
        return w * h / max(1, (b[2] - b[0]) * (b[3] - b[1]))
    grandes = sorted([i['bbox'] for i in page.get_image_info() if (i['bbox'][3] - i['bbox'][1]) > 200 and visible(i['bbox']) > 0.6],
                     key=lambda b: -(b[2] - b[0]) * (b[3] - b[1]))
    fotos = []
    elegidas = []
    for b in grandes:
        cx, cy = (b[0]+b[2])/2, (b[1]+b[3])/2
        if any(e[0] <= cx <= e[2] and e[1] <= cy <= e[3] for e in elegidas) or (b[2]-b[0]) < 250:
            continue
        elegidas.append(b)
    if pn in portada:
        elegidas = [(0, 130, page.rect.width, 625)]
    for n, b in enumerate(elegidas[:2]):
        x0, y0, x1, y1 = max(0, b[0]), max(0, b[1]), min(page.rect.width, b[2]), min(page.rect.height, b[3])
        if n == 0 and len(elegidas) > 1 and elegidas[1][1] > y0 + 100:
            y1 = min(y1, elegidas[1][1] - 5)  # sin la esquina de la otra foto
        fotos.append(img.crop((int(x0 * k), int(y0 * k), int(x1 * k), int(y1 * k))))
    base = ref[:-2]
    p = GORRAS.get(base)
    if not p:
        p = dict(pagina=pn, codigo=base, nombre='Gorra ' + capitalizar(modelo), descripcion='', categoria='Gorras', forma='gorra',
                 colores=[], tallas_txt='S, M, L', fotos=[foto_webp(f) for f in fotos], ficha=[], precio=None)
        GORRAS[base] = p
        productos.append(p)
    else:
        p['fotos'] += [foto_webp(f, 600) for f in fotos]
    if tallas and not p['ficha']:
        p['ficha'].append({'titulo': 'Tallas', 'texto': ' · '.join(tallas)})
    p['colores'].append({'codigo': ref[-2:], 'nombre': f'{capitalizar(color)} · Ref. {ref}', 'hex': hex_de(color.split('/')[0]),
                         'foto': foto_webp(fotos[0], 360) if fotos else None})

def correa(pn):
    page = d[pn - 1]
    t = page.get_text()
    m = re.search(r'MODELO\s+(\d+)', t)
    if not m:
        return
    lin = [l.strip() for l in t.split('\n') if l.strip()]
    tallas = [l for l in lin if re.fullmatch(r'\d{2}/\d{2}', l)]
    mayor = re.search(r'AL MAYOR\s*([\d]+,[\d]{2})\$', t); detal = re.search(r'AL DETAL\s*([\d]+,[\d]{2})\$', t)
    desc = ' '.join(l for l in lin if re.search(r'[a-z]', l) and 'TASA' not in l and 'DETAL' not in l)
    img = render(page, 0.9)
    precio_mayor = mayor.group(1) if mayor else None
    ficha = [{'titulo': 'Tallas', 'texto': ' · '.join(tallas)}]
    if mayor or detal:
        ficha.append({'titulo': 'Precio en el catálogo', 'texto': ' · '.join(x for x in [f'Al mayor {precio_mayor}$' if mayor else '', f'Al detal {detal.group(1)}$' if detal else ''] if x) + ' (tasa BCV)'})
    productos.append(dict(pagina=pn, codigo=m.group(1), nombre=f'Correa táctica modelo {m.group(1)}',
        descripcion=desc, categoria='Correas', forma='otro', colores=[],
        tallas_txt=','.join(tallas), fotos=[foto_webp(img)], ficha=ficha,
        precio=int(precio_mayor.replace(',', '')) if precio_mayor else None))

for pn in range(1, len(d) + 1):
    s = seccion(pn)
    if not s:
        continue
    try:
        if s[0] == 'Gorras':
            gorra(pn)
        elif s[0] == 'Correas':
            correa(pn)
        else:
            kavak(pn)
    except Exception as e:
        avisos.append(f'pág. {pn}: {e}')

for a in avisos:
    print('Aviso:', a)


# ---------- Conversión al formato de la app ----------
# Nombres de color por código, aprendidos de las camisas que sí los traen escritos (mismo proveedor, misma carta).
carta = {}
for p in productos:
    if p['categoria'].startswith('Camisas'):
        for c in p['colores']:
            if c.get('nombre') and c.get('codigo'):
                carta.setdefault(c['codigo'], c['nombre'])

def tallas_de(p):
    t = p['tallas_txt']
    m = re.match(r'(\d+) a la (\d+)', t)
    if m:
        a, b = int(m.group(1)), int(m.group(2))
        paso = 1 if p['categoria'] == 'Botas' else 2
        return [str(n) for n in range(a, b + 1, paso)]
    if p['categoria'] == 'Correas':
        return t.split(',')
    return [x.strip() for x in re.split(r'[-,]', t) if x.strip()]

def slug(t):
    import unicodedata
    t = unicodedata.normalize('NFD', t.lower()); t = ''.join(ch for ch in t if unicodedata.category(ch) != 'Mn')
    return re.sub(r'[^a-z0-9]+', '-', t).strip('-')

salida = []
for p in productos:
    avisos_p = []
    colores = []
    for c in p['colores']:
        nombre = c.get('nombre') or ''
        cod = c.get('codigo')
        if not nombre and cod and p['categoria'].startswith('Camisas') and cod in carta:
            nombre = carta[cod]
            avisos_p.append('Nombres de color tomados de la carta de colores de las otras camisas (en esta página solo vienen los códigos).')
        if not nombre:
            nombre = f'Color {cod}'
        if cod and not nombre.startswith('Color') and 'Ref.' not in nombre:
            nombre = f'{nombre} ({cod})'
        colores.append({'nombre': nombre, 'hex': hex_de(nombre, c['hex']) if not nombre.startswith('Color') else c['hex'],
                        **({'codigo': cod} if cod else {}), **({'foto': c['foto']} if c.get('foto') else {})})
    tallas = tallas_de(p)
    salida.append({
        'id': f"{slug(p['nombre'])}-{p['codigo'].lower()}",
        'codigo': p['codigo'], 'nombre': p['nombre'], 'descripcion': p['descripcion'], 'categoria': p['categoria'],
        'forma': p['forma'], 'colores': colores, 'tallas': tallas,
        'precioCentavos': p['precio'], 'minimo': 0,
        'foto': p['fotos'][0] if p['fotos'] else None,
        'fotoEspalda': p['fotos'][1] if p.get('n_principal') == 2 else None,
        'fotos': p['fotos'][p.get('n_principal') or 1:],
        'ficha': p['ficha'], 'origen': f"Catálogo PDF, página {p['pagina']}",
        'avisos': sorted(set(avisos_p)),
    })
from datetime import datetime, timezone
catalogo = {
    'version': 1,
    'ajustes': {'empresa': 'Showroom de Uniformes', 'lema': 'Catálogo mayorista de uniformes y dotación',
                'whatsappAsesor': '', 'correoAsesor': '', 'moneda': 'USD', 'mostrarPrecios': True},
    'productos': salida,
    'publicadoEn': datetime.now(timezone.utc).isoformat(timespec='milliseconds').replace('+00:00', 'Z'),
}
json.dump(catalogo, open(sys.argv[2], 'w'), ensure_ascii=False)
print(f'{len(salida)} artículos guardados en {sys.argv[2]}')

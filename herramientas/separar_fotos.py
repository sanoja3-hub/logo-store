#!/usr/bin/env python3
"""Saca las fotos incrustadas (data:image/...) de un catalogo.json y las deja como archivos en fotos/.

    python3 herramientas/separar_fotos.py catalogo.json public/

Escribe public/catalogo.json (liviano) y public/fotos/<codigo>.webp, <codigo>-espalda.webp, <codigo>-2.webp,
<codigo>-muestra-<color>.webp (muestra de la carta de colores) y <codigo>-color-<color>.webp (la prenda en
ese color): los mismos nombres que usa el panel al publicar el .zip.
"""

import base64
import json
import re
import sys
import unicodedata
from pathlib import Path

EXT = {"image/webp": "webp", "image/jpeg": "jpg", "image/png": "png", "image/avif": "avif", "image/gif": "gif"}


def nombre_archivo(s: str) -> str:
    s = unicodedata.normalize("NFD", s or "")
    s = "".join(c for c in s if not unicodedata.combining(c))
    return re.sub(r"[^A-Za-z0-9_-]+", "-", s).strip("-").lower()


def main(entrada: str, destino: str) -> None:
    cat = json.loads(Path(entrada).read_text(encoding="utf-8"))
    salida = Path(destino)
    (salida / "fotos").mkdir(parents=True, exist_ok=True)
    usados: set[str] = set()
    cuenta = 0

    def guardar(foto, nombre):
        nonlocal cuenta
        if not foto or not str(foto).startswith("data:"):
            return foto
        m = re.match(r"data:([^;,]+)(;base64)?,(.*)", foto, re.S)
        if not m or not m.group(2):
            print(f"  aviso: foto ilegible en {nombre}, se descarta", file=sys.stderr)
            return None
        ext = EXT.get(m.group(1), "webp")
        ruta = f"fotos/{nombre}.{ext}"
        n = 2
        while ruta in usados:
            ruta = f"fotos/{nombre}_{n}.{ext}"
            n += 1
        usados.add(ruta)
        (salida / ruta).write_bytes(base64.b64decode(m.group(3)))
        cuenta += 1
        return ruta

    for p in cat["productos"]:
        base = nombre_archivo(p.get("codigo", "")) or nombre_archivo(p["id"])
        p["foto"] = guardar(p.get("foto"), base)
        p["fotoEspalda"] = guardar(p.get("fotoEspalda"), f"{base}-espalda")
        p["fotos"] = [f for f in (guardar(f, f"{base}-{i + 2}") for i, f in enumerate(p.get("fotos") or [])) if f]
        for c in p.get("colores", []):
            color = nombre_archivo(c.get("codigo") or c["nombre"])
            c["foto"] = guardar(c.get("foto"), f"{base}-muestra-{color}")
            c["fotoProducto"] = guardar(c.get("fotoProducto"), f"{base}-color-{color}")

    (salida / "catalogo.json").write_text(json.dumps(cat, ensure_ascii=False), encoding="utf-8")
    print(f"{len(cat['productos'])} artículos, {cuenta} fotos en {salida / 'fotos'}")


if __name__ == "__main__":
    if len(sys.argv) != 3:
        sys.exit(__doc__)
    main(sys.argv[1], sys.argv[2])

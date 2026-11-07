# claude-skill-seo

> Skill para **Claude Code** que audita el SEO técnico y de contenido de **cualquier web publicada** (con solo su URL) o del **código de tu proyecto**, y te entrega un plan de acción priorizado.

`seo-audit-full` funciona en dos modos:

- **🌐 Modo URL** — pásale un dominio y Claude rastrea la web real: `robots.txt`, sitemap, redirecciones HTTP→HTTPS y `www`, y el HTML de cada página.
- **💻 Modo Código** — sin URL, Claude recorre el código de tu proyecto, reconstruye el inventario de rutas y te dice en qué archivo y línea corregir cada fallo.

En ambos revisa cada página como lo haría un auditor SEO: longitud de títulos y descripciones, jerarquía de encabezados, textos alternativos de imágenes y datos estructurados Schema.org.

---

## ✨ Qué analiza

| Área | Qué comprueba |
|------|---------------|
| **Rutas** | Inventario de todas las URLs públicas y el archivo que las genera (incluidas rutas dinámicas) |
| **`<title>`** | Presencia, unicidad y longitud exacta en caracteres (rango ideal 30–60) |
| **Meta description** | Presencia, unicidad y longitud exacta en caracteres (rango ideal 70–160) |
| **Encabezados H1–H3** | Un único H1 por página, sin saltos de nivel, coherencia con el título |
| **Imágenes** | Atributo `alt` obligatorio, `alt` genéricos o vacíos en imágenes informativas |
| **Schema.org JSON-LD** | JSON válido, `@type` correcto, propiedades requeridas por Google, coherencia con el contenido |
| **Indexación** | Códigos HTTP, cadenas de redirección, HTTPS, variante `www`, `robots.txt`, sitemap, `noindex` / `X-Robots-Tag`, canonical |
| **Técnico** | `lang`, viewport, Open Graph, Twitter Card, hreflang, enlaces rotos, anclas genéricas, contenido mixto, tiempo de respuesta |

Compatible con **Next.js** (App y Pages Router), **Astro**, **Nuxt/Vue**, **SvelteKit**, **Remix**, **Gatsby**, **HTML estático** y temas **WordPress/PHP**.

## 📋 Formato del informe

El resultado se clasifica siempre en cuatro bloques:

- 🚨 **Errores Críticos** — bloquean o perjudican gravemente la indexación.
- ⚠️ **Advertencias** — mejoras importantes que restan rendimiento SEO.
- ✅ **Puntos Correctos** — lo que ya está bien implementado.
- 📋 **Listado de Acción Priorizada** — tabla de tareas ordenadas por impacto y esfuerzo.

Cada hallazgo indica archivo y línea, el valor actual (con su longitud en caracteres) y la corrección propuesta. La auditoría **no modifica archivos**: al terminar, Claude te pregunta si quieres aplicar las correcciones.

---

## ⚙️ Requisitos

- [Claude Code](https://docs.claude.com/en/docs/claude-code/overview) instalado.
- [Node.js](https://nodejs.org/) 18 o superior (para el instalador `npx` y el rastreador del modo URL).
- Git disponible en el sistema (npx lo usa para descargar el paquete desde GitHub).

## 🚀 Instalación

Desde la raíz del proyecto donde quieras usar la skill:

```bash
npx github:BansheeTv/claude-skill-seo
```

Esto crea `.claude/skills/seo-audit-full/SKILL.md` en tu proyecto. Puedes versionarlo con git para que todo tu equipo tenga la skill.

### Opciones

```bash
# Instalar a nivel de usuario (disponible en todos tus proyectos)
npx github:BansheeTv/claude-skill-seo --global

# Sobrescribir una instalación existente sin generar copia .bak
npx github:BansheeTv/claude-skill-seo --force

# Ver la ayuda
npx github:BansheeTv/claude-skill-seo --help
```

### Instalación manual

Si prefieres no usar npx, copia el archivo a mano:

```bash
mkdir -p .claude/skills/seo-audit-full
curl -o .claude/skills/seo-audit-full/SKILL.md \
  https://raw.githubusercontent.com/BansheeTv/claude-skill-seo/main/.claude/skills/seo-audit-full/SKILL.md
```

## 🧑‍💻 Uso

Abre Claude Code (`claude`) y lanza la skill.

**Auditar una web publicada** (cualquier dominio):

```text
/seo-audit-full https://tudominio.com
```

**Auditar el código del proyecto actual:**

```text
/seo-audit-full
```

También puedes pedirlo en lenguaje natural: *"Haz una auditoría SEO de ejemplo.com"*.

### Cómo funciona el modo URL

Claude guarda en un archivo temporal un rastreador Node.js sin dependencias (incluido en la skill) y lo ejecuta. El rastreador:

- se identifica como `claude-skill-seo` y **respeta `robots.txt`**;
- descubre las páginas desde el sitemap (o siguiendo enlaces internos si no hay sitemap);
- analiza hasta 25 páginas por defecto (puedes pedir más, hasta 200);
- devuelve un JSON con todos los datos, que Claude convierte en el informe.

Si el entorno no permite ejecutar comandos con acceso a internet (por ejemplo, en el chat de claude.ai), Claude usa sus herramientas de lectura web y marca el informe como **parcial**.

> Audita solo webs públicas. La skill no accede a zonas con login ni intenta sortear protecciones anti-bots.

## 📁 Estructura del repositorio

```
claude-skill-seo/
├── .claude/
│   └── skills/
│       └── seo-audit-full/
│           └── SKILL.md      # Instrucciones de la skill
├── scripts/
│   └── install.js            # Instalador ejecutado por npx
├── package.json
└── README.md
```

## 🔄 Actualizar

Vuelve a ejecutar el comando de instalación. Si tu copia local difiere de la nueva versión, el instalador guarda la anterior como `SKILL.md.bak` antes de sustituirla.

## 🗑️ Desinstalar

```bash
rm -rf .claude/skills/seo-audit-full
```

## 📄 Licencia

MIT © [BansheeTv](https://github.com/BansheeTv)

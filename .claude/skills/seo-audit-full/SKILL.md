---
name: seo-audit-full
description: "Analiza el SEO técnico y de contenido de todo el proyecto"
---

# Auditoría SEO completa (código o web publicada)

Eres un auditor SEO técnico senior. Tu tarea es auditar un sitio web, detectar sus fallos de SEO técnico y de contenido y entregar un informe accionable **en español**.

Trabaja solo con lo que puedas verificar. No inventes páginas, métricas ni datos de tráfico. Si algo no se puede comprobar, márcalo como **"no verificable"** y explica por qué.

Argumentos de la invocación (en Claude Code): $ARGUMENTS

---

## Fase 0 — Elegir el modo

- **Modo URL**: el usuario ha dado una URL o un dominio (`https://ejemplo.com`, `ejemplo.com`, `www.ejemplo.es/blog`). Audita la web publicada → Fase 1B.
- **Modo Código**: no hay URL y estás dentro de un proyecto con código fuente (o el usuario ha adjuntado archivos o indicado un repositorio) → Fase 1A.
- Si hay **ambos** (código y dominio de producción), haz el modo URL y usa el código para localizar en qué archivo se corrige cada fallo.
- Si no hay ni URL ni código, pide al usuario la URL de la web que quiere auditar. No hagas nada más hasta tenerla.

Indica el modo elegido en la primera línea de tu respuesta.

---

## Fase 1A — Modo Código: reconocimiento del proyecto

1. Identifica el framework leyendo `package.json`, archivos de configuración y la estructura de carpetas:
   - **Next.js App Router**: `app/**/page.*`, `layout.*`, `export const metadata`, `generateMetadata()`.
   - **Next.js Pages Router**: `pages/**/*`, `next/head`, `_document.*`, `_app.*`.
   - **Astro**: `src/pages/**/*.astro|md|mdx`, componentes de `<head>` en layouts.
   - **Nuxt / Vue**: `pages/**/*.vue`, `useHead()`, `useSeoMeta()`.
   - **SvelteKit**: `src/routes/**/+page.svelte`, `<svelte:head>`.
   - **Gatsby / Remix / React Router**: export `Head`/`meta`, `react-helmet`.
   - **HTML estático**: todos los `*.html`.
   - **WordPress / PHP**: `header.php`, `single.php`, `page.php`, `wp_head()`, plugins SEO.
2. Excluye siempre: `node_modules/`, `.next/`, `dist/`, `build/`, `out/`, `.git/`, `vendor/`, `coverage/`, `.vercel/`, `.cache/`.
3. Construye el **inventario de rutas**: cada URL pública y el archivo que la produce. Señala las rutas dinámicas (`[slug]`, `:id`) y de dónde sacan sus metadatos.
4. Localiza los archivos SEO globales: `robots.txt`/`robots.ts`, `sitemap.xml`/`sitemap.ts`, `metadataBase`, `lang` del `<html>`, canonical.
5. Ten en cuenta la herencia (layouts, `title.template`, componentes SEO compartidos): el valor que cuenta es el que llega al HTML final. Sigue los imports locales para reconstruir encabezados e imágenes de cada página.

Usa Glob/Grep para cubrir todo el proyecto antes de abrir archivos. En proyectos grandes prioriza: home, plantillas de rutas dinámicas, layouts y después páginas sueltas.

---

## Fase 1B — Modo URL: rastreo de la web publicada

Necesitas el **HTML original** de cada página (con su `<head>` y sus `<script type="application/ld+json">`), no una versión convertida a texto. Usa la primera opción disponible:

### Opción 1 (preferida) — rastreador incluido

Si puedes ejecutar comandos con acceso a internet (Claude Code en local) y hay Node.js 18 o superior (`node -v`):

1. Guarda el script de abajo en un archivo temporal, por ejemplo `/tmp/seo-crawl.mjs` (o en el directorio temporal del sistema). **No lo guardes dentro del proyecto del usuario.**
2. Ejecútalo: `node /tmp/seo-crawl.mjs <url> 25 > /tmp/seo-informe.json`
   - El segundo argumento es el máximo de páginas (25 por defecto, hasta 200). Si el usuario pide una auditoría más amplia, súbelo.
3. Lee el JSON resultante y úsalo como fuente de verdad para la Fase 2. Si una petición devuelve error de red, informa de ello y no lo cuentes como fallo SEO de la web.

El script: comprueba la redirección HTTP→HTTPS y la variante con/sin `www`; lee `robots.txt` y respeta sus `Disallow`; descubre las URLs desde el sitemap (incluidos índices de sitemaps) o, si no hay sitemap, siguiendo enlaces internos; y extrae de cada página estado HTTP, redirecciones, tiempo de respuesta, `lang`, title y description con su longitud, canonical, meta robots, `X-Robots-Tag`, viewport, hreflang, Open Graph, Twitter Card, encabezados H1–H3, imágenes y sus `alt`, bloques JSON-LD (validados), enlaces y contenido mixto. También detecta títulos y descripciones duplicados.

```javascript
#!/usr/bin/env node
// seo-crawl.mjs — rastreador SEO sin dependencias (Node 18+)
// Uso: node seo-crawl.mjs <url|dominio> [maxPaginas=25] > informe.json
const UA = 'Mozilla/5.0 (compatible; claude-skill-seo/1.1; +https://github.com/BansheeTv/claude-skill-seo)';
const input = process.argv[2];
const MAX = Math.min(parseInt(process.argv[3] || '25', 10) || 25, 200);
if (!input) { console.error('Uso: node seo-crawl.mjs <url> [maxPaginas]'); process.exit(1); }
const start = new URL(/^https?:\/\//i.test(input) ? input : `https://${input}`);
const origin = start.origin;

const decode = (s = '') => s
  .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
  .replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'")
  .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n))
  .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)));
const text = (s = '') => decode(s.replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
const attr = (tag, name) => {
  const m = tag.match(new RegExp(`\\s${name}\\s*=\\s*("([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i'));
  return m ? decode(m[2] ?? m[3] ?? m[4] ?? '') : null;
};
const tags = (html, name) => html.match(new RegExp(`<${name}\\b[^>]*>`, 'gi')) || [];

async function get(url, timeoutMs = 15000) {
  const t0 = Date.now();
  const chain = [];
  let current = url;
  try {
    for (let i = 0; i < 10; i++) {
      const res = await fetch(current, { redirect: 'manual', headers: { 'User-Agent': UA, Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8' }, signal: AbortSignal.timeout(timeoutMs) });
      if (res.status >= 300 && res.status < 400 && res.headers.get('location')) {
        const next = new URL(res.headers.get('location'), current).href;
        chain.push({ from: current, to: next, status: res.status });
        current = next;
        continue;
      }
      const body = await res.text();
      return { status: res.status, finalUrl: current, redirects: chain, headers: Object.fromEntries(res.headers), body, ms: Date.now() - t0 };
    }
    return { status: 0, finalUrl: current, redirects: chain, error: 'Demasiadas redirecciones', ms: Date.now() - t0 };
  } catch (e) {
    return { status: 0, finalUrl: current, redirects: chain, error: String(e.message || e), ms: Date.now() - t0 };
  }
}

function parseRobots(txt = '') {
  const disallow = []; const sitemaps = []; let applies = false;
  for (const raw of txt.split(/\r?\n/)) {
    const line = raw.replace(/#.*/, '').trim(); if (!line) continue;
    const [k, ...rest] = line.split(':'); const v = rest.join(':').trim(); const key = k.trim().toLowerCase();
    if (key === 'user-agent') applies = v === '*' || /claude-skill-seo/i.test(v);
    else if (key === 'disallow' && applies && v) disallow.push(v);
    else if (key === 'sitemap') sitemaps.push(v);
  }
  return { disallow, sitemaps };
}
const allowed = (url, disallow) => { const p = new URL(url).pathname; return !disallow.some((d) => p.startsWith(d.replace(/\*.*$/, ''))); };

async function sitemapUrls(urls, limit, depth = 0) {
  const out = new Set(); const checked = [];
  for (const sm of urls) {
    if (out.size >= limit || depth > 2) break;
    const r = await get(sm);
    checked.push({ url: sm, status: r.status });
    if (r.status !== 200 || !r.body) continue;
    const locs = [...r.body.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/gi)].map((m) => decode(m[1]));
    if (/<sitemapindex/i.test(r.body)) {
      const sub = await sitemapUrls(locs, limit - out.size, depth + 1);
      sub.urls.forEach((u) => out.add(u)); checked.push(...sub.checked);
    } else locs.forEach((u) => out.size < limit && out.add(u));
  }
  return { urls: [...out], checked };
}

function analyze(page) {
  const html = page.body || '';
  const head = (html.match(/<head\b[^>]*>([\s\S]*?)<\/head>/i) || [, html])[1];
  const jsonld = [...html.matchAll(/<script\b[^>]*type\s*=\s*["']?application\/ld\+json["']?[^>]*>([\s\S]*?)<\/script>/gi)].map((m) => {
    const raw = m[1].trim();
    try {
      const data = JSON.parse(raw);
      const types = []; const walk = (o) => { if (Array.isArray(o)) o.forEach(walk); else if (o && typeof o === 'object') { if (o['@type']) types.push(...[].concat(o['@type'])); Object.values(o).forEach(walk); } };
      walk(data);
      return { valid: true, types, data };
    } catch (e) { return { valid: false, error: e.message, raw: raw.slice(0, 2000) }; }
  });
  const body = html.replace(/<script\b[\s\S]*?<\/script>/gi, '').replace(/<style\b[\s\S]*?<\/style>/gi, '').replace(/<!--[\s\S]*?-->/g, '');
  const metas = tags(head, 'meta');
  const meta = (key, val) => { const t = metas.find((m) => (attr(m, key) || '').toLowerCase() === val); return t ? attr(t, 'content') : null; };
  const links = tags(head, 'link');
  const titleRaw = (head.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i) || [])[1];
  const title = titleRaw != null ? text(titleRaw) : null;
  const description = meta('name', 'description');
  const headings = [...body.matchAll(/<h([1-3])\b[^>]*>([\s\S]*?)<\/h\1>/gi)].map((m) => ({ level: +m[1], text: text(m[2]).slice(0, 150) }));
  const images = tags(body, 'img').map((t) => ({ src: attr(t, 'src') || attr(t, 'data-src'), alt: attr(t, 'alt'), hasAlt: /\salt\s*(=|\s|>|\/)/i.test(t) }));
  const anchors = tags(body, 'a').map((t) => attr(t, 'href')).filter(Boolean);
  const internal = []; let external = 0;
  for (const h of anchors) {
    if (/^(mailto:|tel:|javascript:|#)/i.test(h)) continue;
    try { const u = new URL(h, page.finalUrl); if (u.origin === origin) internal.push(u.href.split('#')[0]); else external++; } catch {}
  }
  const genericAnchors = [...body.matchAll(/<a\b[^>]*>([\s\S]*?)<\/a>/gi)].map((m) => text(m[1]).toLowerCase()).filter((t) => /^(clic aquí|click aquí|haz clic aquí|aquí|leer más|ver más|más|click here|read more|here)$/.test(t)).length;
  const mixed = page.finalUrl.startsWith('https:') ? (html.match(/(?:src|href)\s*=\s*["']http:\/\/[^"']+/gi) || []).length : 0;
  return {
    url: page.url, finalUrl: page.finalUrl, status: page.status, redirects: page.redirects, responseMs: page.ms, htmlKB: Math.round(html.length / 1024),
    xRobotsTag: page.headers?.['x-robots-tag'] || null, error: page.error || null,
    lang: (html.match(/<html\b[^>]*>/i) || [''])[0] ? attr((html.match(/<html\b[^>]*>/i) || [''])[0], 'lang') : null,
    title, titleLength: title != null ? [...title].length : null,
    description, descriptionLength: description != null ? [...description].length : null,
    titleCount: (head.match(/<title\b/gi) || []).length, descriptionCount: metas.filter((m) => (attr(m, 'name') || '').toLowerCase() === 'description').length,
    canonical: (links.find((l) => (attr(l, 'rel') || '').toLowerCase() === 'canonical') && attr(links.find((l) => (attr(l, 'rel') || '').toLowerCase() === 'canonical'), 'href')) || null,
    robots: meta('name', 'robots'), viewport: meta('name', 'viewport'),
    hreflang: links.filter((l) => (attr(l, 'rel') || '').toLowerCase() === 'alternate' && attr(l, 'hreflang')).map((l) => ({ lang: attr(l, 'hreflang'), href: attr(l, 'href') })),
    openGraph: { title: meta('property', 'og:title'), description: meta('property', 'og:description'), image: meta('property', 'og:image'), url: meta('property', 'og:url'), type: meta('property', 'og:type') },
    twitter: { card: meta('name', 'twitter:card'), image: meta('name', 'twitter:image') },
    h1Count: headings.filter((h) => h.level === 1).length, headings,
    images: { total: images.length, missingAlt: images.filter((i) => !i.hasAlt).map((i) => i.src), emptyAlt: images.filter((i) => i.hasAlt && !i.alt).map((i) => i.src), withAlt: images.filter((i) => i.alt).map((i) => ({ src: i.src, alt: i.alt })) },
    jsonld, links: { internal: [...new Set(internal)].length, external, genericAnchors }, mixedContent: mixed,
    likelyClientRendered: text(body).length < 200 && /<script\b[^>]*src=/i.test(html),
    _internalLinks: [...new Set(internal)],
  };
}

const site = { input, origin, crawledAt: new Date().toISOString(), maxPages: MAX };
const httpCheck = await get(`http://${start.host}/`);
site.httpToHttps = { status: httpCheck.status, finalUrl: httpCheck.finalUrl, redirects: httpCheck.redirects };
const altHost = start.host.startsWith('www.') ? start.host.slice(4) : `www.${start.host}`;
const wwwCheck = await get(`https://${altHost}/`);
site.wwwVariant = { host: altHost, status: wwwCheck.status, finalUrl: wwwCheck.finalUrl, error: wwwCheck.error || null };
const robots = await get(`${origin}/robots.txt`);
const parsedRobots = robots.status === 200 ? parseRobots(robots.body) : { disallow: [], sitemaps: [] };
site.robotsTxt = { status: robots.status, content: robots.status === 200 ? robots.body.slice(0, 4000) : null, ...parsedRobots };
const sm = await sitemapUrls(parsedRobots.sitemaps.length ? parsedRobots.sitemaps : [`${origin}/sitemap.xml`, `${origin}/sitemap_index.xml`], 5000);
site.sitemap = { checked: sm.checked, totalUrls: sm.urls.length };

const queue = [start.href, ...sm.urls.filter((u) => { try { return new URL(u).origin === origin; } catch { return false; } })];
const seen = new Set(); const pages = []; const skippedByRobots = [];
while (queue.length && pages.length < MAX) {
  const batch = [];
  while (queue.length && batch.length < 4 && pages.length + batch.length < MAX) {
    const u = queue.shift().split('#')[0];
    if (seen.has(u)) continue; seen.add(u);
    if (!allowed(u, parsedRobots.disallow)) { skippedByRobots.push(u); continue; }
    batch.push(u);
  }
  const results = await Promise.all(batch.map(async (u) => { const r = await get(u); return analyze({ url: u, ...r }); }));
  for (const p of results) {
    pages.push(p);
    if (!sm.urls.length) p._internalLinks.forEach((l) => !seen.has(l) && queue.push(l));
  }
}
for (const p of pages) delete p._internalLinks;

const dup = (key) => { const m = {}; pages.forEach((p) => p[key] && (m[p[key]] ||= []).push(p.finalUrl)); return Object.entries(m).filter(([, v]) => v.length > 1).map(([value, urls]) => ({ value, urls })); };
site.summary = {
  pagesCrawled: pages.length, skippedByRobots,
  duplicateTitles: dup('title'), duplicateDescriptions: dup('description'),
  sitemapUrlsNotCrawled: Math.max(0, sm.urls.length - pages.length),
};
console.log(JSON.stringify({ site, pages }, null, 2));
```

### Opción 2 — herramienta de scraping con HTML en bruto

Si no puedes ejecutar comandos con internet pero tienes una herramienta que devuelve el **HTML en bruto** de una URL (por ejemplo un scraper con formato `rawHtml`), descarga con ella `robots.txt`, el sitemap y las páginas (hasta 10–15 representativas: home, categorías, fichas, artículos, contacto) y aplica tú las comprobaciones de la Fase 2.

### Opción 3 — lectura web estándar (cobertura parcial)

Si solo dispones de una lectura web que convierte la página a texto/Markdown (como WebFetch):

- Pide explícitamente en cada lectura que te devuelva **literalmente** el `<title>`, la meta description, el canonical, la meta robots, los encabezados H1–H3 en orden, los `alt` de las imágenes y el contenido completo de cualquier `<script type="application/ld+json">`.
- Revisa `robots.txt` y `sitemap.xml` y audita un máximo de 10 páginas representativas.
- Avisa en el informe de que el modo es **parcial**: los datos estructurados, la meta robots y los atributos `alt` pueden no ser fiables con este método. Marca como "no verificable" lo que no hayas podido confirmar.

### Reglas del modo URL

- Audita solo webs públicas. No intentes acceder a zonas con login ni sortear bloqueos o protecciones anti-bots; si la web bloquea el rastreo, indícalo.
- Si la página parece renderizada en el cliente (`likelyClientRendered: true` o HTML casi vacío), avísalo como ⚠️: los buscadores pueden no ver el contenido.
- En modo URL, la ubicación de cada hallazgo es la **URL** (y el selector o fragmento HTML cuando ayude), no un archivo.

---

## Fase 2 — Comprobaciones

Aplica estos criterios a **cada página** del inventario (modo Código) o del rastreo (modo URL).

### 2.1 Etiqueta `<title>`

- Indica siempre el texto final y su **número exacto de caracteres**, p. ej. `"Calculadora de cuello de botella | Marca" (41 caracteres)`.
- ❌ **Crítico**: ausente, vacío, varias etiquetas `<title>`, o idéntico en varias páginas.
- ⚠️ **Advertencia**: menos de 30 o más de 60 caracteres (riesgo de truncado en Google).
- ✅ **Correcto**: 30–60 caracteres, único, con la palabra clave principal al inicio.
- Si en modo Código el título es dinámico, indica la plantilla y un rango estimado.

### 2.2 Meta description

- Indica el valor y su **número exacto de caracteres**.
- ❌ **Crítico**: ausente o vacía en una página indexable, o duplicada en varias páginas.
- ⚠️ **Advertencia**: menos de 70 o más de 160 caracteres.
- ✅ **Correcto**: 70–160 caracteres, única, descriptiva y con llamada a la acción.

### 2.3 Jerarquía de encabezados H1–H3

- ❌ **Crítico**: sin `<h1>` o con más de un `<h1>`.
- ⚠️ **Advertencia**: saltos de nivel (`h1` → `h3` sin `h2`), encabezados vacíos o puramente decorativos, o H1 sin relación con el `<title>`.
- ✅ **Correcto**: un único H1 descriptivo y una estructura H2/H3 lógica.
- Cuando haya problemas, muestra el árbol de forma compacta:
  ```
  H1 Calculadora de cuello de botella
    H3 ← salto de nivel (falta H2)
  ```

### 2.4 Atributo `alt` en imágenes (obligatorio)

- Revisa `<img>`, `next/image`, `<picture>`, componentes de imagen propios, imágenes en Markdown/MDX y plantillas.
- ❌ **Crítico**: `alt` ausente en cualquier imagen.
- ⚠️ **Advertencia**: `alt=""` en una imagen que parece informativa, `alt` genérico ("imagen", "foto", "logo", nombres de archivo como `IMG_1234.jpg`), más de 125 caracteres, o relleno de palabras clave.
- ✅ **Correcto**: `alt` descriptivo y conciso; `alt=""` solo en imágenes decorativas.
- Lista cada imagen problemática con su ubicación (`archivo:línea` o URL de la página + `src`). Si son muchas, agrúpalas.

### 2.5 Datos estructurados Schema.org (JSON-LD)

- Para cada bloque: valida que el JSON parsea, que tiene `@context: "https://schema.org"` y un `@type` válido.
- Propiedades que exige o recomienda Google según el tipo: `Organization` (name, url, logo), `WebSite` (name, url), `Article`/`BlogPosting` (headline, image, datePublished, author), `Product` (name, image, offers o review/aggregateRating), `BreadcrumbList` (itemListElement con position, name, item), `FAQPage` (mainEntity → Question/acceptedAnswer), `LocalBusiness` (name, address, telephone), `SoftwareApplication`/`WebApplication` (name, applicationCategory, offers).
- Comprueba que el JSON-LD coincide con el contenido visible.
- ❌ **Crítico**: JSON inválido, `@type` inexistente o propiedades obligatorias ausentes.
- ⚠️ **Advertencia**: ninguna página tiene datos estructurados, faltan propiedades recomendadas, o falta un tipo evidente (un blog sin `Article`, una home sin `Organization`/`WebSite`, una tienda sin `Product`).
- ✅ **Correcto**: JSON-LD válido, completo y coherente.

### 2.6 Indexación y técnica

- **Estado HTTP** (modo URL): ❌ páginas 4xx/5xx enlazadas o en el sitemap; ⚠️ cadenas de más de una redirección o redirecciones 302 donde debería haber 301.
- **HTTPS y dominio canónico** (modo URL): ❌ HTTP no redirige a HTTPS; ⚠️ las variantes con y sin `www` no redirigen a una sola; ⚠️ contenido mixto (`http://` en una página HTTPS).
- **robots.txt**: ❌ bloquea secciones importantes o todo el sitio; ⚠️ no existe o no declara el sitemap.
- **Sitemap**: ⚠️ no existe, contiene URLs que redirigen o dan error, o no incluye páginas importantes.
- **noindex**: ❌ `noindex` (meta robots o `X-Robots-Tag`) en páginas que deberían posicionar.
- **Canonical**: ⚠️ ausente en páginas indexables, relativo, o apuntando a otra URL sin motivo.
- **`lang`** en `<html>`: ⚠️ ausente o no coincide con el idioma del contenido.
- **Viewport**: ❌ ausente (la página no es apta para móvil).
- **Open Graph / Twitter Card**: ⚠️ faltan `og:title`, `og:description`, `og:image` o `twitter:card`.
- **hreflang**: ⚠️ incompleto o sin recíproco en webs multidioma.
- **Enlaces**: ⚠️ enlaces internos rotos y textos de anclaje genéricos ("clic aquí", "leer más").
- **Rendimiento básico** (modo URL, orientativo): ⚠️ tiempo de respuesta del HTML superior a 1.500 ms o HTML de más de 500 KB. Recomienda revisar Core Web Vitals en PageSpeed Insights; no inventes valores de LCP/CLS/INP.

---

## Fase 3 — Formato de salida (obligatorio)

Entrega el informe en Markdown con **exactamente** esta estructura. Cada hallazgo incluye ubicación (archivo:línea o URL), valor actual con su longitud en caracteres cuando aplique, el problema y la solución concreta.

```markdown
# Auditoría SEO — <dominio o nombre del proyecto>

**Modo:** URL (rastreador) | URL (parcial) | Código
**Framework / CMS detectado:** <si se puede saber>
**Páginas analizadas:** <n> · **Imágenes:** <n> · **Bloques JSON-LD:** <n>
**Puntuación global:** <0–100>/100
<una línea explicando el cálculo>

## 🗺️ Inventario de páginas

| Página | Estado | Title (caracteres) | Description (caracteres) | H1 | JSON-LD |
|--------|--------|--------------------|--------------------------|----|---------|
| / | 200 | 52 ✅ | 148 ✅ | 1 ✅ | WebSite ✅ |

## 🚨 Errores Críticos

1. **<Problema>** — `<ubicación>`
   - **Actual:** `<valor>` (N caracteres)
   - **Problema:** <explicación breve>
   - **Solución:** <corrección concreta, con fragmento de código si ayuda>

## ⚠️ Advertencias

1. ... (mismo formato)

## ✅ Puntos Correctos

- <qué está bien y dónde>

## 📋 Listado de Acción Priorizada

| # | Prioridad | Acción | Páginas / archivos afectados | Impacto | Esfuerzo |
|---|-----------|--------|------------------------------|---------|----------|
| 1 | 🔴 Alta | ... | ... | Alto | Bajo |
| 2 | 🟠 Media | ... | ... | Medio | Bajo |
| 3 | 🟢 Baja | ... | ... | Bajo | Medio |
```

### Reglas del informe

- Si una sección no tiene hallazgos, dilo ("No se han encontrado errores críticos.") en lugar de omitirla.
- Agrupa los problemas repetidos ("14 imágenes sin `alt` en 6 páginas") y lista las ubicaciones debajo.
- **Puntuación**: empieza en 100, resta 10 por cada *tipo* de error crítico y 3 por cada *tipo* de advertencia (mínimo 0).
- Escribe para alguien que quizá no sea técnico: explica en una frase por qué importa cada fallo, sin jerga innecesaria.
- No modifiques ningún archivo durante la auditoría.
- Al terminar:
  - **Modo Código**: pregunta si quieres que aplique automáticamente las correcciones del 📋 Listado de Acción Priorizada, empezando por las de prioridad alta.
  - **Modo URL**: ofrece generar el código corregido (etiquetas `<title>`/`<meta>`, bloques JSON-LD listos para pegar, `robots.txt`) o aplicar los cambios si el usuario comparte el código del sitio.

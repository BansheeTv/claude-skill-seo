---
name: seo-audit-full
description: "Analiza el SEO técnico y de contenido de todo el proyecto"
---

# Auditoría SEO completa del proyecto

Eres un auditor SEO técnico senior. Tu tarea es escanear **todo el proyecto web del directorio actual**, detectar problemas de SEO técnico y de contenido, y entregar un informe accionable en español.

Trabaja solo con lo que encuentres en el código. No inventes páginas, métricas ni datos de tráfico. Si algo no se puede determinar desde el código (por ejemplo, contenido que se carga de una API en tiempo de ejecución), indícalo explícitamente como "no verificable estáticamente".

---

## Fase 1 — Reconocimiento del proyecto

1. Identifica el framework o tipo de proyecto leyendo `package.json`, archivos de configuración y la estructura de carpetas:
   - **Next.js App Router**: `app/**/page.(tsx|jsx|js|ts|mdx)`, `layout.*`, `export const metadata`, `generateMetadata()`.
   - **Next.js Pages Router**: `pages/**/*.(tsx|jsx|js)`, `next/head`, `_document.*`, `_app.*`.
   - **Astro**: `src/pages/**/*.astro|md|mdx`, componentes `<SEO>`/`<head>` en layouts.
   - **Nuxt / Vue**: `pages/**/*.vue`, `useHead()`, `useSeoMeta()`, `definePageMeta()`.
   - **SvelteKit**: `src/routes/**/+page.svelte`, `<svelte:head>`.
   - **Gatsby / Remix / React Router**: rutas y componentes de head equivalentes (`Head` export, `meta` export, `react-helmet`).
   - **HTML estático**: todos los `*.html`.
   - **WordPress / PHP**: plantillas `*.php` (`header.php`, `single.php`, `page.php`), `wp_head()`, `add_theme_support('title-tag')`.
2. Excluye siempre: `node_modules/`, `.next/`, `dist/`, `build/`, `out/`, `.git/`, `vendor/`, `coverage/`, `.vercel/`, `.cache/`.
3. Construye un **inventario de rutas**: lista cada URL pública que el proyecto genera y el archivo que la produce. Señala las rutas dinámicas (`[slug]`, `:id`, `[...params]`) y cómo obtienen sus metadatos.
4. Localiza también los archivos SEO globales: `robots.txt` / `robots.ts`, `sitemap.xml` / `sitemap.ts`, `manifest`, `favicon`, configuración de `metadataBase`, `lang` del `<html>` y URLs canónicas.

Usa búsquedas en el código (Glob/Grep) para cubrir todo el proyecto antes de abrir archivos individuales. Si el proyecto tiene muchas rutas, prioriza: home, plantillas de rutas dinámicas, layouts compartidos y después páginas sueltas.

---

## Fase 2 — Comprobaciones

Para **cada ruta** del inventario, evalúa los siguientes puntos. Ten en cuenta la herencia de metadatos (layouts, plantillas `title.template`, componentes SEO compartidos): el valor efectivo de una página es el que llega al HTML final.

### 2.1 Etiqueta `<title>`

- Extrae el texto final (resolviendo plantillas como `%s | Marca` cuando sea posible).
- **Cuenta los caracteres exactos** e indícalos en el informe, p. ej. `"Calculadora de cuello de botella | ComboCreador" (48 caracteres)`.
- Criterios:
  - ❌ **Crítico**: ausente, vacío, o idéntico en varias rutas distintas.
  - ⚠️ **Advertencia**: menos de 30 caracteres o más de 60 caracteres (riesgo de truncado en Google).
  - ✅ **Correcto**: entre 30 y 60 caracteres, único y con la palabra clave principal al inicio.
- Si el título es dinámico y no puedes calcular su longitud, indica la plantilla y el rango estimado.

### 2.2 Meta description

- Extrae el valor final de `<meta name="description">` (o `metadata.description`, `useSeoMeta({ description })`, etc.).
- **Cuenta los caracteres exactos** e indícalos.
- Criterios:
  - ❌ **Crítico**: ausente o vacía en una página indexable, o duplicada en varias rutas.
  - ⚠️ **Advertencia**: menos de 70 caracteres o más de 160 caracteres.
  - ✅ **Correcto**: entre 70 y 160 caracteres, única, descriptiva y con llamada a la acción.

### 2.3 Jerarquía de encabezados H1–H3

- Recorre el JSX/HTML/plantillas de cada página **incluyendo los componentes que importa** (sigue los imports locales) para reconstruir el árbol de encabezados.
- Criterios:
  - ❌ **Crítico**: la página no tiene `<h1>`, o tiene más de un `<h1>`.
  - ⚠️ **Advertencia**: saltos de nivel (por ejemplo `h1` → `h3` sin `h2`), encabezados vacíos, encabezados usados solo por estilo visual, o H1 que no coincide temáticamente con el `<title>`.
  - ✅ **Correcto**: un único H1 descriptivo y una estructura H2/H3 lógica y secuencial.
- Muestra el árbol resultante de forma compacta cuando haya problemas, p. ej.:
  ```
  H1 Calculadora de cuello de botella
    H2 Cómo funciona
      H3 CPU
    H3 ← salto de nivel (falta H2)
  ```

### 2.4 Atributo `alt` en imágenes (obligatorio)

- Busca todas las imágenes: `<img>`, `next/image` `<Image>`, `<picture>`/`<source>`, componentes de imagen propios, `background-image` con contenido informativo, imágenes en Markdown/MDX `![alt](src)` e imágenes en PHP/plantillas.
- Criterios:
  - ❌ **Crítico**: `alt` ausente en cualquier imagen.
  - ⚠️ **Advertencia**: `alt` vacío (`alt=""`) en una imagen que parece informativa (no decorativa), `alt` genérico ("imagen", "foto", "logo", nombre de archivo como `IMG_1234.jpg`), `alt` de más de 125 caracteres, o relleno de palabras clave.
  - ✅ **Correcto**: `alt` descriptivo y conciso; `alt=""` solo en imágenes puramente decorativas.
- Reporta **cada imagen problemática con ruta de archivo y número de línea** (`components/Hero.tsx:42`).

### 2.5 Datos estructurados Schema.org (JSON-LD)

- Busca `<script type="application/ld+json">`, `dangerouslySetInnerHTML` con JSON-LD, librerías como `next-seo`, `schema-dts`, o plugins de WordPress (Yoast, Rank Math).
- Para cada bloque encontrado:
  - Valida que sea **JSON sintácticamente correcto** (ojo con comas finales y comillas en plantillas).
  - Comprueba `@context: "https://schema.org"` y un `@type` válido.
  - Comprueba las propiedades requeridas/recomendadas por Google según el tipo: `Organization` (name, url, logo), `WebSite` (name, url, potentialAction/SearchAction), `Article`/`BlogPosting` (headline, image, datePublished, author), `Product` (name, image, offers o review/aggregateRating), `BreadcrumbList` (itemListElement con position, name, item), `FAQPage` (mainEntity con Question/acceptedAnswer), `LocalBusiness` (name, address, telephone), `SoftwareApplication`/`WebApplication` (name, applicationCategory, offers).
  - Verifica que los datos del JSON-LD coinciden con el contenido visible de la página.
- Criterios:
  - ❌ **Crítico**: JSON-LD inválido (no parsea), `@type` inexistente, o propiedades obligatorias ausentes.
  - ⚠️ **Advertencia**: ninguna página tiene datos estructurados, faltan propiedades recomendadas, o falta un tipo obvio para el contenido (p. ej. un blog sin `Article`, una home sin `Organization`/`WebSite`).
  - ✅ **Correcto**: JSON-LD válido, completo y coherente con el contenido.

### 2.6 Comprobaciones técnicas complementarias

Evalúa también, de forma global:

- `lang` en `<html>` presente y correcto para el idioma del contenido.
- URL canónica (`<link rel="canonical">` / `alternates.canonical`) en cada página indexable, y `metadataBase` o URLs absolutas configuradas.
- `robots.txt` existe y no bloquea secciones importantes; `sitemap` existe e incluye las rutas públicas del inventario.
- `noindex` accidental en páginas que deberían indexarse (o páginas privadas indexables).
- Open Graph (`og:title`, `og:description`, `og:image`, `og:url`) y Twitter Card.
- `<meta name="viewport">` presente.
- Enlaces internos rotos evidentes (enlaces a rutas que no existen en el inventario) y enlaces con texto de anclaje genérico ("clic aquí", "leer más").
- `hreflang` si el proyecto es multidioma.

---

## Fase 3 — Formato de salida (obligatorio)

Entrega el informe en español, en Markdown, con **exactamente** esta estructura. Cada hallazgo debe incluir el archivo (y línea cuando sea posible), qué está mal, el valor actual con su longitud en caracteres cuando aplique, y cómo corregirlo.

```markdown
# Auditoría SEO — <nombre del proyecto>

**Framework detectado:** <framework>
**Rutas analizadas:** <n> · **Imágenes analizadas:** <n> · **Bloques JSON-LD:** <n>
**Puntuación global:** <0–100>/100

## 🗺️ Inventario de rutas

| Ruta | Archivo | Title (caracteres) | Description (caracteres) | H1 | JSON-LD |
|------|---------|--------------------|--------------------------|----|---------|
| / | app/page.tsx | 52 ✅ | 148 ✅ | 1 ✅ | WebSite ✅ |

## 🚨 Errores Críticos

Problemas que impiden o perjudican gravemente la indexación o el posicionamiento.

1. **<Título corto del problema>** — `ruta/archivo.tsx:línea`
   - **Actual:** `<valor actual>` (N caracteres)
   - **Problema:** <explicación breve>
   - **Solución:** <corrección concreta, con fragmento de código si ayuda>

## ⚠️ Advertencias

Mejoras importantes que no bloquean la indexación pero restan rendimiento SEO.

1. ... (mismo formato)

## ✅ Puntos Correctos

Lo que ya está bien implementado (sé concreto: qué y dónde).

- ...

## 📋 Listado de Acción Priorizada

Tareas ordenadas por impacto/esfuerzo. Empieza por los errores críticos que afectan a más páginas.

| # | Prioridad | Acción | Archivos afectados | Impacto | Esfuerzo |
|---|-----------|--------|--------------------|---------|----------|
| 1 | 🔴 Alta | ... | ... | Alto | Bajo |
| 2 | 🟠 Media | ... | ... | Medio | Bajo |
| 3 | 🟢 Baja | ... | ... | Bajo | Medio |
```

### Reglas del informe

- Si una sección no tiene hallazgos, escríbelo explícitamente ("No se han encontrado errores críticos.") en lugar de omitirla.
- Agrupa los problemas repetidos (por ejemplo, "14 imágenes sin `alt`") y lista todas las ubicaciones debajo, en lugar de crear 14 entradas separadas.
- La puntuación global se calcula partiendo de 100 y restando 10 por cada tipo de error crítico y 3 por cada tipo de advertencia (mínimo 0). Explica el cálculo en una línea debajo de la puntuación.
- No modifiques ningún archivo durante la auditoría. Al final, pregunta al usuario si quiere que apliques automáticamente las correcciones del 📋 Listado de Acción Priorizada, empezando por las de prioridad alta.

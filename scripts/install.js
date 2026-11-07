#!/usr/bin/env node
'use strict';

/**
 * claude-skill-seo — instalador
 *
 * Copia la skill "seo-audit-full" en .claude/skills/seo-audit-full/ del
 * proyecto desde el que se ejecuta (process.cwd()).
 *
 * Uso:
 *   npx github:BansheeTv/claude-skill-seo            # instala en el proyecto actual
 *   npx github:BansheeTv/claude-skill-seo --global   # instala en ~/.claude/skills
 *   npx github:BansheeTv/claude-skill-seo --force    # sobrescribe sin preguntar
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

const SKILL_NAME = 'seo-audit-full';
const SKILL_FILE = 'SKILL.md';

const args = process.argv.slice(2);
const flags = {
  global: args.includes('--global') || args.includes('-g'),
  force: args.includes('--force') || args.includes('-f'),
  help: args.includes('--help') || args.includes('-h'),
};

const c = {
  green: (s) => `\x1b[32m${s}\x1b[0m`,
  yellow: (s) => `\x1b[33m${s}\x1b[0m`,
  red: (s) => `\x1b[31m${s}\x1b[0m`,
  cyan: (s) => `\x1b[36m${s}\x1b[0m`,
  bold: (s) => `\x1b[1m${s}\x1b[0m`,
};

function printHelp() {
  console.log(`
${c.bold('claude-skill-seo')} — instala la skill ${c.cyan(SKILL_NAME)} para Claude Code

${c.bold('Uso:')}
  npx github:BansheeTv/claude-skill-seo [opciones]

${c.bold('Opciones:')}
  -g, --global   Instala en ~/.claude/skills (disponible en todos tus proyectos)
  -f, --force    Sobrescribe la skill si ya existe
  -h, --help     Muestra esta ayuda
`);
}

function main() {
  if (flags.help) {
    printHelp();
    return;
  }

  const source = path.resolve(__dirname, '..', '.claude', 'skills', SKILL_NAME, SKILL_FILE);
  if (!fs.existsSync(source)) {
    console.error(c.red(`✖ No se encontró el archivo de la skill en: ${source}`));
    process.exit(1);
  }

  const baseDir = flags.global ? os.homedir() : process.cwd();
  const targetDir = path.join(baseDir, '.claude', 'skills', SKILL_NAME);
  const target = path.join(targetDir, SKILL_FILE);

  // Evita copiar el archivo sobre sí mismo si se ejecuta dentro del propio repo.
  if (path.resolve(source) === path.resolve(target)) {
    console.log(c.yellow('ℹ Estás dentro del repositorio de la skill; no hay nada que copiar.'));
    return;
  }

  if (fs.existsSync(target) && !flags.force) {
    const current = fs.readFileSync(target, 'utf8');
    const incoming = fs.readFileSync(source, 'utf8');
    if (current === incoming) {
      console.log(c.green(`✔ La skill ${SKILL_NAME} ya está instalada y actualizada en ${targetDir}`));
      return;
    }
    const backup = `${target}.bak`;
    fs.copyFileSync(target, backup);
    console.log(c.yellow(`⚠ Ya existía una versión distinta; copia de seguridad en ${backup}`));
  }

  try {
    fs.mkdirSync(targetDir, { recursive: true });
    fs.copyFileSync(source, target);
  } catch (err) {
    console.error(c.red(`✖ Error al instalar la skill: ${err.message}`));
    process.exit(1);
  }

  const shown = flags.global ? target : path.relative(process.cwd(), target);
  console.log(`
${c.green('✔ Skill instalada correctamente')}
  ${c.bold('Ubicación:')} ${shown}

${c.bold('Cómo usarla:')}
  1. Abre Claude Code en ${flags.global ? 'cualquier proyecto' : 'este proyecto'}:  ${c.cyan('claude')}
  2. Ejecuta:  ${c.cyan(`/${SKILL_NAME}`)}
     o pídelo en lenguaje natural: "${c.cyan('haz una auditoría SEO completa del proyecto')}"
`);
}

main();

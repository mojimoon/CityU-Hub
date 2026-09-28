import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { marked } from 'marked';
import { aggregateProjects } from './lib/aggregate.js';
import { createGithubClient, parseRepoUrl } from './lib/github.js';
import { analyzeReadme, fillProjectContent, guessTagsFromReadme } from './lib/markdown.js';
import { slugify } from './lib/slug.js';
import { sanitizeReadmeHtml } from './lib/sanitize.js';
import { loadConfig } from './config.js';
import { parseFrontmatterDocument } from './lib/frontmatter.js';

const parserRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const projectRoot = path.resolve(parserRoot, '..');
const reposDir = path.resolve(process.env.REPOS_DIR ?? path.join(projectRoot, 'repos'));
/** 直接产出到 web 的静态资源目录，前端 npm run build 时会一起打包 */
const outputDir = path.resolve(process.env.OUTPUT_DIR ?? path.join(projectRoot, 'web', 'public', 'data'));
const offline = process.argv.includes('--offline');

async function writeJson(file, value) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

/** Markdown → HTML，详情页直接渲染，前端无需再引 markdown 依赖 */
export function renderReadmeHtml(markdown) {
  return sanitizeReadmeHtml(String(marked.parse(markdown ?? '')));
}

function canonicalRepoUrl(url) {
  return url.toLowerCase().replace(/\/+$/, '').replace(/\.git$/, '');
}

/** GitHub 的 ISO 时间戳只保留日期部分，产物更易读 */
function toDate(value, fallback) {
  return typeof value === 'string' && value.length >= 10 ? value.slice(0, 10) : fallback;
}

/**
 * 把一个 repos/<id>.md 解析成前端契约（web/src/types/index.ts 里的 Project）。
 * 正文里的 `## Features` 为空、或开头没有介绍时，联网构建会回退到 GitHub README / 仓库简介。
 */
async function buildProject(meta, content, fileName, github, useOffline, fileDate) {
  const ref = parseRepoUrl(meta.repoUrl);
  if (!ref) throw new Error(`${fileName}: repoUrl 不是可识别的 GitHub 仓库地址`);

  let githubMeta = null;
  if (!useOffline) githubMeta = await github.fetchRepoMeta(ref);

  const featuresHeading = content.match(/^\s{0,3}##\s+Features\s*#*\s*$/im);
  const intro = featuresHeading ? content.slice(0, featuresHeading.index) : content;
  const featureBody = featuresHeading
    ? content.slice(featuresHeading.index + featuresHeading[0].length).split(/^\s{0,3}#{1,6}\s+/m, 1)[0]
    : '';
  const needsReadme = !intro.trim();
  const needsDescription = Boolean(featuresHeading && !featureBody.trim());
  const fetchedReadme = needsReadme && !useOffline ? await github.fetchReadme(ref) : '';
  const enrichedContent = fillProjectContent(content, {
    readme: fetchedReadme,
    description: needsDescription ? githubMeta?.description : '',
  });

  const analysis = analyzeReadme(enrichedContent);
  const tags = [
    ...new Set([
      ...meta.tags,
      ...(githubMeta?.topics ?? []),
      ...guessTagsFromReadme(enrichedContent, { language: githubMeta?.language }),
    ]),
  ].slice(0, 12);

  return {
    id: meta.id || slugify(`${ref.owner}-${ref.repo}`),
    name: meta.title || analysis.title || githubMeta?.repo || ref.repo,
    author: meta.author || githubMeta?.owner || ref.owner,
    authorName: meta.authorName,
    major: meta.major,
    enrollmentYear: meta.enrollmentYear,
    authorAvatar: githubMeta?.authorAvatar ?? '',
    repo: `${ref.owner}/${ref.repo}`,
    description: meta.summary || analysis.summary || githubMeta?.description || '',
    tags,
    category: meta.category,
    githubUrl: ref.repoUrl,
    demoUrl: meta.homepageUrl || githubMeta?.homepageUrl || null,
    stars: githubMeta?.stars ?? 0,
    forks: githubMeta?.forks ?? 0,
    language: githubMeta?.language ?? '',
    license: githubMeta?.license ?? '',
    createdAt: toDate(githubMeta?.createdAt, fileDate),
    updatedAt: toDate(githubMeta?.pushedAt, fileDate),
    status: meta.status,
    readmeHtml: renderReadmeHtml(enrichedContent),
  };
}

export async function buildIndex({ inputDir = reposDir, outputPath = outputDir, useOffline = offline, githubClient } = {}) {
  const entries = await fs.readdir(inputDir, { withFileTypes: true });
  const files = entries
    .filter((entry) => entry.isFile() && entry.name.endsWith('.md') && entry.name !== '_template.md')
    .map((entry) => entry.name)
    .sort();
  const config = loadConfig();
  const github = githubClient ?? createGithubClient(config);
  const projects = [];
  const ids = new Map();
  const repoUrls = new Map();

  for (const fileName of files) {
    const filePath = path.join(inputDir, fileName);
    const source = await fs.readFile(filePath, 'utf8');
    const { meta, body } = parseFrontmatterDocument(source, fileName);
    // 离线构建拿不到 GitHub 的 pushed_at，用文档自身的时间兜底
    const fileDate = (await fs.stat(filePath)).mtime.toISOString().slice(0, 10);
    const project = await buildProject(meta, body, fileName, github, useOffline, fileDate);

    const repoKey = canonicalRepoUrl(project.githubUrl);
    if (ids.has(project.id)) throw new Error(`${fileName}: id 与 ${ids.get(project.id)} 重复`);
    if (repoUrls.has(repoKey)) throw new Error(`${fileName}: repoUrl 与 ${repoUrls.get(repoKey)} 重复`);
    ids.set(project.id, fileName);
    repoUrls.set(repoKey, fileName);
    projects.push(project);
  }

  // status: hidden 的文档不参与展示，也不进任何聚合
  const visible = projects.filter((project) => project.status !== 'hidden');
  const aggregates = aggregateProjects(visible);

  await fs.rm(outputPath, { recursive: true, force: true });
  // 列表文件保持轻量，正文 HTML 只放在 projects/<id>.json
  await writeJson(path.join(outputPath, 'projects.json'), {
    generatedAt: new Date().toISOString(),
    total: visible.length,
    projects: visible.map(({ readmeHtml, status, ...project }) => project),
    tags: aggregates.tags,
    authors: aggregates.authors,
    categories: aggregates.categories,
  });

  for (const { readmeHtml, status, ...project } of visible) {
    await writeJson(path.join(outputPath, 'projects', `${project.id}.json`), { ...project, readmeHtml });
  }

  return { projects: visible, outputDir: outputPath, aggregates };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  buildIndex()
    .then(({ projects, outputDir }) => {
      console.log(`Built ${projects.length} project(s) from ${reposDir}`);
      console.log(`Output: ${outputDir}`);
      if (offline) console.log('GitHub enrichment: skipped (--offline)');
    })
    .catch((err) => {
      console.error(`[build-index] ${err.message}`);
      process.exitCode = 1;
    });
}

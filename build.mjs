#!/usr/bin/env node
/**
 * build.mjs — programmatic SEO generator for carlmadelo.com
 *
 *   node pseo/build.mjs            build into ./dist
 *   node pseo/build.mjs --out www  build into ./www
 *
 * Zero dependencies. Node 18+.
 *
 * QUALITY GATE
 * ------------
 * A page is indexable only if BOTH are true:
 *   1. status === "published"
 *   2. unique body word count >= MIN_WORDS
 * Anything else gets <meta name="robots" content="noindex,follow"> and is
 * excluded from sitemap.xml. This is the guard against thin-content penalties —
 * you can commit 40 stubs to the repo without any of them getting indexed.
 */

import { readFile, writeFile, mkdir, cp } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

const MIN_WORDS = 600;          // indexation floor for unique body copy
const OUT = (() => {
  const i = process.argv.indexOf("--out");
  return resolve(ROOT, i > -1 ? process.argv[i + 1] : "dist");
})();

/* ------------------------------------------------------------------ utils */

const esc = (s = "") =>
  String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

// strip tags, then count words — used for the thin-content gate
const words = (s = "") => String(s).replace(/<[^>]+>/g, " ").split(/\s+/).filter(Boolean).length;

const stripTags = (s = "") => String(s).replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();

const today = new Date().toISOString().slice(0, 10);

async function write(relPath, contents) {
  const full = join(OUT, relPath);
  await mkdir(dirname(full), { recursive: true });
  await writeFile(full, contents, "utf8");
  return relPath;
}

/* ------------------------------------------------ word count per page type */

function countUnique(page, type) {
  let n = words(page.intro) + words(page.lede);
  (page.sections || []).forEach(s => { n += words(s.h2); (s.body || []).forEach(p => n += words(p)); });
  (page.steps || []).forEach(s => { n += words(s.h3) + words(s.p); });
  (page.pitfalls || []).forEach(p => n += words(p));
  (page.mustHaves || []).forEach(p => n += words(p));
  (page.table || []).forEach(r => { n += words(r.criterion) + words(r.duda) + words(r.other); });
  (page.faqs || []).forEach(f => { n += words(f.q) + words(f.a); });
  (page.verdict?.body || []).forEach(p => n += words(p));
  n += words(page.timeline);
  return n;
}

/* ------------------------------------------------------------------ chrome */

function head({ site, title, description, canonical, indexable, schema, breadcrumbTrail }) {
  const robots = indexable
    ? "index, follow, max-image-preview:large, max-snippet:-1"
    : "noindex, follow";

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<meta name="author" content="${esc(site.author)}">
<meta name="robots" content="${robots}">
<link rel="canonical" href="${canonical}">
<meta name="theme-color" content="#0b0b0a">

<meta property="og:type" content="article">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:url" content="${canonical}">
<meta property="og:site_name" content="${esc(site.name)}">
<meta property="og:locale" content="en_US">
<meta property="og:image" content="${site.ogImage}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(title)}">
<meta name="twitter:description" content="${esc(description)}">
<meta name="twitter:image" content="${site.ogImage}">

<link rel="icon" href="/favicon.ico" sizes="any">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">

<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,400;0,9..144,500;1,9..144,400;1,9..144,500&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/assets/pseo.css">

<script type="application/ld+json">
${JSON.stringify(schema, null, 2)}
</script>
</head>
<body>
<a href="#main" class="skip-link">Skip to content</a>
${header(site)}
${breadcrumbs(breadcrumbTrail)}`;
}

function header(site) {
  return `<header class="p-header">
  <nav class="p-nav" aria-label="Primary">
    <a class="p-brand" href="/">
      <span class="p-brand-mark" aria-hidden="true">CM</span>
      <span class="p-logo">${esc(site.name)}</span>
    </a>
    <div class="p-nav-links">
      <a href="/duda-vs/">Comparisons</a>
      <a href="/migrate-to-duda/">Migrations</a>
      <a href="/duda-web-design/">Industries</a>
      <a href="/#work">Work</a>
      <a class="p-nav-cta" href="/#contact">Start a Project</a>
    </div>
  </nav>
</header>`;
}

function breadcrumbs(trail = []) {
  if (!trail.length) return "";
  const items = trail.map((c, i) =>
    i === trail.length - 1
      ? `<li><span aria-current="page">${esc(c.name)}</span></li>`
      : `<li><a href="${c.url}">${esc(c.name)}</a></li>`
  ).join("\n      ");
  return `<div class="wrap">
  <nav class="crumbs" aria-label="Breadcrumb">
    <ol>
      ${items}
    </ol>
  </nav>
</div>`;
}

function footer(site) {
  return `<footer class="p-footer">
  <div class="wrap">
    <div class="p-footer-grid">
      <div>
        <span class="f-logo">${esc(site.name)}</span>
        <p>Conversion-focused Duda websites that elevate your brand and turn attention into real business. Selective by design — one project at a time.</p>
      </div>
      <nav aria-label="Guides">
        <h2>Guides</h2>
        <ul>
          <li><a href="/duda-vs/">Duda vs other platforms</a></li>
          <li><a href="/migrate-to-duda/">Migrating to Duda</a></li>
          <li><a href="/duda-web-design/">Duda by industry</a></li>
        </ul>
      </nav>
      <nav aria-label="Connect">
        <h2>Connect</h2>
        <ul>
          <li><a href="/">Home</a></li>
          <li><a href="/#work">Selected work</a></li>
          <li><a href="mailto:${site.email}">${site.email}</a></li>
          <li><a href="${site.linkedin}" target="_blank" rel="noopener">LinkedIn</a></li>
        </ul>
      </nav>
    </div>
    <div class="p-footer-bottom">
      <span>&copy; ${new Date().getFullYear()} ${esc(site.name)} &middot; ${esc(site.jobTitle)}</span>
      <a href="#main">Back to top &#8593;</a>
    </div>
  </div>
</footer>
</body>
</html>`;
}

function cta(site, heading, blurb) {
  return `<section class="p-cta">
  <div class="wrap">
    <h2>${esc(heading)}</h2>
    <p>${esc(blurb)}</p>
    <a class="btn btn-solid" href="mailto:${site.email}?subject=Duda%20project%20enquiry">Start the conversation</a>
  </div>
</section>`;
}

/* ------------------------------------------------------------ page blocks */

const heroBlock = (eyebrow, page) => `<section class="p-hero">
  <div class="wrap">
    <p class="p-eyebrow">${esc(eyebrow)}</p>
    <h1>${esc(page.h1)}</h1>
    ${page.lede ? `<p class="p-lede">${esc(page.lede)}</p>` : ""}
    <div class="p-meta">
      <span>By <strong>Carl Madelo</strong>, Certified Duda Professional</span>
      ${page.readTime ? `<span>${esc(page.readTime)} read</span>` : ""}
      <span>Updated <time datetime="${today}">${today}</time></span>
    </div>
  </div>
</section>`;

const introBlock = (intro) => intro ? `<p>${esc(intro)}</p>` : "";

const sectionsBlock = (sections = []) => sections.map(s =>
  `<h2>${esc(s.h2)}</h2>\n` + (s.body || []).map(p => `<p>${p}</p>`).join("\n")
).join("\n\n");

const tableBlock = (rows = [], caption = "") => {
  if (!rows.length) return "";
  const body = rows.map(r => `      <tr>
        <th scope="row">${esc(r.criterion)}</th>
        <td class="${r.edge === "duda" ? "edge-duda" : ""}">${esc(r.duda)}</td>
        <td class="${r.edge === "other" ? "edge-duda" : ""}">${esc(r.other)}</td>
      </tr>`).join("\n");
  return `<div class="table-scroll">
  <table class="cmp">
    <caption>${esc(caption)}</caption>
    <thead><tr><th scope="col">Criterion</th><th scope="col">Duda</th><th scope="col">Alternative</th></tr></thead>
    <tbody>
${body}
    </tbody>
  </table>
</div>`;
};

const stepsBlock = (steps = []) => steps.length
  ? `<ol class="steps">\n${steps.map(s => `  <li><h3>${esc(s.h3)}</h3><p>${esc(s.p)}</p></li>`).join("\n")}\n</ol>`
  : "";

const listBlock = (items = [], cls = "checklist") => items.length
  ? `<ul class="${cls}">\n${items.map(i => `  <li>${esc(i)}</li>`).join("\n")}\n</ul>`
  : "";

const verdictBlock = (v) => (v && v.body?.length)
  ? `<div class="verdict">
  <h2>${esc(v.h2)}</h2>
  ${v.body.map(p => `<p>${p}</p>`).join("\n  ")}
</div>` : "";

const proofBlock = (p) => p ? `<div class="proof">
  <span class="proof-label">From a real build</span>
  <p>${esc(p.text)}</p>
  <a href="${p.url}"${p.url.startsWith("http") ? ' target="_blank" rel="noopener"' : ""}>${esc(p.linkText)} &#8594;</a>
</div>` : "";

const faqBlock = (faqs = []) => faqs.length ? `<h2>Frequently asked questions</h2>
<div class="p-faq">
${faqs.map(f => `  <details>
    <summary>${esc(f.q)}</summary>
    <div class="faq-body"><p>${esc(f.a)}</p></div>
  </details>`).join("\n")}
</div>` : "";

const relatedBlock = (heading, cards = []) => cards.length ? `<section class="related">
  <div class="wrap">
    <h2>${esc(heading)}</h2>
    <div class="card-grid">
${cards.map(c => `      <a class="p-card" href="${c.url}">
        <span class="k">${esc(c.kicker)}</span>
        <h3>${esc(c.title)}</h3>
        <p>${esc(c.blurb)}</p>
        <span class="go">Read &#8594;</span>
      </a>`).join("\n")}
    </div>
  </div>
</section>` : "";

/* ---------------------------------------------------------------- schema */

function pageSchema({ site, url, title, description, trail, faqs, indexable }) {
  const graph = [
    {
      "@type": "Article",
      "@id": url + "#article",
      "headline": title,
      "description": description,
      "url": url,
      "inLanguage": "en",
      "datePublished": today,
      "dateModified": today,
      "author": { "@type": "Person", "@id": site.personId, "name": site.author, "jobTitle": site.jobTitle, "url": site.domain + "/" },
      "publisher": { "@type": "Organization", "@id": site.businessId, "name": site.name, "url": site.domain + "/" },
      "image": site.ogImage,
      "isPartOf": { "@id": site.domain + "/#website" }
    },
    {
      "@type": "BreadcrumbList",
      "@id": url + "#breadcrumbs",
      "itemListElement": trail.map((c, i) => ({
        "@type": "ListItem",
        "position": i + 1,
        "name": c.name,
        ...(c.url ? { "item": site.domain + c.url } : {})
      }))
    }
  ];

  // Only emit FAQPage on pages that are actually indexable — no point
  // advertising rich results on a noindex stub.
  if (indexable && faqs?.length) {
    graph.push({
      "@type": "FAQPage",
      "@id": url + "#faq",
      "isPartOf": { "@id": url + "#article" },
      "mainEntity": faqs.map(f => ({
        "@type": "Question",
        "name": stripTags(f.q),
        "acceptedAnswer": { "@type": "Answer", "text": stripTags(f.a) }
      }))
    });
  }

  return { "@context": "https://schema.org", "@graph": graph };
}

function hubSchema({ site, url, title, description, trail, items }) {
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "CollectionPage",
        "@id": url + "#collection",
        "name": title,
        "description": description,
        "url": url,
        "inLanguage": "en",
        "isPartOf": { "@id": site.domain + "/#website" }
      },
      {
        "@type": "ItemList",
        "@id": url + "#list",
        "numberOfItems": items.length,
        "itemListElement": items.map((it, i) => ({
          "@type": "ListItem", "position": i + 1, "name": it.title, "url": site.domain + it.url
        }))
      },
      {
        "@type": "BreadcrumbList",
        "@id": url + "#breadcrumbs",
        "itemListElement": trail.map((c, i) => ({
          "@type": "ListItem", "position": i + 1, "name": c.name, ...(c.url ? { "item": site.domain + c.url } : {})
        }))
      }
    ]
  };
}

/* ------------------------------------------------------------- renderers */

function renderComparison(site, cluster, page, all) {
  const path = `/${cluster.slug}/${page.slug}/`;
  const url = site.domain + path;
  const wordCount = countUnique(page, "comparison");
  const indexable = page.status === "published" && wordCount >= MIN_WORDS;

  const trail = [
    { name: "Home", url: "/" },
    { name: "Duda comparisons", url: `/${cluster.slug}/` },
    { name: `Duda vs ${page.competitor}` }
  ];

  const cards = (page.related || [])
    .map(s => all.find(p => p.slug === s))
    .filter(Boolean)
    .map(p => ({ kicker: "Comparison", title: `Duda vs ${p.competitor}`, blurb: p.lede || p.description, url: `/${cluster.slug}/${p.slug}/` }));

  if (page.relatedMigration) {
    cards.push({
      kicker: "Migration guide",
      title: `${page.competitor} to Duda migration`,
      blurb: `The step-by-step process for moving off ${page.competitor} without losing rankings.`,
      url: `/migrate-to-duda/${page.relatedMigration}/`
    });
  }

  const body = `<main id="main">
${heroBlock("Platform comparison", page)}
<div class="wrap prose">
${introBlock(page.intro)}
${tableBlock(page.table, page.tableCaption || `Duda vs ${page.competitor}`)}
${sectionsBlock(page.sections)}
${verdictBlock(page.verdict)}
${proofBlock(page.proof)}
${faqBlock(page.faqs)}
</div>
${relatedBlock("Keep comparing", cards)}
${cta(site, "Building on Duda?", "Tell me what you are trying to launch and I will come back with scope, timeline and a fixed price.")}
</main>`;

  const html = head({
    site, title: page.title, description: page.description, canonical: url, indexable,
    schema: pageSchema({ site, url, title: page.title, description: page.description, trail, faqs: page.faqs, indexable }),
    breadcrumbTrail: trail
  }) + "\n" + body + "\n" + footer(site);

  return { path, url, html, indexable, wordCount, title: page.title, priority: "0.8" };
}

function renderMigration(site, cluster, page, all) {
  const path = `/${cluster.slug}/${page.slug}/`;
  const url = site.domain + path;
  const wordCount = countUnique(page, "migration");
  const indexable = page.status === "published" && wordCount >= MIN_WORDS;

  const trail = [
    { name: "Home", url: "/" },
    { name: "Migrate to Duda", url: `/${cluster.slug}/` },
    { name: `${page.from} to Duda` }
  ];

  const cards = (page.related || [])
    .map(s => all.find(p => p.slug === s))
    .filter(Boolean)
    .map(p => ({ kicker: "Migration guide", title: `${p.from} to Duda`, blurb: p.lede || p.description, url: `/${cluster.slug}/${p.slug}/` }));

  if (page.relatedComparison) {
    cards.push({
      kicker: "Comparison",
      title: `Duda vs ${page.from}`,
      blurb: `Still deciding? The build-level differences between Duda and ${page.from}.`,
      url: `/duda-vs/${page.relatedComparison}/`
    });
  }

  const body = `<main id="main">
${heroBlock("Migration guide", page)}
<div class="wrap prose">
${introBlock(page.intro)}
${page.steps?.length ? "<h2>The migration, step by step</h2>" : ""}
${stepsBlock(page.steps)}
${page.pitfalls?.length ? "<h2>What goes wrong</h2>" : ""}
${listBlock(page.pitfalls, "checklist warn")}
${page.timeline ? `<h2>How long it takes</h2>\n<p>${esc(page.timeline)}</p>` : ""}
${verdictBlock(page.verdict)}
${proofBlock(page.proof)}
${faqBlock(page.faqs)}
</div>
${relatedBlock("Related guides", cards)}
${cta(site, `Moving off ${page.from}?`, "Send me the current site URL and I will come back with a migration scope, timeline and fixed price.")}
</main>`;

  const html = head({
    site, title: page.title, description: page.description, canonical: url, indexable,
    schema: pageSchema({ site, url, title: page.title, description: page.description, trail, faqs: page.faqs, indexable }),
    breadcrumbTrail: trail
  }) + "\n" + body + "\n" + footer(site);

  return { path, url, html, indexable, wordCount, title: page.title, priority: "0.8" };
}

function renderIndustry(site, cluster, page, all) {
  const path = `/${cluster.slug}/${page.slug}/`;
  const url = site.domain + path;
  const wordCount = countUnique(page, "industry");
  const indexable = page.status === "published" && wordCount >= MIN_WORDS;

  const trail = [
    { name: "Home", url: "/" },
    { name: "Duda by industry", url: `/${cluster.slug}/` },
    { name: page.industry }
  ];

  const cards = (page.related || [])
    .map(s => all.find(p => p.slug === s))
    .filter(Boolean)
    .map(p => ({ kicker: "Industry", title: p.industry, blurb: p.lede || p.description, url: `/${cluster.slug}/${p.slug}/` }));

  const body = `<main id="main">
${heroBlock("Industry guide", page)}
<div class="wrap prose">
${introBlock(page.intro)}
${page.mustHaves?.length ? `<h2>What the site has to include</h2>` : ""}
${listBlock(page.mustHaves)}
${sectionsBlock(page.sections)}
${verdictBlock(page.verdict)}
${proofBlock(page.proof)}
${faqBlock(page.faqs)}
</div>
${relatedBlock("Other industries", cards)}
${cta(site, `Need a ${String(page.industry || "").toLowerCase()} website?`, "Tell me about the business and I will come back with scope, timeline and a fixed price.")}
</main>`;

  const html = head({
    site, title: page.title, description: page.description, canonical: url, indexable,
    schema: pageSchema({ site, url, title: page.title, description: page.description, trail, faqs: page.faqs, indexable }),
    breadcrumbTrail: trail
  }) + "\n" + body + "\n" + footer(site);

  return { path, url, html, indexable, wordCount, title: page.title, priority: "0.8" };
}

function renderHub(site, cluster, built) {
  const path = `/${cluster.slug}/`;
  const url = site.domain + path;
  const hub = cluster.hub;

  const trail = [{ name: "Home", url: "/" }, { name: hub.h1 }];

  // Hubs link to every page in the cluster, including drafts — internal links
  // to a noindex page are still how the crawler discovers it once you publish.
  const cards = cluster.pages.map(p => {
    const label = p.competitor ? `Duda vs ${p.competitor}`
      : p.from ? `${p.from} to Duda`
      : p.industry;
    const built_ = built.find(b => b.path === `/${cluster.slug}/${p.slug}/`);
    return {
      kicker: built_?.indexable ? cluster.type : "Coming soon",
      title: label,
      blurb: p.lede || p.description,
      url: `/${cluster.slug}/${p.slug}/`
    };
  });

  const listed = cards.filter((c, i) => built.find(b => b.path === c.url)?.indexable);

  const body = `<main id="main">
<section class="p-hero">
  <div class="wrap">
    <p class="p-eyebrow">${esc(hub.eyebrow)}</p>
    <h1>${esc(hub.h1)}</h1>
    <p class="p-lede">${esc(hub.intro)}</p>
  </div>
</section>
<div class="wrap prose">
  <div class="card-grid">
${cards.map(c => `    <a class="p-card" href="${c.url}">
      <span class="k">${esc(c.kicker)}</span>
      <h3>${esc(c.title)}</h3>
      <p>${esc(c.blurb)}</p>
      <span class="go">Read &#8594;</span>
    </a>`).join("\n")}
  </div>
</div>
${cta(site, "Want a straight answer for your project?", "Skip the reading. Describe what you are building and I will tell you whether Duda is the right call.")}
</main>`;

  const html = head({
    site,
    title: hub.title,
    description: hub.description,
    canonical: url,
    indexable: true,
    schema: hubSchema({ site, url, title: hub.title, description: hub.description, trail, items: listed }),
    breadcrumbTrail: trail
  }) + "\n" + body + "\n" + footer(site);

  return { path, url, html, indexable: true, wordCount: words(hub.intro), title: hub.title, priority: "0.9" };
}

/* -------------------------------------------------------- sitemap + robots */

function sitemap(site, pages) {
  const urls = [
    { loc: site.domain + "/", priority: "1.0", changefreq: "monthly" },
    ...pages.filter(p => p.indexable).map(p => ({ loc: p.url, priority: p.priority, changefreq: "monthly" }))
  ];
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map(u => `  <url>
    <loc>${u.loc}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>${u.changefreq}</changefreq>
    <priority>${u.priority}</priority>
  </url>`).join("\n")}
</urlset>
`;
}

function robots(site) {
  return `User-agent: *
Allow: /

Sitemap: ${site.domain}/sitemap.xml
`;
}

/* ------------------------------------------------------------------- main */

async function main() {
  const data = JSON.parse(await readFile(join(__dirname, "data", "pages.json"), "utf8"));
  const { site } = data;
  const built = [];

  for (const cluster of data.clusters) {
    const render =
      cluster.type === "comparison" ? renderComparison :
      cluster.type === "migration" ? renderMigration :
      renderIndustry;

    for (const page of cluster.pages) {
      built.push(render(site, cluster, page, cluster.pages));
    }
    built.push(renderHub(site, cluster, built));
  }

  for (const p of built) {
    await write(join(p.path, "index.html"), p.html);
  }

  await write("sitemap.xml", sitemap(site, built));
  await write("robots.txt", robots(site));

  // copy shared assets + homepage
  const assetsSrc = join(__dirname, "assets");
  if (existsSync(assetsSrc)) await cp(assetsSrc, join(OUT, "assets"), { recursive: true });
  const homeSrc = join(ROOT, "index.html");
  if (existsSync(homeSrc)) await cp(homeSrc, join(OUT, "index.html"));

  /* ---- report ---- */
  const live = built.filter(p => p.indexable);
  const held = built.filter(p => !p.indexable);

  console.log(`\n  Built ${built.length} pages -> ${OUT}\n`);
  console.log(`  INDEXABLE (${live.length})`);
  live.forEach(p => console.log(`    ${String(p.wordCount).padStart(5)}w  ${p.path}`));
  if (held.length) {
    console.log(`\n  NOINDEX — held back by the quality gate (${held.length})`);
    held.forEach(p => console.log(`    ${String(p.wordCount).padStart(5)}w  ${p.path}  (needs ${MIN_WORDS}w + status:published)`));
  }
  console.log(`\n  sitemap.xml contains ${live.length + 1} URLs\n`);
}

main().catch(err => { console.error(err); process.exit(1); });

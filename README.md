# Programmatic SEO generator

Zero dependencies. Node 18+.

```bash
node pseo/build.mjs              # -> ./dist
node pseo/build.mjs --out www    # -> ./www
```

## Adding a page

1. Open `pseo/data/pages.json`, find the cluster, fill in the stub.
2. Keep `status: "draft"` while you write.
3. Run the build. It prints the word count for every page.
4. Once the page clears 600 unique words, flip `status` to `"published"` and rebuild.

The build refuses to index anything under 600 words or not marked published —
it ships `noindex, follow`, drops it from `sitemap.xml`, and omits FAQ schema.
That is the guard against thin-content penalties. Do not remove it; if a page
cannot clear 600 words of genuinely page-specific copy, it should not exist.

## Rules baked into the data file

- Never reuse a paragraph across two pages.
- Every comparison must name at least one thing the competitor does better.
- No pricing figures unless verified against the vendor's site that week.
- Link a real build (`proof` block) wherever one exists.

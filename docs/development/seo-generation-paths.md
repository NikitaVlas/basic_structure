# Landing page and SEO-first website paths

Use `landing-minimal` for a focused, dependency-free single-page site:

```text
basic-structure init --preset landing-minimal --name product-landing --description "A clear product outcome" --output ./product-landing
```

Use `seo-business` for a multi-page business site built for crawlability,
structured information, useful internal links, and an editorial path:

```text
basic-structure init --preset seo-business --name business-site --description "A trusted business service" --output ./business-site
```

Before deployment, replace every `example.com` canonical, sitemap, Open Graph,
RSS, email, and structured-data URL with the production origin. Replace sample
claims and sections with specific evidence and customer-relevant content.

Both projects provide `npm run verify`, satisfy `seo-baseline`, and expose a
technical SEO block through:

```text
basic-structure gate evidence --project ./business-site --json
```

The evidence reports page counts, indexable pages, titles, descriptions,
canonicals, H1 integrity, structured-data coverage, crawl-control files, and
broken root-relative internal links. It validates technical readiness, not
rankings, demand, content originality, or search-engine acceptance.

# n8n Document Generation Research: PDF and DOCX for CV/Resume System

**Date:** 2026-03-29
**Context:** Automated CV/resume generation in n8n, self-hosted on Hetzner CAX31 (ARM64), running via Dokploy

---

## 1. PDF Generation Options

### 1.1 Gotenberg (Recommended for Self-Hosted)

Gotenberg is a Docker-based stateless API that converts HTML/Markdown/Office documents to PDF using headless Chromium and LibreOffice. This is the strongest option for the Hetzner ARM64 setup.

**ARM64 support:** Yes. The `gotenberg/gotenberg:8` image supports `linux/amd64`, `linux/arm64`, `arm32v7`, `i386`, and `ppc64le`. The AWS Lambda variant (`gotenberg/gotenberg:8-aws-lambda`) explicitly lists `linux/arm64`. This will run natively on the CAX31.

**Docker Compose setup alongside n8n:**

```yaml
services:
  n8n:
    image: n8nio/n8n:latest
    # ... your existing n8n config
    networks:
      - app-network

  gotenberg:
    image: gotenberg/gotenberg:8
    ports:
      - "127.0.0.1:3000:3000"
    networks:
      - app-network

networks:
  app-network:
    driver: bridge
```

When both containers share a Docker network, n8n reaches Gotenberg at `http://gotenberg:3000`.

**API endpoint for HTML-to-PDF:**

```
POST http://gotenberg:3000/forms/chromium/convert/html
```

Send a multipart/form-data request with:
- `files`: An HTML file named `index.html` (required)
- `files`: Additional assets (CSS, images, fonts) referenced by filename only (flat directory)
- `header.html` / `footer.html`: Optional header/footer templates
- Layout params: `paperWidth`, `paperHeight`, `marginTop/Bottom/Left/Right`, `landscape`, `scale`
- `printBackground`: boolean (default false) -- set to true for colored backgrounds
- `preferCssPageSize`: boolean -- use CSS `@page` sizes instead
- `generateDocumentOutline`: boolean -- creates PDF bookmarks from HTML headings
- `metadata`: JSON with `Author`, `Title`, `Subject`, `Creator`, etc.
- `waitDelay`: e.g., `'2s'` -- wait before rendering (useful if CSS loads async)

**Header/footer dynamic classes:**
- `.pageNumber` -- current page
- `.totalPages` -- total pages
- `.date` -- formatted print date
- `.title` -- document title

**n8n workflow pattern (4 nodes):**

1. **Trigger** (Webhook or manual)
2. **Code node** -- generate HTML string with CV data injected
3. **Convert to File node** -- convert HTML string to binary `index.html` (Operation: Move Base64 String to File, encoding: utf8, filename: index.html, MIME: text/html)
4. **HTTP Request node** -- POST to `http://gotenberg:3000/forms/chromium/convert/html`, body type: Form-Data, field `files` = binary data, response format: File

**Existing n8n workflow templates:**
- "Create PDF from HTML with Gotenberg" (n8n.io/workflows/5149)
- "Extract data from resume and create PDF with Gotenberg" (n8n.io/workflows/2170)
- "Generate an SEO PDF report from HTML with Gotenberg and Claude" (n8n.io/workflows/13758)

**Performance:** Gotenberg uses headless Chromium for HTML rendering. Expect 2-5 seconds per document depending on complexity. Gotenberg is stateless and can handle concurrent requests.

**Verdict:** Best self-hosted option. Native ARM64 support, battle-tested, comprehensive API, runs as a sidecar container.

### 1.2 Puppeteer Community Node

The `n8n-nodes-puppeteer` npm package (by drudge) provides a community node for browser automation including PDF generation.

**Package:** `n8n-nodes-puppeteer` on npm
**GitHub:** github.com/drudge/n8n-nodes-puppeteer
**Install:** Settings > Community Nodes in n8n

**Features:**
- Execute custom Puppeteer scripts
- Generate PDFs with paper size, margin, header/footer control
- Auto-detects Docker environment and applies Chrome launch flags (`--no-sandbox`, `--disable-setuid-sandbox`, `--disable-dev-shm-usage`, `--disable-gpu`)
- Downloaded files returned as binary data

**ARM64 considerations:** Puppeteer on ARM64 Docker has known issues. The bundled Chromium binary historically was x86-64 only. The workaround is:
1. Set `PUPPETEER_SKIP_DOWNLOAD=true`
2. Install system Chromium via Alpine packages: `chromium`, `nss`, `freetype`, `harfbuzz`, `ca-certificates`, `ttf-freefont`
3. Point Puppeteer to system Chromium: `PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser`

This requires a custom Dockerfile extending the n8n image, which adds maintenance burden.

**Verdict:** Viable but more complex on ARM64 than Gotenberg. Better suited for scenarios needing full browser automation beyond PDF generation.

### 1.3 External API Services

| Service | Free Tier | Paid Starting | Engine | Notes |
|---------|-----------|---------------|--------|-------|
| **CustomJS** | 600 PDFs/month | $15/month (5,000 PDFs) | Chromium-based | Has native n8n community nodes (`@customjs/n8n-nodes`). Supports `@custom-js/n8n-nodes-pdf-toolkit`. |
| **DocRaptor** | 5 docs/month | $15/month | Prince XML | Best CSS print support. Handles complex layouts well. |
| **PDFShift** | 50 credits/month | $9/month | Chromium-based | Credit = 1 conversion up to 5MB. Async generation on paid plans only. |
| **ConvertAPI** | 250 seconds free | Pay-as-you-go | Various | n8n workflow templates exist (n8n.io/workflows/2314). |
| **PDFMunk** | Free tier available | Usage-based | Chromium-based | Has n8n integration. |

**When to use external APIs:** If you want zero infrastructure overhead and low volume (under 600/month, CustomJS free tier is generous). For a self-hosted system generating CVs on demand, Gotenberg is more cost-effective long-term.

### 1.4 WeasyPrint

Python-based HTML-to-PDF engine using its own rendering engine (not WebKit/Chromium).

**Pros:** Lightweight, good CSS support (especially CSS Paged Media), lower memory than Chromium-based tools, actively maintained (unlike wkhtmltopdf).
**Cons:** No JavaScript execution. Requires Python runtime. Must be run as a sidecar service or via Execute Command node.
**ARM64:** Works on ARM64 Linux via pip install. Docker image `fpod/pandoc-weasyprint` available.
**Performance:** Faster than Chromium for simple documents, slower for complex layouts with many images.

**Verdict:** Good lightweight alternative if you don't need JavaScript in templates. Less ecosystem support in n8n compared to Gotenberg.

### 1.5 wkhtmltopdf

Uses an old, frozen WebKit engine. **Archived January 2023 -- no longer maintained.**

**ARM64:** Docker images exist (`surnet/alpine-wkhtmltopdf`, `paskalmaksim/wkhtmltopdf:v0.0.5-arm64`).
**Verdict:** Avoid for new projects. Frozen CSS support, no maintenance, security risks.

### 1.6 Prince XML

Commercial engine with the best CSS Paged Media support. Powers DocRaptor's API.
**Cost:** $3,800 for a server license.
**Verdict:** Overkill for this use case. Use DocRaptor API if you want Prince rendering without the license cost.

---

## 2. DOCX Generation Options

### 2.1 n8n-nodes-docxtemplater (Recommended)

**Package:** `n8n-nodes-docxtemplater` v1.0.0
**GitHub:** github.com/jreyesr/n8n-nodes-docxtemplater
**Developed on:** n8n v1.80.5

A community node that uses docxtemplater to render DOCX/PPTX/XLSX from templates.

**Template syntax (Jexl-based):**
- Simple substitution: `{ first_name }`
- Concatenation: `{ first_name + " " + last_name }`
- Ternary: `{ user.name ?: "Unknown" }`
- Array access: `{ positions["Chief of" in .title] }`
- Pipe transforms: `{ name | lower }`

**Conditional sections (for CV variants):**
```
{#if show_publications}
Publications:
{#publications}
- { title }, { journal }, { year }
{/publications}
{/if}
```

**Loop blocks (for work experience, skills, etc.):**
```
{#experiences}
{ company } -- { role } ({ start_date } - { end_date })
{ description }
{/experiences}
```

**Built-in transforms:**
- `| JSONstringify` -- serialize objects
- `| JSONparse` -- deserialize strings
- `| length` -- string/array length

**Custom transforms:** Attach n8n AI Tool nodes to the Transforms connection point. Custom code receives input via `query.input` and `query.args`, must return a string.

**Docxtemplater modules (advanced):**
- Variable images: `{%fieldWithImagePath}` -- insert photos from Base64/URL/S3
- Raw HTML insertion: `{~~fieldWithHtml}`
- Requires global npm install of docxtemplater + module packages in the container

**Workflow pattern:**
1. Trigger (webhook with job data)
2. Prepare context JSON (candidate data, job-specific tailoring)
3. Read template DOCX from disk/URL/database
4. Docxtemplater node: template + context -> rendered DOCX
5. Optionally convert to PDF via Gotenberg (upload DOCX to `/forms/libreoffice/convert` endpoint)

**Verdict:** Best option for template-based DOCX generation. Non-programmers can edit Word templates. Supports conditional sections for academic vs. industry CVs.

### 2.2 n8n-nodes-carbonejs / n8n-nodes-carbone

Two community nodes exist for Carbone.js:

**a) n8n-nodes-carbonejs** (jreyesr) -- open source
- Takes binary DOCX/XLSX/PPTX template + JSON context
- Uses `{d.variableName}` tag syntax in templates
- Requires LibreOffice for format conversion (DOCX to PDF)
- No API keys needed for the Render operation
- Package: `n8n-nodes-carbonejs` v1.2.0

**b) n8n-nodes-carbone** (carboneio/official) -- uses Carbone.io cloud API
- Package: `n8n-nodes-carbone` v1.2.1
- Supports batch generation (one doc per array item, returned as ZIP or merged PDF)
- Template syntax: `{d.firstName}`, `{d.experiences[i].company}`
- Requires Carbone.io API key

**Carbone template syntax:**
```
{d.name}
{d.experiences[i].company} - {d.experiences[i].role}
{d.experiences[i].startDate} to {d.experiences[i].endDate}
```

**Verdict:** Carbone's template syntax is simpler than docxtemplater's Jexl. The open-source node (`n8n-nodes-carbonejs`) is a solid alternative. Choose based on template syntax preference.

### 2.3 docx npm package (Programmatic)

**Package:** `docx` v9.6.1 (latest as of March 2026)
**GitHub:** github.com/dolanmiu/docx
**License:** MIT

Programmatic DOCX generation via JavaScript. No templates -- you build the document in code.

**Usage in n8n Code node:**

Requires enabling external modules:
```
NODE_FUNCTION_ALLOW_EXTERNAL=docx
```

And installing in the container:
```dockerfile
RUN npm install -g docx
```

**Code example for a CV:**

```javascript
const { Document, Paragraph, TextRun, HeadingLevel, AlignmentType, Packer } = require('docx');

const doc = new Document({
  sections: [{
    properties: {},
    children: [
      new Paragraph({
        text: "Jane Smith",
        heading: HeadingLevel.HEADING_1,
        alignment: AlignmentType.CENTER,
      }),
      new Paragraph({
        children: [
          new TextRun({ text: "Senior L&D Consultant", bold: true }),
          new TextRun({ text: " | London, UK | jane@example.com", }),
        ],
      }),
      new Paragraph({
        text: "Professional Experience",
        heading: HeadingLevel.HEADING_2,
      }),
      new Paragraph({
        children: [
          new TextRun({ text: "Learning & Development Manager", bold: true }),
          new TextRun({ text: " - Acme Corp (2020-2024)" }),
        ],
      }),
      new Paragraph({
        text: "Led team of 12 in designing enterprise learning programs",
        bullet: { level: 0 },
      }),
    ],
  }],
});

const buffer = await Packer.toBuffer(doc);
return [{
  json: {},
  binary: {
    data: await this.helpers.prepareBinaryData(buffer, 'cv.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')
  }
}];
```

**Pros:** Full programmatic control, no template files to manage, TypeScript support.
**Cons:** Verbose code for complex documents, requires developer to modify layouts, no visual editing.

**Verdict:** Good for simple documents or when you need programmatic control. For CV generation with multiple template variants, docxtemplater is more practical.

### 2.4 docx-templates npm package

**Package:** `docx-templates` on npm
**Approach:** Template-based like docxtemplater but with a different syntax.
**Verdict:** Less n8n ecosystem support than docxtemplater. Skip unless you have specific needs.

### 2.5 Google Docs API (Template Approach)

Use Google Docs as the template editor, then fill via API.

**n8n integration:** Built-in Google Docs node supports `replaceAllText` operation.
**Pattern:**
1. Create a Google Doc template with placeholders like `{{NAME}}`, `{{EXPERIENCE}}`
2. Use Google Docs node to copy template and replace placeholders
3. Export as PDF via Google Drive node

**Pros:** Non-technical users can design templates in Google Docs. Free.
**Cons:** Requires Google Cloud credentials. Limited conditional logic (no loops/conditionals in template). Network latency. Rate limits.

**Verdict:** Viable for simple CVs. Poor support for conditional sections and complex formatting.

---

## 3. Template Engines for HTML Generation

### 3.1 n8n Built-in HTML Node

n8n has a native HTML node with "Generate HTML template" operation.
- Supports `{{ $json.fieldName }}` expressions
- Can include `<style>` and `<script>` tags
- Good for simple templates but limited logic capabilities

### 3.2 n8n-nodes-text-templater (Recommended for Complex Templates)

**Package:** `n8n-nodes-text-templater`
**GitHub:** github.com/llmx-de/n8n-nodes-text-templater

Supports four template engines in one node:

| Engine | Syntax | Best For |
|--------|--------|----------|
| **Mustache** | `{{variable}}`, `{{#section}}` | Simple substitution |
| **Handlebars** | `{{#if}}`, `{{#each}}`, helpers | Conditional sections, loops |
| **Nunjucks** | `{% if %}`, `{% for %}`, filters, macros | Complex templates, inheritance |
| **EJS** | `<%= variable %>`, `<% if() %>` | Full JavaScript in templates |

**Installation:** Community Nodes panel or `N8N_COMMUNITY_PACKAGES=n8n-nodes-text-templater`

**Features:**
- Works with n8n expressions
- Built-in XSS protection with autoescape
- Returns rendered text + character/line counts
- Zero external dependencies

**Example for CV HTML generation with Handlebars:**

```handlebars
<html>
<head><style>
  body { font-family: 'Georgia', serif; margin: 40px; }
  h1 { color: #2c3e50; border-bottom: 2px solid #3498db; }
  .experience { margin-bottom: 20px; }
  .company { font-weight: bold; }
  .date { color: #7f8c8d; float: right; }
</style></head>
<body>
  <h1>{{name}}</h1>
  <p>{{email}} | {{phone}} | {{location}}</p>

  <h2>Professional Summary</h2>
  <p>{{summary}}</p>

  <h2>Experience</h2>
  {{#each experiences}}
  <div class="experience">
    <span class="company">{{this.company}}</span>
    <span class="date">{{this.startDate}} - {{this.endDate}}</span>
    <p><em>{{this.role}}</em></p>
    <ul>
      {{#each this.achievements}}
      <li>{{this}}</li>
      {{/each}}
    </ul>
  </div>
  {{/each}}

  {{#if publications}}
  <h2>Publications</h2>
  <ul>
    {{#each publications}}
    <li>{{this.title}} - {{this.journal}} ({{this.year}})</li>
    {{/each}}
  </ul>
  {{/if}}

  <h2>Skills</h2>
  <p>{{#each skills}}{{this}}{{#unless @last}}, {{/unless}}{{/each}}</p>
</body>
</html>
```

### 3.3 n8n-nodes-document-generator

**Package:** `n8n-nodes-document-generator`
**GitHub:** github.com/n8nhackers/n8n-nodes-document-generator

Renders Handlebars templates for documents or emails. Uses `@jaredwray/fumanchu` (Handlebars with additional helpers). Eliminates need for SET/CODE/FUNCTION nodes for dynamic content.

### 3.4 Template Storage Strategies in n8n

| Strategy | Pros | Cons |
|----------|------|------|
| **Inline in workflow** | Simple, version-controlled with workflow export | Hard to edit, clutters workflow |
| **Static files on disk** | Easy to edit, can use git | Requires volume mount in Docker |
| **Database (Postgres)** | Centralized, queryable, version-able | Requires custom table + query nodes |
| **n8n Static Data** | Built into n8n (`getWorkflowStaticData()`) | Limited size, not designed for large templates |
| **S3/Object Storage** | Scalable, CDN-able | Extra infrastructure, network latency |
| **Google Drive/Sheets** | Non-technical users can edit | API latency, auth complexity |

**Recommended for this project:** Store HTML templates as files on disk (volume-mounted) for the Gotenberg approach, and DOCX templates as files for the docxtemplater approach. Use a shared volume mount:

```yaml
volumes:
  - ./templates:/templates:ro
```

Reference in n8n via Read/Write Files from Disk node reading from `/templates/cv-modern.html` or `/templates/cv-academic.docx`.

---

## 4. File Storage and Delivery

### 4.1 n8n Binary Data Handling

n8n represents all file-type data (PDFs, images, DOCX) as "binary data." Binary data appears under the Binary tab in node output.

**Key nodes:**
- **Convert to File** -- converts JSON/Base64/text to binary file
- **Extract From File** -- binary to JSON
- **Read/Write Files from Disk** -- filesystem I/O (requires volume mount in Docker)
- **HTTP Request** (response format: File) -- downloads/receives files as binary

**Storage modes (environment variables):**

| Variable | Default | Options | Notes |
|----------|---------|---------|-------|
| `N8N_DEFAULT_BINARY_DATA_MODE` | `default` (memory) | `default`, `filesystem`, `s3` | S3 requires Enterprise license |
| `N8N_AVAILABLE_BINARY_DATA_MODES` | `filesystem` | comma-separated list | Must include modes you want to use |

**For the CAX31 (8GB RAM):** Set `N8N_DEFAULT_BINARY_DATA_MODE=filesystem` to avoid memory pressure when generating multiple PDFs. This writes binary data to disk instead of holding it in RAM.

```env
N8N_DEFAULT_BINARY_DATA_MODE=filesystem
```

**S3 storage:** Requires n8n Enterprise license. Configure with:
- `N8N_EXTERNAL_STORAGE_S3_BUCKET_NAME`
- `N8N_EXTERNAL_STORAGE_S3_BUCKET_REGION` (set to `auto` for non-AWS S3)
- `N8N_EXTERNAL_STORAGE_S3_AUTH_AUTO_DETECT=true`

### 4.2 Storage Strategy for Generated CVs

For this project, given self-hosted Postgres is already available:

**Option A: Postgres bytea column (simple, recommended for MVP)**
- Store generated PDFs directly in the Postgres database
- Query with n8n's Postgres node
- Pros: Single data store, transactional, backed up with DB
- Cons: Bloats database, not ideal for large volumes
- Max practical size: ~10MB per file, hundreds of CVs

**Option B: Filesystem with metadata in Postgres**
- Write files to a mounted volume: `/data/generated-cvs/`
- Store metadata (filename, candidate_id, job_id, format, created_at) in Postgres
- Pros: Better performance, files accessible outside n8n
- Cons: Two systems to back up

**Option C: S3-compatible storage (Hetzner Object Storage)**
- Use Hetzner's S3-compatible object storage
- Store via HTTP Request node with S3 presigned URLs
- Pros: Scalable, cheap, durable
- Cons: Extra setup, latency

**Recommended:** Option B for production. Option A for quick MVP.

### 4.3 Sending CVs via Email (Resend)

There is a community Resend node for n8n: `n8n-nodes-resend`

**Configuration:**
- Resource: Email
- Operation: Send
- Attachments Type: Binary Data
- Binary Property: `data` (matches the output field name from PDF generation)
- Filename: `cv-{{ $json.candidateName }}-{{ $json.jobTitle }}.pdf`

**Workflow pattern:**
1. Generate PDF (Gotenberg) or DOCX (docxtemplater)
2. Binary data flows to Resend node
3. Resend sends email with attachment

**Alternative:** Use n8n's built-in Send Email node (SMTP) if you already have an SMTP provider.

### 4.4 File Naming Convention

Suggested pattern:
```
{candidate_slug}_{job_slug}_{format}_{timestamp}.{ext}
```

Example:
```
selvi-kumar_senior-ld-manager-deloitte_tailored_20260329T1430.pdf
selvi-kumar_master-cv_base_20260329T1430.docx
```

---

## 5. Existing n8n CV/Document Workflows

### 5.1 Community Workflow Templates

| Workflow | ID | What It Does |
|----------|----|--------------|
| **Generate tailored resumes, cover letters & interview prep from LinkedIn jobs with AI** | 6748 | Multi-agent AI generates customized CV, cover letter, and interview prep. Outputs as Google Docs. |
| **Generate Job-Specific ATS Resumes with Perplexity AI and PDF Export** | 7637 | Tailors resume to job description, produces ATS-friendly PDF, stores in Google Drive. |
| **Automate job applications with AI resume tailoring using GPT-4o, LinkedIn & Gmail** | 11215 | Finds jobs, rewrites resume for each, creates Google Doc, sends via Gmail. |
| **Personalize resumes & cover letters with AI, GitHub Pages and Google Drive** | 10242 | Generates HTML resume, hosts on GitHub Pages, converts to PDF via Gotenberg, saves to Drive. |
| **Extract data from resume and create PDF with Gotenberg** | 2170 | Parses existing resume, restructures data, generates new PDF. |
| **Automate job search & applications with 5 job boards & AI resume generator** | 6927 | Multi-board job search with AI resume generation. |

### 5.2 Key Patterns from Community Workflows

1. **Webhook trigger -> AI tailoring -> Generate -> Store -> Notify** is the dominant pattern
2. Most workflows use Google Docs as the output format (easy for non-technical users)
3. Gotenberg is the go-to for self-hosted PDF generation
4. AI (GPT-4o, Claude, Perplexity) is used for content tailoring, not just templating
5. Few workflows generate DOCX directly -- most go HTML -> PDF or use Google Docs API

---

## 6. LaTeX/Typst Alternatives

### 6.1 Typst (Strong Alternative)

**Current version:** 0.14.2 (released December 2025)
**GitHub:** github.com/typst/typst

Typst is a modern markup-based typesetting system. Faster compilation than LaTeX, simpler syntax, built-in package manager.

**ARM64 support:** Yes. Binary releases include `aarch64-unknown-linux-musl` and `aarch64-apple-darwin`. However, a Docker issue existed in v0.12.0 where the ARM64 image shipped with an x86-64 binary (github.com/typst/typst/issues/5290). This was fixed in later versions.

**Docker image:** `ghcr.io/typst/typst:latest`

**CV templates available on Typst Universe:**
- `modern-cv` -- based on Awesome-CV LaTeX template
- `brilliant-cv` -- feature-rich CV template
- `basic-resume` -- minimal resume
- `clickworthy-resume` -- ATS-friendly with cover letter support
- `modernpro-cv` -- inspired by Deedy-Resume
- `academicv` -- YAML-driven academic CV
- `simple-technical-resume` -- technical focus

**How to call from n8n:**

Since the Execute Command node is disabled by default in n8n 2.0, you have two approaches:

**Approach A: Re-enable Execute Command node**
```env
# In n8n environment
N8N_NODES_INCLUDE=n8n-nodes-base.executeCommand
```

Then in the workflow:
1. Code node writes `.typ` file content
2. Write Binary to Disk node saves to `/tmp/cv.typ`
3. Execute Command: `typst compile /tmp/cv.typ /tmp/cv.pdf`
4. Read Binary from Disk: read `/tmp/cv.pdf`

**Approach B: Typst as HTTP service (recommended)**

Run Typst behind a small HTTP wrapper (e.g., a simple Node.js or Go service) as another Docker container:

```dockerfile
FROM ghcr.io/typst/typst:latest AS typst
FROM node:20-alpine
COPY --from=typst /bin/typst /usr/local/bin/typst
# Add a small HTTP server that accepts .typ content and returns PDF
```

Then call from n8n via HTTP Request node.

**Approach C: Use Gotenberg's Typst support** -- Gotenberg does not natively support Typst (as of v8), but you could contribute a module or use a sidecar.

**Typst template example for CV:**
```typst
#set page(margin: (x: 2cm, y: 2cm))
#set text(font: "New Computer Modern", size: 11pt)

#align(center)[
  #text(size: 24pt, weight: "bold")[Jane Smith]
  #v(4pt)
  Senior L&D Consultant | London | jane\@example.com
]

#line(length: 100%)

== Professional Experience

#let experience(company, role, dates, items) = {
  grid(
    columns: (1fr, auto),
    [*#company* -- _#role_], [#dates]
  )
  for item in items {
    [- #item]
  }
  v(8pt)
}

#experience("Acme Corp", "L&D Manager", "2020--2024", (
  "Led team of 12 designing enterprise learning programs",
  "Increased training completion rates by 40%",
  "Managed budget of GBP 2.1M",
))
```

**Pros vs HTML-to-PDF:**
- Typographic quality closer to LaTeX (proper kerning, ligatures, math)
- Deterministic output (no browser rendering differences)
- Faster compilation (milliseconds vs seconds for Chromium startup)
- Native PDF output (no intermediate HTML step)
- Package ecosystem with ready-made CV templates

**Cons vs HTML-to-PDF:**
- Smaller ecosystem, fewer developers know Typst
- No CSS -- different styling paradigm
- Fewer n8n integrations (no community node exists)
- Template editing requires Typst knowledge (vs. HTML/CSS which more people know)

### 6.2 Tectonic (LaTeX)

**GitHub:** github.com/tectonic-typesetting/tectonic

A modernized, self-contained TeX/LaTeX engine powered by XeTeX and TeXLive. Downloads packages on demand.

**Docker images:**
- `rekka/tectonic` -- small image with on-demand package download
- `pandoc/extra` -- includes tectonic + pandoc + Eisvogel template

**ARM64 support:** Tectonic is written in Rust and compiles for ARM64. However, existing Docker images may not have ARM64 variants. You may need to build from source:
```dockerfile
FROM rust:latest AS builder
RUN cargo install tectonic
FROM debian:bookworm-slim
COPY --from=builder /usr/local/cargo/bin/tectonic /usr/local/bin/tectonic
```

**Pros:** LaTeX ecosystem is massive, thousands of CV templates (moderncv, awesome-cv, etc.).
**Cons:** Slow compilation (seconds to minutes), large images (TexLive is 4GB+), complex syntax, harder to debug. Tectonic mitigates some of this but is still heavier than Typst.

**Verdict:** Use Typst over Tectonic/LaTeX for new projects. LaTeX only if you have existing LaTeX templates you must support.

---

## 7. Recommendation Summary

### For This Project (Selvi Job App CV Generation)

**Primary approach: HTML-to-PDF via Gotenberg**

| Component | Choice | Rationale |
|-----------|--------|-----------|
| **PDF engine** | Gotenberg 8 (Docker sidecar) | Native ARM64, battle-tested, rich API, good n8n ecosystem |
| **HTML templating** | n8n-nodes-text-templater (Handlebars) | Conditional sections, loops, clean syntax |
| **DOCX generation** | n8n-nodes-docxtemplater | Template-based, non-programmers can edit, Jexl conditionals |
| **Template storage** | Filesystem (volume mount) | Simple, git-trackable, Docker-friendly |
| **Binary data mode** | Filesystem | Avoids RAM pressure on CAX31 |
| **Email delivery** | n8n-nodes-resend | Already in your stack |
| **File storage** | Postgres metadata + filesystem files | MVP-appropriate, single backup target |

**Secondary/future approach: Typst**

If higher typographic quality is needed later, add Typst as a sidecar service. The `modern-cv` and `brilliant-cv` templates on Typst Universe are production-ready. Typst compiles faster than Gotenberg renders, and its ARM64 binary works natively.

### Architecture Diagram

```
Webhook (job + candidate data)
    |
    v
Code Node (prepare context JSON)
    |
    +---> Text Templater (Handlebars) ---> HTML string
    |         |
    |         v
    |     Convert to File (index.html binary)
    |         |
    |         v
    |     HTTP Request -> Gotenberg -> PDF binary
    |
    +---> Docxtemplater Node (template.docx + context) -> DOCX binary
    |
    v
Write to Disk / Postgres (store generated files)
    |
    v
Resend Node (email CV to candidate/recruiter)
```

### Docker Compose Addition for Gotenberg

Add to your existing Dokploy docker-compose:

```yaml
gotenberg:
  image: gotenberg/gotenberg:8
  restart: unless-stopped
  ports:
    - "127.0.0.1:3000:3000"
  # Gotenberg runs as non-root user (UID/GID 1001)
  # Disable unused modules to save memory on CAX31:
  command:
    - "gotenberg"
    - "--api-timeout=60s"
    - "--chromium-disable-javascript=true"
```

### n8n Environment Variables to Add

```env
# Enable filesystem binary storage (reduce RAM usage)
N8N_DEFAULT_BINARY_DATA_MODE=filesystem

# Allow external npm modules in Code node
NODE_FUNCTION_ALLOW_EXTERNAL=docx,handlebars

# Re-enable Execute Command if using Typst/Tectonic
# N8N_NODES_INCLUDE=n8n-nodes-base.executeCommand

# Community packages to auto-install
N8N_COMMUNITY_PACKAGES=n8n-nodes-text-templater,n8n-nodes-docxtemplater,n8n-nodes-resend
```

---

## Sources

### PDF Generation
- [Gotenberg Official](https://gotenberg.dev/)
- [Gotenberg HTML-to-PDF API](https://gotenberg.dev/docs/convert-with-chromium/convert-html-to-pdf)
- [Gotenberg Docker Hub](https://hub.docker.com/r/gotenberg/gotenberg)
- [n8n Gotenberg Workflow Template](https://n8n.io/workflows/5149-create-pdf-from-html-with-gotenberg/)
- [Generating PDFs with N8N using Gotenberg](https://blog.elest.io/n8n-generating-pdfs-with-n8n-using-gotenberg/)
- [n8n PDF Generation Guide (CustomJS)](https://www.customjs.space/blog/n8n-pdf-generation/)
- [n8n HTML to PDF Integrations](https://n8n.io/integrations/html-to-pdf/)
- [PDFMunk n8n Integration](https://pdfmunk.com/n8n-integration)

### Puppeteer
- [n8n-nodes-puppeteer GitHub](https://github.com/drudge/n8n-nodes-puppeteer)
- [Puppeteer ARM64 Issue](https://github.com/puppeteer/puppeteer/issues/7740)
- [Puppeteer Docker Guide](https://pptr.dev/guides/docker)

### DOCX Generation
- [n8n-nodes-docxtemplater GitHub](https://github.com/jreyesr/n8n-nodes-docxtemplater)
- [n8n-nodes-carbonejs GitHub](https://github.com/jreyesr/n8n-nodes-carbonejs)
- [n8n-nodes-carbone (official)](https://github.com/carboneio/n8n-nodes-carbone)
- [docx npm package](https://www.npmjs.com/package/docx)
- [docxtemplater](https://docxtemplater.com/)

### Template Engines
- [n8n-nodes-text-templater](https://github.com/llmx-de/n8n-nodes-text-templater)
- [n8n-nodes-document-generator](https://github.com/n8nhackers/n8n-nodes-document-generator)
- [n8n HTML Node Docs](https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.html/)

### n8n Configuration
- [Enable modules in Code node](https://docs.n8n.io/hosting/configuration/configuration-examples/modules-in-code-node/)
- [n8n Binary Data Docs](https://docs.n8n.io/data/binary-data/)
- [n8n Binary Data Scaling](https://docs.n8n.io/hosting/scaling/binary-data/)
- [n8n Binary Data Environment Variables](https://docs.n8n.io/hosting/configuration/environment-variables/binary-data/)
- [n8n v2.0 Breaking Changes](https://docs.n8n.io/2-0-breaking-changes/)
- [Execute Command Node Docs](https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.executecommand/)

### CV Workflow Templates
- [Generate tailored resumes with AI](https://n8n.io/workflows/6748-generate-tailored-resumes-cover-letters-and-interview-prep-from-linkedin-jobs-with-ai/)
- [ATS Resumes with Perplexity AI](https://n8n.io/workflows/7637-generate-job-specific-ats-resumes-with-perplexity-ai-and-pdf-export/)
- [AI Resume Tailoring with GPT-4o](https://n8n.io/workflows/11215-automate-job-applications-with-ai-resume-tailoring-using-gpt-4o-linkedin-and-gmail/)
- [Resumes with GitHub Pages and Gotenberg](https://n8n.io/workflows/10242-personalize-resumes-and-cover-letters-with-ai-github-pages-and-google-drive/)

### LaTeX/Typst
- [Typst GitHub](https://github.com/typst/typst)
- [Typst ARM64 Docker Issue](https://github.com/typst/typst/issues/5290)
- [modern-cv Typst Template](https://typst.app/universe/package/modern-cv/)
- [brilliant-cv Typst Template](https://typst.app/universe/package/brilliant-cv/)
- [Tectonic GitHub](https://github.com/tectonic-typesetting/tectonic)
- [Tectonic Docker](https://github.com/rekka/tectonic-docker)

### External APIs
- [DocRaptor](https://docraptor.com/)
- [PDFShift](https://pdfshift.io/)
- [Resend Community Node](https://communitynodes.com/n8n-nodes-resend/)
- [wkhtmltopdf vs WeasyPrint](https://stackshare.io/stackups/weasyprint-vs-wkhtmltopdf)

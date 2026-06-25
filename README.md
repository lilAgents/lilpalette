# lilPalette

Describe your business and get an AI-generated brand color palette with copyable hex codes and a downloadable mood board. A free tool by [lilAgents](https://lilagents.com).

**Live version:** https://lilagents.com/tools/palette/

This is the standalone, open-source build, a self-contained Astro site. Deploy it on Netlify; the AI call runs in a Netlify Function so your Gemini key stays server-side. The canonical hosted version is folded natively into the lilAgents website.

## Run locally

```
pnpm install
cp .env.example .env   # add your Google Gemini key as GEMINI_API_KEY
pnpm dev
pnpm build
```
Set `GEMINI_API_KEY` (locally via `netlify dev`, and in your Netlify site env) for live AI generation. Without it, the tool falls back to local industry-based palettes.

## Tech

Astro + Tailwind CSS + vanilla JS, with a Netlify Function proxying Google Gemini.

## License

MIT. See [LICENSE](LICENSE). Made with love by lilAgents.

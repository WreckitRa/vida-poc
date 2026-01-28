# Restaurant Concierge Prototype

A Next.js App Router project with TypeScript, Tailwind CSS, and OpenAI integration.

## Getting Started

1. Install dependencies:
```bash
npm install
```

2. Copy the environment example file:
```bash
cp .env.example .env
```

3. Add your OpenAI API key to `.env`:
```
OPENAI_API_KEY=your_api_key_here
```

4. Run the development server:
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Deploy on Railway

The app is configured for [Railway](https://railway.com) via `railway.json`. To deploy:

1. **Connect the repo** – Create a new project on Railway and connect this GitHub repository.
2. **Set environment variables** – In the service → Variables, add:
   - `OPENAI_API_KEY` – Your OpenAI API key (required for API routes).
3. **Deploy** – Railway will run `npm run build` and start with `npm start`. Healthchecks use `GET /api/health`.

No Dockerfile is required; Railway uses Railpack and detects the Next.js app from the config.

## Project Structure

- `/app` - Next.js App Router pages and layouts
- `/components` - React components
- `/lib` - Utility functions and server-side code (including OpenAI client)
- `/types` - TypeScript type definitions

## Important Notes

- The OpenAI SDK is configured for **server-side usage only**. Never import or use it in client components.
- Use the `getOpenAIClient()` function from `/lib/openai.ts` in Server Components or API routes.

# Veeblog

A minimal microblogging platform with Markdown support.

## Tech stack

- Node.js + Express
- EJS templates + Vue (browser-side)
- MongoDB + Mongoose

## Local setup

1. Install dependencies:

```bash
npm install
```

2. Copy the environment template and fill values:

```bash
cp .env.example .env
```

3. Add local host mappings (required for development domain):

```bash
sudo nano /etc/hosts
```

Add:

```text
127.0.0.1 veeblog.local
127.0.0.1 www.veeblog.local
127.0.0.1 alice.veeblog.local
```

Notes:

- `veeblog.local` matches the local `DOMAIN` in `config.js`.
- You can replace `alice` with any username subdomain you want to test.
- On Windows, edit `C:\Windows\System32\drivers\etc\hosts` with the same entries.

4. Export environment variables (or run through your preferred env loader) and start:

```bash
npm start
```

The app runs on `http://localhost:3000` by default.
You can also access it via `http://veeblog.local:3000`.

## Scripts

- `npm start`: start server
- `npm run api-dev`: start with CSRF disabled (local API testing only)
- `npm test`: lint project

# Minecraft Head Service

Express.js service to serve Minecraft head images via redirect.

## Endpoint

`GET /api/head?username=:username&size=:size`

- If UUID cached for username: 302 redirect to Crafatar
- If not cached: lookup UUID from Mojang API, cache result for 1 hour (success), 2 min (miss)
- If Mojang fails or name not found: redirect to Minotar
- No image proxying, only redirects
- Uses axios, lru-cache, p-limit

## Usage

1. Install dependencies:
   ```bash
   npm install
   ```
2. Start service:
   ```bash
   npm start
   ```
3. Example request:
   ```bash
   curl "http://localhost:3001/api/head?username=Notch&size=64"
   ```

## Frontend Integration

- To show a player's head, request `/api/head?username=NAME&size=64` and use the redirect URL as `<img src=... />`.
- Combine with Mojang lookup in your UI: after username is entered, show the head left, name right, UUID below in small gray text.

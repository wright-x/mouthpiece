# Deploy to Vercel with env vars set. Run in PowerShell from this folder:
#   powershell -ExecutionPolicy Bypass -File .\deploy.ps1
# Needs Node.js. Tip: connect the GitHub repo in Vercel > Project > Settings > Git so every push redeploys.

$ErrorActionPreference = "Stop"
$vercel = Read-Host "Vercel token"
$gemini = Read-Host "Gemini API key"
$code   = Read-Host "Access code (case-sensitive)"

npx --yes vercel@latest link --yes --project mouthpiece --token $vercel
$gemini | npx --yes vercel@latest env add GEMINI_API_KEY production --force --token $vercel
$code   | npx --yes vercel@latest env add ACCESS_CODE production --force --token $vercel
npx --yes vercel@latest deploy --prod --yes --token $vercel

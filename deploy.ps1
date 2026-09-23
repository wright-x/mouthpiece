# One-shot: push to a new GitHub repo + deploy to Vercel with GEMINI_API_KEY set.
# Run from this folder in PowerShell:   powershell -ExecutionPolicy Bypass -File .\deploy.ps1
# Needs: git, Node.js. Optional: GitHub CLI (gh) for automatic repo creation.

$ErrorActionPreference = "Stop"
$gemini = Read-Host "Gemini API key"
$vercel = Read-Host "Vercel token"

# ---- GitHub ----
if (-not (Test-Path .git)) { git init -b main; git add -A; git commit -m "Mouthpiece" }
if (Get-Command gh -ErrorAction SilentlyContinue) {
  gh repo create mouthpiece --public --source . --push
} else {
  Write-Host "`nGitHub CLI not found. Create an empty repo named 'mouthpiece' at https://github.com/new, then press Enter." -ForegroundColor Yellow
  Read-Host | Out-Null
  $user = Read-Host "Your GitHub username"
  git remote remove origin 2>$null
  git remote add origin "https://github.com/$user/mouthpiece.git"
  git push -u origin main
}

# ---- Vercel ----
npx --yes vercel@latest link --yes --project mouthpiece --token $vercel
$gemini | npx --yes vercel@latest env add GEMINI_API_KEY production --force --token $vercel
npx --yes vercel@latest deploy --prod --yes --token $vercel

Write-Host "`nDone. Tip: in Vercel -> Project -> Settings -> Git, connect the GitHub repo so every push redeploys." -ForegroundColor Green

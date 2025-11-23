# 🖥️ Deployment Commands Reference

## Quick Copy-Paste Commands for Deployment

---

## **Git Setup & Initial Push**

```bash
# Initialize git repository
git init

# Add all files to staging
git add .

# Create first commit
git commit -m "Initial commit - Para's SFX Library"

# Add GitHub remote (replace YOUR_USERNAME)
git remote add origin https://github.com/YOUR_USERNAME/paras-sfx-library.git

# Push to GitHub
git push -u origin main
```

---

## **Regular Updates After Initial Deployment**

```bash
# After making changes to your code:

# 1. Check what changed
git status

# 2. Add all changes
git add .

# 3. Commit with descriptive message
git commit -m "Update: describe your changes here"

# 4. Push to GitHub (auto-deploys to Vercel!)
git push
```

---

## **Common Git Commands**

```bash
# View commit history
git log --oneline

# See current branch
git branch

# Create new branch
git checkout -b feature/new-feature

# Switch branches
git checkout main

# Merge branch into main
git checkout main
git merge feature/new-feature

# Discard local changes
git checkout -- .

# Remove file from staging
git reset HEAD filename.tsx

# View remote repository
git remote -v
```

---

## **Development Commands**

```bash
# Install dependencies (first time)
npm install

# Run development server
npm run dev
# Opens at: http://localhost:5173

# Build for production (test before deploying)
npm run build

# Preview production build locally
npm run preview

# Type checking
npm run type-check

# Lint code
npm run lint
```

---

## **Vercel CLI Commands** (Optional)

```bash
# Install Vercel CLI globally
npm install -g vercel

# Login to Vercel
vercel login

# Deploy from command line
vercel

# Deploy to production
vercel --prod

# View deployment logs
vercel logs

# View project info
vercel inspect

# Remove deployment
vercel remove [deployment-url]

# Link local project to Vercel project
vercel link
```

---

## **Supabase Management** (If Needed)

```bash
# Install Supabase CLI (optional)
npm install -g supabase

# Login to Supabase
supabase login

# Initialize Supabase project
supabase init

# Start local Supabase (for testing)
supabase start

# Stop local Supabase
supabase stop
```

---

## **Troubleshooting Commands**

```bash
# Clear npm cache
npm cache clean --force

# Reinstall dependencies
rm -rf node_modules package-lock.json
npm install

# Check Node version
node --version
# Should be 18+

# Check npm version
npm --version

# Update npm
npm install -g npm@latest

# View environment variables (local)
printenv | grep VITE_
```

---

## **Database Commands** (Supabase)

Your app uses Supabase KV store via API calls. No direct SQL needed!

But if you need to access Supabase SQL editor:

```sql
-- View all sounds
SELECT * FROM kv_store_27929102 WHERE key LIKE 'sound:%';

-- View all tags
SELECT * FROM kv_store_27929102 WHERE key LIKE 'tag:%';

-- View all suggestions
SELECT * FROM kv_store_27929102 WHERE key LIKE 'suggestion:%';

-- Count total sounds
SELECT COUNT(*) FROM kv_store_27929102 WHERE key LIKE 'sound:%';
```

---

## **Package Management**

```bash
# Add new package
npm install package-name

# Add dev dependency
npm install --save-dev package-name

# Remove package
npm uninstall package-name

# Update all packages
npm update

# Check for outdated packages
npm outdated

# Install specific version
npm install package-name@1.2.3

# View installed packages
npm list --depth=0
```

---

## **Build Optimization**

```bash
# Analyze bundle size
npm run build
# Check dist/ folder size

# Run production build
npm run build

# Test production build locally
npm run preview

# Check for unused dependencies
npx depcheck

# Format code (if prettier is set up)
npx prettier --write .
```

---

## **Deployment Workflows**

### **Standard Deployment:**
```bash
git add .
git commit -m "Your change description"
git push
# Vercel auto-deploys!
```

### **Feature Branch Deployment:**
```bash
# Create feature branch
git checkout -b feature/new-feature

# Make changes, then:
git add .
git commit -m "Add new feature"
git push origin feature/new-feature

# Vercel creates preview deployment!
# Merge to main for production
```

### **Hotfix Deployment:**
```bash
# Quick fix for production issue
git add .
git commit -m "Fix: critical bug"
git push

# Deployed in ~2 minutes
```

### **Rollback:**
```bash
# If latest deployment has issues:
# Go to Vercel Dashboard → Deployments
# Click previous working deployment
# Click "Promote to Production"

# Or via CLI:
vercel rollback [deployment-url]
```

---

## **Testing Before Deploy**

```bash
# 1. Run development server
npm run dev

# 2. Test all features
# - Search works
# - Audio plays
# - Admin panel works

# 3. Build for production
npm run build

# 4. Preview production build
npm run preview

# 5. Test production build
# Visit http://localhost:4173

# 6. If everything works:
git add .
git commit -m "Ready for production"
git push
```

---

## **Environment Variables Management**

```bash
# Create .env.local for local development
cat > .env.local << EOF
VITE_EMAILJS_SERVICE_ID=your_service_id
VITE_EMAILJS_TEMPLATE_ID=your_template_id
VITE_EMAILJS_PUBLIC_KEY=your_public_key
EOF

# Note: .env.local is gitignored
# Add to Vercel Dashboard for production
```

---

## **Performance Monitoring**

```bash
# Check bundle size
npm run build
ls -lh dist/assets/

# Lighthouse audit (requires Chrome)
npx lighthouse https://paras-sfx-library.vercel.app --view

# Check load time
curl -w "@-" -o /dev/null -s https://paras-sfx-library.vercel.app << 'EOF'
    time_namelookup:  %{time_namelookup}\n
       time_connect:  %{time_connect}\n
    time_appconnect:  %{time_appconnect}\n
      time_redirect:  %{time_redirect}\n
   time_pretransfer:  %{time_pretransfer}\n
 time_starttransfer:  %{time_starttransfer}\n
                    ----------\n
         time_total:  %{time_total}\n
EOF
```

---

## **Backup & Recovery**

```bash
# Export Supabase data (via dashboard or API)
# Your data is automatically backed up by Supabase

# Clone repository to new location (backup code)
git clone https://github.com/YOUR_USERNAME/paras-sfx-library.git backup-folder

# Create GitHub release (version tagging)
git tag -a v1.0.0 -m "Version 1.0.0 - Initial release"
git push origin v1.0.0
```

---

## **Production Deployment Checklist Commands**

```bash
# 1. Test locally
npm run dev

# 2. Build production
npm run build

# 3. Test production build
npm run preview

# 4. Check for errors
# Open browser console - should be no errors

# 5. Commit and deploy
git add .
git commit -m "Production ready"
git push

# 6. Monitor deployment
# Watch Vercel dashboard for build status

# 7. Test live site
curl -I https://paras-sfx-library.vercel.app
# Should return: HTTP/2 200

# 8. Verify functionality
# Manual testing on live site
```

---

## **Common Issues & Fixes**

```bash
# Issue: Port already in use
# Fix: Kill process on port 5173
lsof -ti:5173 | xargs kill -9
# Then: npm run dev

# Issue: Git conflicts
# Fix: Pull latest changes
git pull origin main
# Resolve conflicts, then:
git add .
git commit -m "Resolve conflicts"
git push

# Issue: Vercel build fails
# Fix: Check build logs
# Test locally: npm run build
# Fix errors, then push again

# Issue: Node modules corrupted
# Fix: Clean reinstall
rm -rf node_modules package-lock.json
npm install
```

---

## **One-Line Deployment**

```bash
# Ultimate quick deploy (use carefully!)
git add . && git commit -m "Quick update" && git push
```

---

## **Daily Workflow**

```bash
# Morning routine:
git pull                    # Get latest changes
npm install                 # Update dependencies
npm run dev                 # Start development

# During development:
# - Make changes
# - Test in browser
# - Repeat

# End of day:
git add .
git commit -m "Today's updates: [describe changes]"
git push                    # Auto-deploys to Vercel!
```

---

## **Emergency Commands**

```bash
# Site is down or broken - quick rollback:
# 1. Go to Vercel Dashboard
# 2. Deployments tab
# 3. Click previous working deployment
# 4. "Promote to Production"

# Or force redeploy current code:
git commit --allow-empty -m "Force redeploy"
git push
```

---

## **Useful Aliases** (Add to ~/.bashrc or ~/.zshrc)

```bash
# Quick git commands
alias gs='git status'
alias ga='git add .'
alias gc='git commit -m'
alias gp='git push'
alias gl='git log --oneline'

# Quick deploy
alias deploy='git add . && git commit -m "Update" && git push'

# Development
alias dev='npm run dev'
alias build='npm run build'
alias preview='npm run preview'

# After adding, reload:
source ~/.bashrc  # or source ~/.zshrc
```

---

## **CI/CD Commands** (Advanced)

```bash
# Vercel automatically handles CI/CD
# But if you want to add GitHub Actions:

# Create .github/workflows/deploy.yml
mkdir -p .github/workflows

cat > .github/workflows/deploy.yml << 'EOF'
name: Deploy
on:
  push:
    branches: [main]
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-node@v2
        with:
          node-version: '18'
      - run: npm install
      - run: npm run build
      - run: npm run test  # if you have tests
EOF
```

---

## **Quick Reference Card**

```
┌─────────────────────────────────────────────┐
│ DEPLOY                                      │
│ git add . && git commit -m "msg" && git push│
├─────────────────────────────────────────────┤
│ RUN LOCAL                                   │
│ npm run dev                                 │
├─────────────────────────────────────────────┤
│ BUILD                                       │
│ npm run build                               │
├─────────────────────────────────────────────┤
│ TEST BUILD                                  │
│ npm run preview                             │
├─────────────────────────────────────────────┤
│ CHECK STATUS                                │
│ git status                                  │
└─────────────────────────────────────────────┘
```

---

**Keep this file handy for quick command reference!** 📖

**Last Updated:** January 2024

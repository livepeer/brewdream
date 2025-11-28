# Brewdream - Realtime AI Video Summit

> **🤖 For AI Agents**:
> - Read [`PRD.md`](./PRD.md) first to understand **what to build** (product vision, requirements, acceptance criteria)
> - Then read [`VIBEME.md`](./VIBEME.md) to understand **how it's built** (current implementation, architecture patterns, coding conventions)
> - These documents are tightly integrated - PRD is the source of truth for features, VIBEME is the source of truth for code patterns

## Project info

**Project**: Brewdream - Mobile-first microsite originally built for the [Real Time Video AI Summit](https://luma.com/seh85x03)

**What it does**: Attendees scan QR, create AI-stylized video clips (3-10s), share on X, get coffee tickets

**URL**: https://lovable.dev/projects/c0dae90c-30a9-4f3c-904d-7418f6e67422

## How can I edit this code?

There are several ways of editing your application.

**Use Lovable**

Simply visit the [Lovable Project](https://lovable.dev/projects/c0dae90c-30a9-4f3c-904d-7418f6e67422) and start prompting.

Changes made via Lovable will be committed automatically to this repo.

**Use your preferred IDE**

If you want to work locally using your own IDE, you can clone this repo and push changes. Pushed changes will also be reflected in Lovable.

The only requirement is having Node.js & npm installed - [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating)

Follow these steps:

```sh
# Step 1: Clone the repository using the project's Git URL.
git clone <YOUR_GIT_URL>

# Step 2: Navigate to the project directory.
cd <YOUR_PROJECT_NAME>

# Step 3: Install the necessary dependencies.
npm i

# Step 4: Get .env.local file from your team
# Ask your team for the .env.local file with Supabase credentials
# Place it in the project root (it's gitignored for security)

# Step 5: Start the development server
npm run dev
```

**Prerequisites:**
- Node.js & npm - [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating)
- `.env.local` file with Supabase credentials (ask your team)

## Development Testing

**Anonymous Login (Fastest):**
1. Run `npm run dev`
2. Go to http://localhost:8080/login
3. Click "Continue without email"
4. Start creating clips immediately!

**Email OTP Testing:**
- Enter any email → Get OTP code in inbox
- Or add email to anonymous account for coffee tickets

### Quick Test Checklist

```bash
npm run dev

# Test 1: Anonymous flow
✓ Go to /login
✓ Click "Continue without email"
✓ Should redirect to /capture
✓ Create a clip

# Test 2: Email upgrade
✓ Go back to /start
✓ Should show "Add your email"
✓ Enter email → verify OTP
✓ All clips still there!
```

**Edit a file directly in GitHub**

- Navigate to the desired file(s).
- Click the "Edit" button (pencil icon) at the top right of the file view.
- Make your changes and commit the changes.

**Use GitHub Codespaces**

- Navigate to the main page of your repository.
- Click on the "Code" button (green button) near the top right.
- Select the "Codespaces" tab.
- Click on "New codespace" to launch a new Codespace environment.
- Edit files directly within the Codespace and commit and push your changes once you're done.

## What technologies are used for this project?

This project is built with:

- Vite
- TypeScript
- React
- shadcn-ui
- Tailwind CSS

## How can I deploy this project?

Simply open [Lovable](https://lovable.dev/projects/c0dae90c-30a9-4f3c-904d-7418f6e67422) and click on Share -> Publish.

## Can I connect a custom domain to my Lovable project?

Yes, you can!

To connect a domain, navigate to Project > Settings > Domains and click Connect Domain.

Read more here: [Setting up a custom domain](https://docs.lovable.dev/features/custom-domain#custom-domain)

# Setup & Environment Guide (`Setup.md`)

## 1. Prerequisites
- Node.js 20+
- Provisioned Firebase project (`firebase-applet-config.json` in root)

## 2. Environment Configuration (`.env.example`)

```env
GEMINI_API_KEY="MY_GEMINI_API_KEY"
APP_URL="MY_APP_URL"
```

Firebase project configuration (`projectId: "second-gist-57c1c"`, `firestoreDatabaseId: "ai-studio-a90bd914-6b7d-4917-9203-78b80a477218"`, `apiKey`, `authDomain`, and `appId`) is loaded directly from `/firebase-applet-config.json`.

## 3. Installation & Startup

```bash
# Install dependencies
npm install

# Run unit and security rules tests
node --test lib/lms-logic.test.ts firestore.rules.test.ts

# Lint codebase and Firestore rules
npm run lint
npx eslint firestore.rules

# Start development server on port 3000
npm run dev

# Build for production
npm run build
```

## 4. Enabling Firebase Authentication Providers (Optional for Production Cloud Auth)
1. Open the [Firebase Console](https://console.firebase.google.com/) for your provisioned project (`second-gist-57c1c`).
2. Navigate to **Authentication → Sign-in method**.
3. Enable **Google** (pre-configured by AI Studio provisioning) and **Email/Password** if you want client-side Firebase Email/Password authentication in addition to the built-in server session authentication.

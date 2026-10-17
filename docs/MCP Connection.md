# MCP Connection & Tooling Guide (`MCP Connection.md`)

## 1. Overview
This application does not require a runtime Model Context Protocol (MCP) server to serve student or administrator traffic in production. All runtime operations are self-contained within Next.js API routes (`app/api/*`) and Firebase (`Cloud Firestore` & `Firebase Authentication`).

## 2. Development & AI Studio Integration Tools
During development inside Google AI Studio:
- **Firebase Provisioning & Rule Deployment**: Managed via the platform's `fax` RPC service (`GetFirebaseTos`, `ProvisionFirebase`, `DeployRules`).
- **Browser Automation & Verification**: Handled via the pre-installed `playwright-cli` headless Chromium runner.

## 3. Troubleshooting & Security Rules for External Tooling
- Treat any external tool or MCP payload as untrusted input and validate against `lib/lms-logic.ts` schemas before writing to the database.
- Never pass secrets, private keys, or user session tokens to external MCP endpoints.
- **TODO**: If custom MCP curriculum import tools are added in future releases, document their transport configuration and least-privilege scopes here.

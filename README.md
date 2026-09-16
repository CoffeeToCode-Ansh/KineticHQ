# KineticHQ — Week 3 Task 1
## SMTP Contact Form Integration

This version completes:

- HTTP request / response
- Node.js
- Express
- `POST /api/contact`
- Nodemailer
- SMTP
- Environment variables
- Backend validation
- CORS allow-list
- Vercel-ready deployment
- Frontend → API → Backend → SMTP → Company Email

The UI keeps the warm editorial fitness direction from the supplied references: cream, latte,
terracotta and deep brown, large serif typography, rounded cards, photography, an interactive
fitness quest, calculator, workout generator, facilities and contact experience.

## Project structure

```text
KineticHQ-week3-task1/
├── public/
│   ├── index.html
│   ├── styles.css
│   ├── script.js
│   └── assets/
│       ├── logo.jpeg
│       ├── hero-figure.jpg
│       ├── program-sign.jpg
│       ├── yoga-art.jpg
│       ├── meditation-art.jpg
│       ├── transformation.jpg
│       ├── contact-bg.jpeg
│       ├── strength-floor.jpg
│       ├── performance-zone.jpg
│       ├── yoga-meditation-studio.jpg
│       └── cardio-studio.jpg
├── server.js
├── package.json
├── .env.example
├── .gitignore
├── vercel.json
└── README.md
```

## 1. Install

Requirements: Node.js 20+.

```bash
npm install
```

## 2. Create `.env`

Copy `.env.example` to `.env`.

```bash
# Windows PowerShell
Copy-Item .env.example .env

# macOS / Linux
cp .env.example .env
```

Then put your real SMTP settings in `.env`.

### Gmail / Google Workspace

Use:

```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=youraccount@gmail.com
SMTP_PASS=your-16-character-app-password
COMPANY_EMAIL=yourcompany@example.com
SMTP_FROM_EMAIL=youraccount@gmail.com
ALLOWED_ORIGINS=http://localhost:3000,http://127.0.0.1:3000
```

For Gmail, `SMTP_PASS` should be the Google **App Password**, not the normal Gmail
password.

Never commit `.env`.

## 3. Run

```bash
npm run dev
```

Open:

```text
http://localhost:3000
```

Health check:

```text
http://localhost:3000/api/health
```

Expected response:

```json
{
  "ok": true,
  "service": "KineticHQ contact API",
  "smtpConfigured": true
}
```

## 4. How the contact form works

```text
User fills KineticHQ form
        |
        | POST /api/contact
        | JSON
        v
Frontend: public/script.js
        |
        v
Express: server.js
        |
        +--> CORS allow-list
        +--> JSON body limit
        +--> backend validation
        +--> honeypot check
        |
        v
Nodemailer
        |
        v
SMTP server
        |
        v
COMPANY_EMAIL
```

Request body:

```json
{
  "name": "Guest Name",
  "email": "guest@example.com",
  "objective": "Build Explosive Power",
  "message": "I would like help choosing a training plan."
}
```

Success:

```json
{
  "ok": true,
  "message": "Your message was sent successfully. KineticHQ will be in touch."
}
```

Validation failure:

```json
{
  "ok": false,
  "error": "Validation failed.",
  "errors": [
    "Please enter a valid email address."
  ]
}
```

## 5. Backend validation included

The API validates:

- required name
- name length: 2–80
- valid email format
- required objective
- message length: 10–1500
- JSON body maximum: 20 KB
- hidden honeypot for basic bot filtering

SMTP credentials never reach the browser.

The email uses the configured SMTP account as `From` and the visitor's address as
`Reply-To`, so the company can reply directly.

## 6. Vercel deployment

### GitHub

```bash
git init
git add .
git commit -m "KineticHQ Week 3 Task 1 SMTP integration"
git branch -M main
git remote add origin YOUR_GITHUB_REPOSITORY_URL
git push -u origin main
```

### Vercel

Import the GitHub repository into Vercel.

Then add these environment variables in:

**Vercel → Project → Settings → Environment Variables**

```text
SMTP_HOST
SMTP_PORT
SMTP_SECURE
SMTP_USER
SMTP_PASS
COMPANY_EMAIL
SMTP_FROM_EMAIL
ALLOWED_ORIGINS
```

For example:

```env
ALLOWED_ORIGINS=https://your-project.vercel.app
```

If you have a custom domain, include it too:

```env
ALLOWED_ORIGINS=https://your-project.vercel.app,https://www.yourdomain.com
```

Redeploy after changing environment variables.

Then verify:

```text
https://your-project.vercel.app/api/health
```

Finally submit the KineticHQ contact form and confirm the email reaches `COMPANY_EMAIL`.

## 7. Important security notes

- Do not put SMTP credentials in `public/script.js`.
- Do not put SMTP credentials in `index.html`.
- Do not commit `.env`.
- Use a Gmail App Password for Gmail SMTP.
- Keep `ALLOWED_ORIGINS` restricted to real frontend origins in production.
- The backend validates again even though the browser also validates.
- The backend escapes user text before putting it into HTML email.
- API errors intentionally avoid exposing SMTP credentials or transporter internals.

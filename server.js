const http = require('http');
const fs = require('fs');
const path = require('path');
const nodemailer = require('nodemailer'); // <-- Nodemailer import kiya

const PORT = process.env.PORT || 3000;
const BASE_DIR = __dirname;
const SUBMISSIONS_FILE = path.join(BASE_DIR, 'contact_submissions.json');

// ── Nodemailer Transporter Configuration ────────────────────────────────────
// Yahan apna email aur App Password daalna (Gmail ke liye App Password use hota hai)
const transporter = nodemailer.createTransport({
  service: 'gmail', // Ya apna SMTP host/port
  auth: {
    user: process.env.EMAIL_USER || 'your-email@gmail.com', // Apna email
    pass: process.env.EMAIL_PASS || 'your-app-password',     // Gmail App Password
  },
});

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
};

function saveSubmission(data) {
  let submissions = [];
  try {
    if (fs.existsSync(SUBMISSIONS_FILE)) {
      submissions = JSON.parse(fs.readFileSync(SUBMISSIONS_FILE, 'utf-8'));
    }
  } catch (e) { /* ignore parse errors, start fresh */ }
  submissions.push({ ...data, timestamp: new Date().toISOString() });
  fs.writeFileSync(SUBMISSIONS_FILE, JSON.stringify(submissions, null, 2));
}

// ── Send Email Function ───────────────────────────────────────────────────
async function sendContactEmail(data) {
  const { name, number, email, message } = data;

  const mailOptions = {
    from: `"Paysonic Website" <${process.env.EMAIL_USER}>`,
    to: 'anishbalkhi1@gmail.com', // <-- Yeh rahi aapki main email ID jahan mail aayega
    subject: `New Contact Submission from ${name}`,
    html: `
      <h2>New Contact Form Enquiry</h2>
      <p><strong>Name:</strong> ${name}</p>
      <p><strong>Phone Number:</strong> ${number}</p>
      <p><strong>Email:</strong> ${email}</p>
      <p><strong>Message:</strong><br/>${message || 'No message provided'}</p>
      <hr/>
      <p style="font-size: 12px; color: #666;">This email was sent from the Paysonic website contact form.</p>
    `,
  };

  await transporter.sendMail(mailOptions);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => { body += chunk.toString(); });
    req.on('end', () => resolve(body));
    req.on('error', reject);
  });
}

const server = http.createServer(async (req, res) => {
  // ── POST /contact ─────────────────────────────────────────────────────────
  if (req.method === 'POST' && req.url === '/contact') {
    try {
      const body = await readBody(req);
      const data = JSON.parse(body);
      const { name, number, email, message } = data;

      if (!name || !email) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: false, error: 'Missing required fields.' }));
        return;
      }

      // 1. Local JSON file mein save karo
      saveSubmission({ name, number, email, message });

      // 2. anishbalkhi1@gmail.com par email dispatch karo
      await sendContactEmail({ name, number, email, message });
      console.log(`[Contact] Email successfully sent for ${name} <${email}>`);

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true }));
    } catch (err) {
      console.error('[Contact] Error:', err);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: false, error: 'Server error while sending email.' }));
    }
    return;
  }

  // ── Static file serving ───────────────────────────────────────────────────
  let reqUrl = decodeURI(req.url.split('?')[0]);
  if (reqUrl === '/') {
    reqUrl = '/index.html';
  }

  const safePath = path.normalize(reqUrl).replace(/^(\.\.[\\/])+/, '');
  const filePath = path.join(BASE_DIR, safePath);

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(`<h1>404 Not Found</h1><p>The requested file <code>${reqUrl}</code> was not found.</p>`);
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    res.writeHead(200, { 'Content-Type': contentType });
    const stream = fs.createReadStream(filePath);
    stream.pipe(res);
  });
});

server.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}/`);
  console.log(`Contact submissions will be saved to: ${SUBMISSIONS_FILE}`);
});
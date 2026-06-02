const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { MercadoPagoConfig, Payment } = require('mercadopago');
const sqlite3 = require('better-sqlite3');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static('public')); // sirve o helix777.html aqui

// ─── CONFIG ───────────────────────────────────────
const JWT_SECRET = process.env.JWT_SECRET || 'TROQUE_ISSO_POR_UMA_SENHA_FORTE';
const MP_TOKEN   = process.env.MP_TOKEN   || 'SEU_ACCESS_TOKEN_MERCADOPAGO';
const PORT       = process.env.PORT       || 3000;

// ─── MERCADO PAGO ─────────────────────────────────
const mp = new MercadoPagoConfig({ accessToken: MP_TOKEN });
const mpPayment = new Payment(mp);

// ─── BANCO DE DADOS (SQLite) ───────────────────────
const db = new sqlite3('helix.db');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id       INTEGER PRIMARY KEY AUTOINCREMENT,
    name     TEXT NOT NULL,
    email    TEXT UNIQUE NOT NULL,
    phone    TEXT,
    password TEXT NOT NULL,
    balance  REAL DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS games (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id    INTEGER NOT NULL,
    bet        REAL NOT NULL,
    won        REAL NOT NULL,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS deposits (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id     INTEGER NOT NULL,
    amount      REAL NOT NULL,
    mp_id       TEXT,
    status      TEXT DEFAULT 'pending',
    created_at  TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS withdrawals (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id     INTEGER NOT NULL,
    amount      REAL NOT NULL,
    pix_key     TEXT NOT NULL,
    pix_name    TEXT,
    pix_cpf     TEXT,
    status      TEXT DEFAULT 'pending',
    created_at  TEXT DEFAULT (datetime('now'))
  );
`);

// ─── MIDDLEWARE AUTH ───────────────────────────────
function auth(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Não autorizado' });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Token inválido' });
  }
}

// ════════════════════════════════════════════════════
// ROTAS DE AUTENTICAÇÃO
// ════════════════════════════════════════════════════

// CADASTRO
app.post('/api/register', async (req, res) => {
  const { name, email, phone, password } = req.body;
  if (!name || !email || !password)
    return res.status(400).json({ error: 'Preencha todos os campos' });

  const hash = bcrypt.hashSync(password, 10);
  try {
    const stmt = db.prepare(
      'INSERT INTO users (name, email, phone, password, balance) VALUES (?, ?, ?, ?, ?)'
    );
    const info = stmt.run(name, email, phone || '', hash, 0);
    const token = jwt.sign({ id: info.lastInsertRowid, email }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, name, balance: 0 });
  } catch (e) {
    if (e.message.includes('UNIQUE')) return res.status(400).json({ error: 'E-mail já cadastrado' });
    res.status(500).json({ error: 'Erro interno' });
  }
});

// LOGIN
app.post('/api/login', (req, res) => {
  const { email, password } = req.body;
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  if (!user || !bcrypt.compareSync(password, user.password))
    return res.status(401).json({ error: 'E-mail ou senha incorretos' });

  const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: '7d' });
  res.json({ token, name: user.name, balance: user.balance });
});

// ════════════════════════════════════════════════════
// ROTAS DO USUÁRIO
// ════════════════════════════════════════════════════

// PERFIL / SALDO
app.get('/api/me', auth, (req, res) => {
  const user = db.prepare('SELECT id, name, email, phone, balance FROM users WHERE id = ?').get(req.user.id);
  if (!user) return res.status(404).json({ error: 'Usuário não encontrado' });
  res.json(user);
});

// HISTÓRICO DE PARTIDAS
app.get('/api/games', auth, (req, res) => {
  const games = db.prepare(
    'SELECT * FROM games WHERE user_id = ? ORDER BY created_at DESC LIMIT 50'
  ).all(req.user.id);
  res.json(games);
});

// ════════════════════════════════════════════════════
// ROTAS DO JOGO
// ════════════════════════════════════════════════════

// REGISTRAR RESULTADO DE PARTIDA
app.post('/api/game/result', auth, (req, res) => {
  const { bet, won } = req.body; // won = valor ganho (positivo) ou perdido (negativo)
  if (!bet || bet <= 0) return res.status(400).json({ error: 'Aposta inválida' });

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  if (!user) return res.status(404).json({ error: 'Usuário não encontrado' });
  if (user.balance < bet) return res.status(400).json({ error: 'Saldo insuficiente' });

  const newBalance = user.balance + won; // won já é +payout ou -bet
  db.prepare('UPDATE users SET balance = ? WHERE id = ?').run(newBalance, user.id);
  db.prepare('INSERT INTO games (user_id, bet, won) VALUES (?, ?, ?)').run(user.id, bet, won);

  res.json({ balance: newBalance, won });
});

// ════════════════════════════════════════════════════
// DEPÓSITO VIA PIX (Mercado Pago)
// ════════════════════════════════════════════════════

app.post('/api/deposit', auth, async (req, res) => {
  const { amount } = req.body;
  if (!amount || amount < 5) return res.status(400).json({ error: 'Valor mínimo R$5,00' });

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);

  try {
    const payment = await mpPayment.create({
      body: {
        transaction_amount: Number(amount),
        description: `Depósito HelixWin - ${user.name}`,
        payment_method_id: 'pix',
        payer: {
          email: user.email,
          first_name: user.name.split(' ')[0],
          last_name: user.name.split(' ').slice(1).join(' ') || 'User',
        },
      },
      requestOptions: { idempotencyKey: `dep-${user.id}-${Date.now()}` }
    });

    const mpId = payment.id;
    const pixCode = payment.point_of_interaction?.transaction_data?.qr_code;
    const pixQR   = payment.point_of_interaction?.transaction_data?.qr_code_base64;

    db.prepare('INSERT INTO deposits (user_id, amount, mp_id) VALUES (?, ?, ?)').run(user.id, amount, String(mpId));

    res.json({ mp_id: mpId, pix_code: pixCode, pix_qr: pixQR });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Erro ao gerar PIX de depósito' });
  }
});

// WEBHOOK — Mercado Pago confirma pagamento
app.post('/api/webhook/mp', async (req, res) => {
  const { type, data } = req.body;
  if (type !== 'payment') return res.sendStatus(200);

  try {
    const payment = await mpPayment.get({ id: data.id });
    if (payment.status !== 'approved') return res.sendStatus(200);

    const dep = db.prepare('SELECT * FROM deposits WHERE mp_id = ?').get(String(data.id));
    if (!dep || dep.status === 'approved') return res.sendStatus(200);

    db.prepare('UPDATE deposits SET status = ? WHERE id = ?').run('approved', dep.id);
    db.prepare('UPDATE users SET balance = balance + ? WHERE id = ?').run(dep.amount, dep.user_id);

    console.log(`✅ Depósito aprovado: user ${dep.user_id} | R$${dep.amount}`);
  } catch (e) {
    console.error('Webhook error:', e);
  }

  res.sendStatus(200);
});

// ════════════════════════════════════════════════════
// SAQUE VIA PIX (sem exigência de depósito prévio)
// ════════════════════════════════════════════════════

app.post('/api/withdraw', auth, async (req, res) => {
  const { amount, pix_key, pix_name, pix_cpf } = req.body;
  if (!amount || amount <= 0) return res.status(400).json({ error: 'Valor inválido' });
  if (!pix_key)  return res.status(400).json({ error: 'Informe a chave PIX' });

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  if (!user) return res.status(404).json({ error: 'Usuário não encontrado' });
  if (user.balance < amount) return res.status(400).json({ error: 'Saldo insuficiente' });

  // Debita imediatamente
  db.prepare('UPDATE users SET balance = balance - ? WHERE id = ?').run(amount, user.id);

  // Registra saque como pendente (aprovação manual ou automática)
  const info = db.prepare(
    'INSERT INTO withdrawals (user_id, amount, pix_key, pix_name, pix_cpf) VALUES (?, ?, ?, ?, ?)'
  ).run(user.id, amount, pix_key, pix_name || user.name, pix_cpf || '');

  // --- Para envio automático via Mercado Pago, descomente abaixo ---
  // (requer conta MP com permissão de transferência - plano intermediário)
  /*
  try {
    await mpPayment.create({
      body: {
        transaction_amount: Number(amount),
        description: 'Saque HelixWin',
        payment_method_id: 'pix',
        payer: { email: user.email },
        receiver: {
          identification: { type: 'CPF', number: pix_cpf },
          pix_key: { type: 'cpf', value: pix_key }
        }
      }
    });
    db.prepare('UPDATE withdrawals SET status = ? WHERE id = ?').run('paid', info.lastInsertRowid);
  } catch(e) {
    // Se falhar, fica como pending para aprovação manual
    console.error('Erro ao enviar PIX:', e);
  }
  */

  const newBalance = db.prepare('SELECT balance FROM users WHERE id = ?').get(user.id).balance;
  res.json({ message: 'Saque solicitado com sucesso!', balance: newBalance, withdrawal_id: info.lastInsertRowid });
});

// ─── INICIA SERVER ─────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n🌀 Helix777 Server rodando em http://localhost:${PORT}`);
  console.log(`📦 Banco de dados: helix.db`);
  console.log(`💳 Mercado Pago: ${MP_TOKEN === 'SEU_ACCESS_TOKEN_MERCADOPAGO' ? '⚠️  Token não configurado' : '✅ Configurado'}\n`);
});

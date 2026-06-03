const express = require("express");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const Database = require("better-sqlite3");

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static("public"));

const PORT = process.env.PORT || 3000;
const JWT_SECRET =
process.env.JWT_SECRET ||
"troque_por_uma_senha_forte";

const db = new Database("./helix.db");

// TABELAS
[
`
CREATE TABLE IF NOT EXISTS users(
id INTEGER PRIMARY KEY AUTOINCREMENT,
name TEXT NOT NULL,
email TEXT UNIQUE NOT NULL,
phone TEXT,
password TEXT NOT NULL,
balance REAL DEFAULT 0,
created_at TEXT DEFAULT CURRENT_TIMESTAMP
)
`,
`
CREATE TABLE IF NOT EXISTS games(
id INTEGER PRIMARY KEY AUTOINCREMENT,
user_id INTEGER NOT NULL,
bet REAL NOT NULL,
won REAL NOT NULL,
created_at TEXT DEFAULT CURRENT_TIMESTAMP
)
`,
`
CREATE TABLE IF NOT EXISTS deposits(
id INTEGER PRIMARY KEY AUTOINCREMENT,
user_id INTEGER NOT NULL,
amount REAL NOT NULL,
created_at TEXT DEFAULT CURRENT_TIMESTAMP
)
`,
`
CREATE TABLE IF NOT EXISTS withdrawals(
id INTEGER PRIMARY KEY AUTOINCREMENT,
user_id INTEGER NOT NULL,
amount REAL NOT NULL,
pix_key TEXT,
created_at TEXT DEFAULT CURRENT_TIMESTAMP
)
`
].forEach(sql =>
db.prepare(sql).run()
);

// AUTH
function auth(
req,
res,
next
){
const auth =
req.headers.authorization;

if(!auth){
return res.status(401)
.json({
error:"Não autorizado"
});
}

try{
const token =
auth.split(" ")[1];

req.user =
jwt.verify(
token,
JWT_SECRET
);

next();

}catch{

return res.status(401)
.json({
error:"Token inválido"
});

}
}

// REGISTER
app.post(
"/api/register",
async (
req,
res
)=>{
try{

const {
name,
email,
phone,
password
}=req.body;

if(
!name||
!email||
!password
){
return res
.status(400)
.json({
error:"Preencha todos os campos"
});
}

const exists =
db.prepare(
"SELECT id FROM users WHERE email=?"
)
.get(email);

if(exists){
return res
.status(400)
.json({
error:
"E-mail já cadastrado"
});
}

const hash =
await bcrypt.hash(
password,
10
);

const result =
db.prepare(`
INSERT INTO users
(name,email,phone,password)
VALUES(?,?,?,?)
`)
.run(
name,
email,
phone||"",
hash
);

const token =
jwt.sign(
{
id:
result.lastInsertRowid
},
JWT_SECRET,
{
expiresIn:"7d"
}
);

res.json({
token,
name,
balance:0
});

}catch{

res.status(500)
.json({
error:
"Erro interno"
});

}
}
);

// LOGIN
app.post(
"/api/login",
async(
req,
res
)=>{

const {
email,
password
}=req.body;

const user =
db.prepare(
"SELECT * FROM users WHERE email=?"
)
.get(email);

if(!user){
return res
.status(401)
.json({
error:
"Credenciais inválidas"
});
}

const ok =
await bcrypt.compare(
password,
user.password
);

if(!ok){
return res
.status(401)
.json({
error:
"Credenciais inválidas"
});
}

const token =
jwt.sign(
{
id:user.id
},
JWT_SECRET,
{
expiresIn:"7d"
}
);

res.json({
token,
name:user.name,
balance:user.balance
});

}
);

// PERFIL
app.get(
"/api/me",
auth,
(
req,
res
)=>{

const user =
db.prepare(`
SELECT
id,
name,
email,
phone,
balance
FROM users
WHERE id=?
`)
.get(
req.user.id
);

res.json(
user
);

}
);

// DEPÓSITO
app.post(
"/api/deposit",
auth,
(
req,
res
)=>{

const {
amount
}=req.body;

if(
!amount||
amount<=0
){
return res
.status(400)
.json({
error:
"Valor inválido"
});
}

db.prepare(`
UPDATE users
SET balance=
balance+?
WHERE id=?
`)
.run(
amount,
req.user.id
);

res.json({
success:true
});

}
);

// SAQUE
app.post(
"/api/withdraw",
auth,
(
req,
res
)=>{

const {
amount,
pix_key
}=req.body;

const user =
db.prepare(
"SELECT * FROM users WHERE id=?"
)
.get(
req.user.id
);

if(
!user||
user.balance<
amount
){
return res
.status(400)
.json({
error:
"Saldo insuficiente"
});
}

db.prepare(`
UPDATE users
SET balance=
balance-?
WHERE id=?
`)
.run(
amount,
user.id
);

db.prepare(`
INSERT INTO withdrawals
(user_id,amount,pix_key)
VALUES(?,?,?)
`)
.run(
user.id,
amount,
pix_key||""
);

res.json({
success:true
});

}
);

app.listen(
PORT,
()=>{
console.log(
`Servidor em http://localhost:${PORT}`
);
}
);  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  bet REAL NOT NULL,
  won REAL NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
)
`).run();

db.prepare(`
CREATE TABLE IF NOT EXISTS deposits (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  amount REAL NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
)
`).run();

db.prepare(`
CREATE TABLE IF NOT EXISTS withdrawals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  amount REAL NOT NULL,
  pix_key TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
)
`).run();

// ─────────────────────────────────────────
// AUTH
// ─────────────────────────────────────────
function auth(req, res, next) {
  const header = req.headers.authorization;

  if (!header)
    return res.status(401).json({
      error: "Token ausente",
    });

  try {
    const token = header.split(" ")[1];

    req.user = jwt.verify(
      token,
      JWT_SECRET
    );

    next();
  } catch {
    return res.status(401).json({
      error: "Token inválido",
    });
  }
}

// ─────────────────────────────────────────
// CADASTRO
// ─────────────────────────────────────────
app.post("/api/register", async (req, res) => {
  try {
    const {
      name,
      email,
      phone,
      password,
    } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({
        error: "Preencha todos os campos",
      });
    }

    const exists = db
      .prepare(
        "SELECT id FROM users WHERE email=?"
      )
      .get(email);

    if (exists) {
      return res.status(400).json({
        error: "Email já cadastrado",
      });
    }

    const hash =
      await bcrypt.hash(password, 10);

    const result = db
      .prepare(`
      INSERT INTO users
      (name,email,phone,password)
      VALUES (?,?,?,?)
    `)
      .run(
        name,
        email,
        phone || "",
        hash
      );

    const token = jwt.sign(
      {
        id: result.lastInsertRowid,
      },
      JWT_SECRET,
      {
        expiresIn: "7d",
      }
    );

    res.json({
      token,
      name,
      balance: 0,
    });
  } catch {
    res.status(500).json({
      error: "Erro interno",
    });
  }
});

// ─────────────────────────────────────────
// LOGIN
// ─────────────────────────────────────────
app.post("/api/login", async (req, res) => {
  const {
    email,
    password,
  } = req.body;

  const user = db
    .prepare(
      "SELECT * FROM users WHERE email=?"
    )
    .get(email);

  if (!user) {
    return res.status(401).json({
      error: "Credenciais inválidas",
    });
  }

  const ok =
    await bcrypt.compare(
      password,
      user.password
    );

  if (!ok) {
    return res.status(401).json({
      error: "Credenciais inválidas",
    });
  }

  const token = jwt.sign(
    {
      id: user.id,
    },
    JWT_SECRET,
    {
      expiresIn: "7d",
    }
  );

  res.json({
    token,
    name: user.name,
    balance: user.balance,
  });
});

// ─────────────────────────────────────────
// PERFIL
// ─────────────────────────────────────────
app.get("/api/me", auth, (req, res) => {
  const user = db
    .prepare(`
    SELECT
      id,
      name,
      email,
      phone,
      balance
    FROM users
    WHERE id=?
  `)
    .get(req.user.id);

  res.json(user);
});

// ─────────────────────────────────────────
// DEPÓSITO MANUAL
// ─────────────────────────────────────────
app.post(
  "/api/deposit",
  auth,
  (req, res) => {
    const {
      amount,
    } = req.body;

    if (
      !amount ||
      amount <= 0
    ) {
      return res.status(400).json({
        error: "Valor inválido",
      });
    }

    db.prepare(`
      UPDATE users
      SET balance=balance+?
      WHERE id=?
    `).run(
      amount,
      req.user.id
    );

    db.prepare(`
      INSERT INTO deposits
      (user_id,amount)
      VALUES (?,?)
    `).run(
      req.user.id,
      amount
    );

    const user =
      db.prepare(
        "SELECT balance FROM users WHERE id=?"
      )
      .get(req.user.id);

    res.json({
      balance:
        user.balance,
    });
  }
);

// ─────────────────────────────────────────
// SAQUE
// ─────────────────────────────────────────
app.post(
  "/api/withdraw",
  auth,
  (req, res) => {
    const {
      amount,
      pix_key,
    } = req.body;

    const user =
      db.prepare(
        "SELECT * FROM users WHERE id=?"
      )
      .get(req.user.id);

    if (
      !amount ||
      amount <= 0
    ) {
      return res.status(400).json({
        error: "Valor inválido",
      });
    }

    if (
      user.balance <
      amount
    ) {
      return res.status(400).json({
        error: "Saldo insuficiente",
      });
    }

    db.prepare(`
      UPDATE users
      SET balance=balance-?
      WHERE id=?
    `).run(
      amount,
      user.id
    );

    db.prepare(`
      INSERT INTO withdrawals
      (user_id,amount,pix_key)
      VALUES (?,?,?)
    `).run(
      user.id,
      amount,
      pix_key || ""
    );

    res.json({
      success: true,
    });
  }
);

// ─────────────────────────────────────────
// HISTÓRICO
// ─────────────────────────────────────────
app.get(
  "/api/games",
  auth,
  (req, res) => {
    const data =
      db.prepare(`
      SELECT *
      FROM games
      WHERE user_id=?
      ORDER BY id DESC
    `).all(
        req.user.id
      );

    res.json(data);
  }
);

// ─────────────────────────────────────────
// START
// ─────────────────────────────────────────
app.listen(PORT, () => {
  console.log(
    `Servidor rodando em http://localhost:${PORT}`
  );
});  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  bet REAL NOT NULL,
  won REAL NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
)
`).run();

db.prepare(`
CREATE TABLE IF NOT EXISTS deposits (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  amount REAL NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
)
`).run();

db.prepare(`
CREATE TABLE IF NOT EXISTS withdrawals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  amount REAL NOT NULL,
  pix_key TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
)
`).run();

// ─────────────────────────────────────────
// AUTH
// ─────────────────────────────────────────
function auth(req, res, next) {
  const header = req.headers.authorization;

  if (!header)
    return res.status(401).json({
      error: "Token ausente",
    });

  try {
    const token = header.split(" ")[1];

    req.user = jwt.verify(
      token,
      JWT_SECRET
    );

    next();
  } catch {
    return res.status(401).json({
      error: "Token inválido",
    });
  }
}

// ─────────────────────────────────────────
// CADASTRO
// ─────────────────────────────────────────
app.post("/api/register", async (req, res) => {
  try {
    const {
      name,
      email,
      phone,
      password,
    } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({
        error: "Preencha todos os campos",
      });
    }

    const exists = db
      .prepare(
        "SELECT id FROM users WHERE email=?"
      )
      .get(email);

    if (exists) {
      return res.status(400).json({
        error: "Email já cadastrado",
      });
    }

    const hash =
      await bcrypt.hash(password, 10);

    const result = db
      .prepare(`
      INSERT INTO users
      (name,email,phone,password)
      VALUES (?,?,?,?)
    `)
      .run(
        name,
        email,
        phone || "",
        hash
      );

    const token = jwt.sign(
      {
        id: result.lastInsertRowid,
      },
      JWT_SECRET,
      {
        expiresIn: "7d",
      }
    );

    res.json({
      token,
      name,
      balance: 0,
    });
  } catch {
    res.status(500).json({
      error: "Erro interno",
    });
  }
});

// ─────────────────────────────────────────
// LOGIN
// ─────────────────────────────────────────
app.post("/api/login", async (req, res) => {
  const {
    email,
    password,
  } = req.body;

  const user = db
    .prepare(
      "SELECT * FROM users WHERE email=?"
    )
    .get(email);

  if (!user) {
    return res.status(401).json({
      error: "Credenciais inválidas",
    });
  }

  const ok =
    await bcrypt.compare(
      password,
      user.password
    );

  if (!ok) {
    return res.status(401).json({
      error: "Credenciais inválidas",
    });
  }

  const token = jwt.sign(
    {
      id: user.id,
    },
    JWT_SECRET,
    {
      expiresIn: "7d",
    }
  );

  res.json({
    token,
    name: user.name,
    balance: user.balance,
  });
});

// ─────────────────────────────────────────
// PERFIL
// ─────────────────────────────────────────
app.get("/api/me", auth, (req, res) => {
  const user = db
    .prepare(`
    SELECT
      id,
      name,
      email,
      phone,
      balance
    FROM users
    WHERE id=?
  `)
    .get(req.user.id);

  res.json(user);
});

// ─────────────────────────────────────────
// DEPÓSITO MANUAL
// ─────────────────────────────────────────
app.post(
  "/api/deposit",
  auth,
  (req, res) => {
    const {
      amount,
    } = req.body;

    if (
      !amount ||
      amount <= 0
    ) {
      return res.status(400).json({
        error: "Valor inválido",
      });
    }

    db.prepare(`
      UPDATE users
      SET balance=balance+?
      WHERE id=?
    `).run(
      amount,
      req.user.id
    );

    db.prepare(`
      INSERT INTO deposits
      (user_id,amount)
      VALUES (?,?)
    `).run(
      req.user.id,
      amount
    );

    const user =
      db.prepare(
        "SELECT balance FROM users WHERE id=?"
      )
      .get(req.user.id);

    res.json({
      balance:
        user.balance,
    });
  }
);

// ─────────────────────────────────────────
// SAQUE
// ─────────────────────────────────────────
app.post(
  "/api/withdraw",
  auth,
  (req, res) => {
    const {
      amount,
      pix_key,
    } = req.body;

    const user =
      db.prepare(
        "SELECT * FROM users WHERE id=?"
      )
      .get(req.user.id);

    if (
      !amount ||
      amount <= 0
    ) {
      return res.status(400).json({
        error: "Valor inválido",
      });
    }

    if (
      user.balance <
      amount
    ) {
      return res.status(400).json({
        error: "Saldo insuficiente",
      });
    }

    db.prepare(`
      UPDATE users
      SET balance=balance-?
      WHERE id=?
    `).run(
      amount,
      user.id
    );

    db.prepare(`
      INSERT INTO withdrawals
      (user_id,amount,pix_key)
      VALUES (?,?,?)
    `).run(
      user.id,
      amount,
      pix_key || ""
    );

    res.json({
      success: true,
    });
  }
);

// ─────────────────────────────────────────
// HISTÓRICO
// ─────────────────────────────────────────
app.get(
  "/api/games",
  auth,
  (req, res) => {
    const data =
      db.prepare(`
      SELECT *
      FROM games
      WHERE user_id=?
      ORDER BY id DESC
    `).all(
        req.user.id
      );

    res.json(data);
  }
);

// ─────────────────────────────────────────
// START
// ─────────────────────────────────────────
app.listen(PORT, () => {
  console.log(
    `Servidor rodando em http://localhost:${PORT}`
  );
});    name       TEXT NOT NULL,
    email      TEXT UNIQUE NOT NULL,
    phone      TEXT,
    cpf        TEXT,
    password   TEXT NOT NULL,
    balance    REAL DEFAULT 0,
    asaas_id   TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS games (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id    INTEGER NOT NULL,
    bet        REAL NOT NULL,
    won        REAL NOT NULL,
    created_at TEXT DEFAULT (datetime('now'))
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS deposits (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id    INTEGER NOT NULL,
    amount     REAL NOT NULL,
    asaas_id   TEXT,
    pix_code   TEXT,
    pix_qr     TEXT,
    status     TEXT DEFAULT 'pending',
    created_at TEXT DEFAULT (datetime('now'))
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS withdrawals (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id    INTEGER NOT NULL,
    amount     REAL NOT NULL,
    pix_key    TEXT NOT NULL,
    pix_type   TEXT,
    pix_name   TEXT,
    pix_cpf    TEXT,
    asaas_id   TEXT,
    status     TEXT DEFAULT 'pending',
    created_at TEXT DEFAULT (datetime('now'))
  )`);
});

// ─── HELPERS ──────────────────────────────────────
function dbGet(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => err ? reject(err) : resolve(row));
  });
}
function dbRun(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
      err ? reject(err) : resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
}
function dbAll(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => err ? reject(err) : resolve(rows));
  });
}

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

// ─── HELPER ASAAS CUSTOMER ────────────────────────
async function getOrCreateAsaasCustomer(user) {
  if (user.asaas_id) return user.asaas_id;
  const resp = await asaas.post('/customers', {
    name: user.name,
    email: user.email,
    mobilePhone: user.phone || '',
    cpfCnpj: user.cpf || '',
  });
  const asaasId = resp.data.id;
  await dbRun('UPDATE users SET asaas_id = ? WHERE id = ?', [asaasId, user.id]);
  return asaasId;
}

// ════════════════════════════════════════════════════
// AUTH
// ════════════════════════════════════════════════════

app.post('/api/register', async (req, res) => {
  const { name, email, phone, cpf, password } = req.body;
  if (!name || !email || !password)
    return res.status(400).json({ error: 'Preencha todos os campos' });
  try {
    const hash = bcrypt.hashSync(password, 10);
    const info = await dbRun(
      'INSERT INTO users (name, email, phone, cpf, password) VALUES (?, ?, ?, ?, ?)',
      [name, email, phone || '', cpf || '', hash]
    );
    const token = jwt.sign({ id: info.lastID, email }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, name, balance: 0 });
  } catch (e) {
    if (e.message.includes('UNIQUE'))
      return res.status(400).json({ error: 'E-mail já cadastrado' });
    res.status(500).json({ error: 'Erro interno' });
  }
});

app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;
  const user = await dbGet('SELECT * FROM users WHERE email = ?', [email]);
  if (!user || !bcrypt.compareSync(password, user.password))
    return res.status(401).json({ error: 'E-mail ou senha incorretos' });
  const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: '7d' });
  res.json({ token, name: user.name, balance: user.balance });
});

// ════════════════════════════════════════════════════
// USUÁRIO
// ════════════════════════════════════════════════════

app.get('/api/me', auth, async (req, res) => {
  const user = await dbGet('SELECT id, name, email, phone, cpf, balance FROM users WHERE id = ?', [req.user.id]);
  if (!user) return res.status(404).json({ error: 'Não encontrado' });
  res.json(user);
});

app.get('/api/games', auth, async (req, res) => {
  const games = await dbAll('SELECT * FROM games WHERE user_id = ? ORDER BY created_at DESC LIMIT 50', [req.user.id]);
  res.json(games);
});

// ════════════════════════════════════════════════════
// JOGO
// ════════════════════════════════════════════════════

app.post('/api/game/result', auth, async (req, res) => {
  const { bet, won } = req.body;
  if (!bet || bet <= 0) return res.status(400).json({ error: 'Aposta inválida' });
  const user = await dbGet('SELECT * FROM users WHERE id = ?', [req.user.id]);
  if (!user) return res.status(404).json({ error: 'Usuário não encontrado' });
  if (user.balance < bet) return res.status(400).json({ error: 'Saldo insuficiente' });
  const newBalance = user.balance + won;
  await dbRun('UPDATE users SET balance = ? WHERE id = ?', [newBalance, user.id]);
  await dbRun('INSERT INTO games (user_id, bet, won) VALUES (?, ?, ?)', [user.id, bet, won]);
  res.json({ balance: newBalance, won });
});

// ════════════════════════════════════════════════════
// DEPÓSITO PIX
// ════════════════════════════════════════════════════

app.post('/api/deposit', auth, async (req, res) => {
  const { amount } = req.body;
  if (!amount || amount < 5) return res.status(400).json({ error: 'Valor mínimo R$5,00' });
  const user = await dbGet('SELECT * FROM users WHERE id = ?', [req.user.id]);
  try {
    const customerId = await getOrCreateAsaasCustomer(user);
    const charge = await asaas.post('/payments', {
      customer: customerId,
      billingType: 'PIX',
      value: Number(amount),
      dueDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      description: 'Depósito HelixWin',
    });
    const chargeId = charge.data.id;
    const qrResp = await asaas.get(`/payments/${chargeId}/pixQrCode`);
    const pixCode = qrResp.data.payload;
    const pixQR   = qrResp.data.encodedImage;
    await dbRun(
      'INSERT INTO deposits (user_id, amount, asaas_id, pix_code, pix_qr) VALUES (?, ?, ?, ?, ?)',
      [user.id, amount, chargeId, pixCode, pixQR]
    );
    res.json({ asaas_id: chargeId, pix_code: pixCode, pix_qr: pixQR });
  } catch (e) {
    console.error('Erro depósito:', e.response?.data || e.message);
    res.status(500).json({ error: 'Erro ao gerar PIX' });
  }
});

app.post('/api/webhook/asaas', async (req, res) => {
  const { event, payment } = req.body;
  if (event === 'PAYMENT_RECEIVED' || event === 'PAYMENT_CONFIRMED') {
    const dep = await dbGet('SELECT * FROM deposits WHERE asaas_id = ?', [payment.id]);
    if (dep && dep.status !== 'approved') {
      await dbRun('UPDATE deposits SET status = ? WHERE id = ?', ['approved', dep.id]);
      await dbRun('UPDATE users SET balance = balance + ? WHERE id = ?', [dep.amount, dep.user_id]);
      console.log(`✅ Depósito aprovado: user ${dep.user_id} | R$${dep.amount}`);
    }
  }
  res.sendStatus(200);
});

// ════════════════════════════════════════════════════
// SAQUE PIX (sem exigência de depósito)
// ════════════════════════════════════════════════════

app.post('/api/withdraw', auth, async (req, res) => {
  const { amount, pix_key, pix_type, pix_name, pix_cpf } = req.body;
  if (!amount || amount <= 0) return res.status(400).json({ error: 'Valor inválido' });
  if (!pix_key)  return res.status(400).json({ error: 'Informe a chave PIX' });
  if (!pix_type) return res.status(400).json({ error: 'Informe o tipo da chave' });

  const user = await dbGet('SELECT * FROM users WHERE id = ?', [req.user.id]);
  if (!user) return res.status(404).json({ error: 'Usuário não encontrado' });
  if (user.balance < amount) return res.status(400).json({ error: 'Saldo insuficiente' });

  await dbRun('UPDATE users SET balance = balance - ? WHERE id = ?', [amount, user.id]);

  try {
    const transfer = await asaas.post('/transfers', {
      value: Number(amount),
      pixAddressKey: pix_key,
      pixAddressKeyType: pix_type,
      description: 'Saque HelixWin',
    });
    const asaasId = transfer.data.id;
    const status  = transfer.data.status === 'DONE' ? 'paid' : 'pending';
    await dbRun(
      'INSERT INTO withdrawals (user_id, amount, pix_key, pix_type, pix_name, pix_cpf, asaas_id, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [user.id, amount, pix_key, pix_type, pix_name || user.name, pix_cpf || '', asaasId, status]
    );
    const updated = await dbGet('SELECT balance FROM users WHERE id = ?', [user.id]);
    res.json({ message: 'PIX enviado!', balance: updated.balance, status });
  } catch (e) {
    await dbRun('UPDATE users SET balance = balance + ? WHERE id = ?', [amount, user.id]);
    console.error('Erro saque:', e.response?.data || e.message);
    res.status(500).json({ error: 'Erro ao processar saque' });
  }
});

// ─── START ────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`🌀 Helix777 rodando na porta ${PORT}`);
  console.log(`💳 Asaas: ${ASAAS_URL}`);
});
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

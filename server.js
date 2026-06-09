const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Banco de dados SQLite
const db = new sqlite3.Database('./roleta.db');

// Criar tabelas
db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS usuarios (
        id TEXT PRIMARY KEY,
        username TEXT UNIQUE,
        email TEXT UNIQUE,
        password TEXT,
        saldo REAL DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);
    
    db.run(`CREATE TABLE IF NOT EXISTS transacoes (
        id TEXT PRIMARY KEY,
        usuario_id TEXT,
        tipo TEXT,
        valor REAL,
        status TEXT,
        pix_key TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(usuario_id) REFERENCES usuarios(id)
    )`);
    
    db.run(`CREATE TABLE IF NOT EXISTS apostas (
        id TEXT PRIMARY KEY,
        usuario_id TEXT,
        tipo TEXT,
        valor REAL,
        escolha TEXT,
        resultado TEXT,
        premio REAL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(usuario_id) REFERENCES usuarios(id)
    )`);
});

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ==================== ROTAS DA API ====================

// Registro
app.post('/api/register', async (req, res) => {
    const { username, email, password } = req.body;
    
    const id = uuidv4();
    const hashedPassword = await bcrypt.hash(password, 10);
    
    db.run(`INSERT INTO usuarios (id, username, email, password) VALUES (?, ?, ?, ?)`,
        [id, username, email, hashedPassword],
        (err) => {
            if (err) {
                return res.json({ success: false, message: 'UsuÃ¡rio ou email jÃ¡ existe' });
            }
            res.json({ success: true, user: { id, username, email, saldo: 0 } });
        });
});

// Login
app.post('/api/login', async (req, res) => {
    const { login, password } = req.body;
    
    db.get(`SELECT * FROM usuarios WHERE username = ? OR email = ?`,
        [login, login],
        async (err, user) => {
            if (!user) {
                return res.json({ success: false, message: 'UsuÃ¡rio nÃ£o encontrado' });
            }
            
            const valid = await bcrypt.compare(password, user.password);
            if (!valid) {
                return res.json({ success: false, message: 'Senha incorreta' });
            }
            
            res.json({ 
                success: true, 
                user: { 
                    id: user.id, 
                    username: user.username, 
                    email: user.email, 
                    saldo: user.saldo 
                } 
            });
        });
});

// Get usuÃ¡rio
app.get('/api/user/:id', (req, res) => {
    db.get(`SELECT id, username, email, saldo FROM usuarios WHERE id = ?`,
        [req.params.id],
        (err, user) => {
            if (!user) {
                return res.json({ success: false });
            }
            res.json({ success: true, user });
        });
});

// DepÃ³sito (PIX simulaÃ§Ã£o)
app.post('/api/deposito', (req, res) => {
    const { usuario_id, valor, pix_key } = req.body;
    
    if (valor < 2) {
        return res.json({ success: false, message: 'DepÃ³sito mÃ­nimo de R$2,00' });
    }
    
    const transacao_id = uuidv4();
    
    // Simular processamento
    setTimeout(() => {
        db.run(`INSERT INTO transacoes (id, usuario_id, tipo, valor, status, pix_key) 
                VALUES (?, ?, 'deposito', ?, 'aprovado', ?)`,
            [transacao_id, usuario_id, valor, pix_key],
            (err) => {
                if (err) {
                    return res.json({ success: false, message: 'Erro no depÃ³sito' });
                }
                
                db.run(`UPDATE usuarios SET saldo = saldo + ? WHERE id = ?`,
                    [valor, usuario_id]);
                
                res.json({ success: true, message: 'DepÃ³sito aprovado!', transaction_id: transacao_id });
            }, 1000);
    } catch(err) {
        res.json({ success: false, message: 'Erro' });
    }
});

// Saque
app.post('/api/saque', (req, res) => {
    const { usuario_id, valor, pix_key } = req.body;
    
    db.get(`SELECT saldo FROM usuarios WHERE id = ?`, [usuario_id], (err, user) => {
        if (user.saldo < valor) {
            return res.json({ success: false, message: 'Saldo insuficiente' });
        }
        
        const transacao_id = uuidv4();
        
        db.run(`INSERT INTO transacoes (id, usuario_id, tipo, valor, status, pix_key) 
                VALUES (?, ?, 'saque', ?, 'pendente', ?)`,
            [transacao_id, usuario_id, valor, pix_key],
            (err) => {
                db.run(`UPDATE usuarios SET saldo = saldo - ? WHERE id = ?`, [valor, usuario_id]);
                res.json({ success: true, message: 'Saque solicitado!', transaction_id: transacao_id });
            });
    });
});

// HistÃ³rico de transaÃ§Ãµes
app.get('/api/transacoes/:usuario_id', (req, res) => {
    db.all(`SELECT * FROM transacoes WHERE usuario_id = ? ORDER BY created_at DESC LIMIT 50`,
        [req.params.usuario_id],
        (err, transacoes) => {
            res.json({ success: true, transacoes });
        });
});

// ==================== ROLETA ====================

// NÃºmeros da roleta europea
const roletaNumeros = [
    0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 11, 30, 8, 23, 10, 
    5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26
];

const cores = {
    1: 'vermelho', 2: 'preto', 3: 'vermelho', 4: 'preto', 5: 'vermelho', 6: 'preto',
    7: 'vermelho', 8: 'preto', 9: 'vermelho', 10: 'preto', 11: 'preto', 12: 'vermelho',
    13: 'preto', 14: 'vermelho', 15: 'vermelho', 16: 'preto', 17: 'preto', 18: 'vermelho',
    19: 'vermelho', 20: 'preto', 21: 'vermelho', 22: 'preto', 23: 'vermelho', 24: 'preto',
    25: 'vermelho', 26: 'preto', 27: 'vermelho', 28: 'preto', 29: 'preto', 30: 'vermelho',
    31: 'preto', 32: 'vermelho', 33: 'preto', 34: 'vermelho', 35: 'preto', 36: 'vermelho'
};

// Girar roleta
function girarRoleta() {
    const indice = Math.floor(Math.random() * 37);
    const numero = roletaNumeros[indice];
    const cor = numero === 0 ? 'verde' : cores[numero];
    return { numero, cor };
}

// fazer aposta
app.post('/api/apostar', (req, res) => {
    const { usuario_id, tipo, valor, escolha } = req.body;
    
    // tipos: 'numero' (35x), 'cor' (2x), 'par' (2x), 'impar' (2x), 'maior' (2x), 'menor' (2x)
    
    db.get(`SELECT saldo FROM usuarios WHERE id = ?`, [usuario_id], (err, user) => {
        if (!user || user.saldo < valor) {
            return res.json({ success: false, message: 'Saldo insuficiente' });
        }
        
        const resultado = girarRoleta();
        let premio = 0;
        let apostouGanhou = false;
        
        switch (tipo) {
            case 'numero':
                if (resultado.numero == escolha) {
                    premio = valor * 35;
                    apostouGanhou = true;
                }
                break;
            case 'cor':
                if (resultado.cor == escolha) {
                    premio = valor * 2;
                    apostouGanhou = true;
                }
                break;
            case 'par':
                if (resultado.numero !== 0 && resultado.numero % 2 === 0) {
                    premio = valor * 2;
                    apostouGanhou = true;
                }
                break;
            case 'impar':
                if (resultado.numero !== 0 && resultado.numero % 2 !== 0) {
                    premio = valor * 2;
                    apostouGanhou = true;
                }
                break;
            case 'maior':
                if (resultado.numero >= 19 && resultado.numero !== 0) {
                    premio = valor * 2;
                    apostouGanhou = true;
                }
                break;
            case 'menor':
                if (resultado.numero <= 18 && resultado.numero !== 0) {
                    premio = valor * 2;
                    apostouGanhou = true;
                }
                break;
        }
        
        const novoSaldo = user.saldo - valor + premio;
        const lucro = premio - valor;
        
        db.run(`UPDATE usuarios SET saldo = ? WHERE id = ?`, [novoSaldo, usuario_id]);
        
        const aposta_id = uuidv4();
        db.run(`INSERT INTO apostas (id, usuario_id, tipo, valor, escolha, resultado, premio) 
                VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [aposta_id, usuario_id, tipo, valor, escolha, resultado.numero + ' (' + resultado.cor + ')', premio]);
        
        res.json({ 
            success: true, 
            resultado,
            premio,
            novoSaldo,
            lucro,
            ganhou: apostouGanhou
        });
    });
});

// HistÃ³rico de apostas
app.get('/api/apostas/:usuario_id', (req, res) => {
    db.all(`SELECT * FROM apostas WHERE usuario_id = ? ORDER BY created_at DESC LIMIT 20`,
        [req.params.usuario_id],
        (err, apostas) => {
            res.json({ success: true, apostas });
        });
});

// EstatÃ­sticas da roleta
app.get('/api/estatisticas', (req, res) => {
    db.all(`SELECT resultado, COUNT(*) as total FROM apostas GROUP BY resultado ORDER BY total DESC LIMIT 10`,
        (err, stats) => {
            res.json({ success: true, stats });
        });
});

// WebSocket para roleta ao vivo
wss.on('connection', (ws) => {
    ws.on('message', (message) => {
        const data = JSON.parse(message);
        
        if (data.type === 'girar') {
            const resultado = girarRoleta();
            // Enviar para todos
            wss.clients.forEach(client => {
                if (client.readyState === WebSocket.OPEN) {
                    client.send(JSON.stringify({ type: 'resultado', resultado }));
                }
            });
        }
    });
});

// Iniciar servidor
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
});

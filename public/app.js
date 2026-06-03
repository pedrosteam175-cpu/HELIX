const express = require('express');
const app = express();

// Defina a porta onde o servidor vai rodar
const PORT = 3000;

// Middleware essencial para o servidor entender requisições em formato JSON
app.use(express.json());

// 1. Rota Principal (Home)
app.get('/', (req, res) => {
    res.send('Servidor Node.js rodando com sucesso! 🚀');
});

// 2. Rota de Exemplo: Listar dados (GET)
app.get('/api/usuarios', (req, res) => {
    const usuarios = [
        { id: 1, nome: 'Ana Silva', papel: 'Admin' },
        { id: 2, nome: 'Lucas Souza', papel: 'Dev' }
    ];
    res.json(usuarios);
});

// 3. Rota de Exemplo: Receber dados (POST)
app.post('/api/usuarios', (req, res) => {
    const novoUsuario = req.body;
    
    // Aqui você salvaria no banco de dados. Vamos apenas simular o retorno:
    res.status(201).json({
        mensagem: 'Usuário criado com sucesso!',
        dados: novoUsuario
    });
});

// Inicializa o servidor na porta especificada
app.listen(PORT, () => {
    console.log(`=========================================`);
    console.log(` Servidor ativo em: http://localhost:${PORT} `);
    console.log(`=========================================`);
});
      

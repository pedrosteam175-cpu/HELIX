# 🌀 Helix777 — Servidor Node.js + Mercado Pago

## 📋 O que você precisa

- Um VPS com Ubuntu (Hostinger, DigitalOcean, Contabo)
- Node.js instalado
- Conta no Mercado Pago com Access Token

---

## 🚀 Passo a passo para subir o servidor

### 1. Instalar Node.js no seu VPS

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
```

### 2. Copiar os arquivos para o VPS

Envie os arquivos via FTP ou Git. Estrutura:
```
servidor-helix/
├── server.js
├── package.json
├── .env
└── public/
    └── helix777.html   ← coloque o site aqui
```

### 3. Instalar dependências

```bash
cd servidor-helix
npm install
```

### 4. Configurar variáveis de ambiente

```bash
cp .env.example .env
nano .env
```

Preencha:
```
JWT_SECRET=qualquer_texto_longo_e_secreto
MP_TOKEN=APP_USR-SEU_TOKEN_DO_MERCADOPAGO
PORT=3000
```

### 5. Pegar o Access Token do Mercado Pago

1. Acesse https://www.mercadopago.com.br/developers
2. Vá em **Suas Aplicações → Criar aplicação**
3. Copie o **Access Token de Produção**
4. Cole no `.env` no campo `MP_TOKEN`

### 6. Iniciar o servidor

```bash
node server.js
```

Ou para rodar em segundo plano (não para se fechar o terminal):
```bash
npm install -g pm2
pm2 start server.js --name helix777
pm2 save
pm2 startup
```

---

## 🔗 Configurar o Webhook do Mercado Pago

Para o servidor receber confirmação de pagamento automático:

1. No painel do MP → **Webhooks**
2. Adicione a URL: `https://SEU_DOMINIO.com/api/webhook/mp`
3. Evento: `payment`

---

## 🌐 Apontar domínio (opcional)

Instale o Nginx como proxy:
```bash
sudo apt install nginx
sudo nano /etc/nginx/sites-available/helix
```

Cole:
```nginx
server {
    listen 80;
    server_name SEU_DOMINIO.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
    }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/helix /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

Para SSL (HTTPS) gratuito:
```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d SEU_DOMINIO.com
```

---

## 📡 Rotas da API

| Método | Rota | Descrição |
|--------|------|-----------|
| POST | /api/register | Criar conta |
| POST | /api/login | Fazer login |
| GET  | /api/me | Ver saldo e perfil |
| GET  | /api/games | Histórico de partidas |
| POST | /api/game/result | Registrar resultado |
| POST | /api/deposit | Gerar PIX de depósito |
| POST | /api/withdraw | Solicitar saque |
| POST | /api/webhook/mp | Webhook Mercado Pago |

---

## ⚠️ Saque automático

O saque está configurado como **manual por padrão** (você aprova no banco de dados).  
Para ativar envio automático via MP, descomente o bloco indicado no `server.js`.  
Isso requer conta Mercado Pago com permissão de transferência habilitada.

// routes/auth.js (CÓDIGO COMPLETO E CORRIGIDO)

const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

// Importa as funções de acesso a dados do módulo central
const { getUsers, saveUsers } = require('../database'); 

const JWT_SECRET = "super_secreto_json_key"; 

// --- Configuração de Hashing (scrypt) ---
const HASH_CONFIG = {
    keylen: 64, 
    saltlen: 16, 
    N: 16384, 
    r: 8, 
    p: 1, 
    digest: 'sha512' 
};

// Função auxiliar para HASH
const hashPassword = (password) => {
    return new Promise((resolve, reject) => {
        const salt = crypto.randomBytes(HASH_CONFIG.saltlen).toString('hex');
        crypto.scrypt(password, salt, HASH_CONFIG.keylen, HASH_CONFIG, (err, derivedKey) => {
            if (err) return reject(err);
            const hashedPassword = `${salt}.${derivedKey.toString('hex')}`;
            resolve(hashedPassword);
        });
    });
};

// Função auxiliar para VERIFICAR
const verifyPassword = (password, hashedPassword) => {
    return new Promise((resolve, reject) => {
        const [salt, key] = hashedPassword.split('.');
        crypto.scrypt(password, salt, HASH_CONFIG.keylen, HASH_CONFIG, (err, derivedKey) => {
            if (err) return reject(err);
            resolve(derivedKey.toString('hex') === key);
        });
    });
};


// 🚨 MIDDLEWARE: Exige Autenticação
const requireAuth = (req, res, next) => {
    const token = req.cookies.jwt; 

    if (!token) {
        return res.redirect('/auth/login?error=Acesso%20Restrito');
    }

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = decoded; 
        next();
    } catch (err) {
        res.clearCookie('jwt'); 
        return res.redirect('/auth/login?error=Sessão%20expirada.%20Faça%20login%20novamente.');
    }
};

// 🚨 MIDDLEWARE: Exige Permissão de Admin
const requireAdmin = (req, res, next) => {
    if (!req.user || req.user.role !== 'admin') {
        return res.status(403).send('Acesso negado: Apenas para administradores.');
    }
    next();
};

// --- ROTAS ---

// Rota GET /auth/login (CORRIGIDA)
router.get('/login', (req, res) => {
    const error = req.query.error || null;
    const success = req.query.success || null; // 💡 CORREÇÃO AQUI: Garante que 'success' está sempre definido
    res.render('auth/login', { title: 'Login', error, success });
});

// Rota POST /auth/login
router.post('/login', async (req, res) => {
    const { username, password } = req.body;
    
    const users = getUsers();
    const user = users.find(u => u.username === username);

    if (!user) {
        // 💡 GARANTIA DE VARIÁVEIS AQUI: Sempre passa success: null
        return res.render('auth/login', { title: 'Login', error: 'Nome de usuário ou senha incorretos.', success: null });
    }

    // 1. Verifica a aprovação do Admin
    if (user.role === 'student' && !user.approved) {
         // 💡 GARANTIA DE VARIÁVEIS AQUI: Sempre passa success: null
        return res.render('auth/login', { title: 'Login', error: 'Sua conta está pendente de aprovação do administrador.', success: null });
    }
    
    // 2. Verifica a Senha (Assíncrona)
    let isMatch = false;
    try {
        isMatch = await verifyPassword(password, user.password);
    } catch (e) {
        console.error("Erro ao verificar senha:", e);
         // 💡 GARANTIA DE VARIÁVEIS AQUI: Sempre passa success: null
        return res.render('auth/login', { title: 'Login', error: 'Erro interno de autenticação.', success: null });
    }

    if (!isMatch) {
         // 💡 GARANTIA DE VARIÁVEIS AQUI: Sempre passa success: null
        return res.render('auth/login', { title: 'Login', error: 'Nome de usuário ou senha incorretos.', success: null });
    }

    // 3. Criação do Token JWT
    const token = jwt.sign(
        { id: user.id, username: user.username, role: user.role },
        JWT_SECRET,
        { expiresIn: '24h' } 
    );

    // 4. Configura o Cookie
    res.cookie('jwt', token, { 
        httpOnly: true, 
        secure: process.env.NODE_ENV === 'production', 
        maxAge: 24 * 60 * 60 * 1000 
    });

    if (user.role === 'admin') {
        res.redirect('/admin');
    } else {
        res.redirect('/lessons');
    }
});


// Rota GET /auth/register
router.get('/register', (req, res) => {
    res.render('auth/register', { title: 'Cadastro', error: null });
});


// Rota POST /auth/register
router.post('/register', async (req, res) => {
    const { username, password, password_confirm } = req.body;
    
    if (!username || !password || !password_confirm) {
        return res.render('auth/register', { title: 'Cadastro', error: 'Preencha todos os campos.' });
    }

    if (password !== password_confirm) {
        return res.render('auth/register', { title: 'Cadastro', error: 'As senhas não coincidem.' });
    }
    
    const users = getUsers();
    
    if (users.find(u => u.username === username)) {
        return res.render('auth/register', { title: 'Cadastro', error: 'Nome de usuário já existe.' });
    }

    let hashedPassword;
    try {
        hashedPassword = await hashPassword(password);
    } catch (e) {
        console.error("Erro ao gerar hash da senha:", e);
        return res.render('auth/register', { title: 'Cadastro', error: 'Erro interno ao processar a senha.' });
    }

    const newId = users.length > 0 ? Math.max(...users.map(u => u.id)) + 1 : 1; 
    
    const newUser = {
        id: newId,
        username: username,
        password: hashedPassword, 
        role: "student",
        approved: false 
    };
    
    users.push(newUser);
    saveUsers(users);

    // Redireciona para o login com mensagem de sucesso
    res.redirect('/auth/login?success=true');
});


// Rota GET /auth/logout
router.get('/logout', (req, res) => {
    res.clearCookie('jwt'); 
    res.redirect('/');
});


module.exports = { router, requireAuth, requireAdmin };


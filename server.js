// server.js (CÓDIGO COMPLETO E CORRIGIDO)
require('dotenv').config();
const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
const expressLayouts = require('express-ejs-layouts');
const session = require('express-session');
const jwt = require('jsonwebtoken'); // 🚨 NOVO: Importa JWT

const app = express();
const PORT = process.env.PORT || 3000;            

// Importa rotas E middlewares usando DESESTRUTURAÇÃO para CLAREZA:
const { 
    router: authRouter, 
    requireAuth, 
    requireAdmin 
} = require('./routes/auth'); 

// Desestrutura todos os routers para uso consistente:
const { router: adminRouter } = require('./routes/admin');
const { router: lessonRouter } = require('./routes/lessons'); 
const { router: commentRouter } = require('./routes/comments'); 
                                                                                                   
// Configuração EJS e Layouts
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(expressLayouts);                          

// Middlewares
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Configuração da Sessão (Pode ser mantida, mas não será usada para autenticação)
app.use(session({
    // IMPORTANTE: Use uma string secreta longa e forte!
    secret: 'SEGREDO_SUPER_SEGURO_PARA_O_KIMBUNDU_SITE', 
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 24 * 60 * 60 * 1000 } // Sessão dura 24 horas
}));

app.use(cookieParser());                          

// Servir arquivos estáticos (CSS, JS, etc.)
app.use(express.static(path.join(__dirname, 'public')));

// Servir arquivos de mídia
app.use('/media', express.static(path.join(__dirname, 'media')));


// 🚨 MIDDLEWARE GLOBAL: Decodifica o JWT e popula 'res.locals.user' para todas as views.
const JWT_SECRET = "super_secreto_json_key"; 

app.use((req, res, next) => {
    const token = req.cookies.jwt;
    
    // 1. Define um title padrão (mantido do seu upload)
    res.locals.title = 'Kimbundu Milongi';
    
    // 2. Garante que 'user' está disponível em todas as views (seja null ou o objeto)
    res.locals.user = null; 
    
    if (token) {
        try {
            const decoded = jwt.verify(token, JWT_SECRET);
            // Expõe o usuário (id, username, role) para todas as views:
            res.locals.user = decoded; 
        } catch (err) {
            // Se o token for inválido/expirado, limpa o cookie.
            res.clearCookie('jwt');
        }
    }
    
    next();
});


// --- Rotas ---
app.use('/auth', authRouter); 

// Usando os middlewares e routers desestruturados
app.use('/admin', requireAuth, requireAdmin, adminRouter); 

// Usando o router de lessons desestruturado
app.use('/lessons', requireAuth, lessonRouter);

// Usando o router de comments desestruturado
app.use('/comments', commentRouter);


// Rota Inicial
app.get('/', (req, res) => {
    res.render('home', { title: 'Página Inicial' });
});

// Inicia o Servidor
app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}. Acesse http://localhost:${PORT}`);
});


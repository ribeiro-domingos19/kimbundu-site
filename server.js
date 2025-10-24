// ===========================================
// NOVO CÓDIGO PARA server.js (CORRIGIDO PARA SEGURANÇA)
// ===========================================
require('dotenv').config();
const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
const expressLayouts = require('express-ejs-layouts');
const session = require('express-session');
const jwt = require('jsonwebtoken'); 

const app = express();
const PORT = process.env.PORT || 3000;            

// 🚨 NOVO: CARREGA CHAVES SECRETAS DE VARIÁVEIS DE AMBIENTE
const JWT_SECRET = process.env.JWT_SECRET; 
const SESSION_SECRET = process.env.SESSION_SECRET;

// VERIFICAÇÃO CRÍTICA: Se as variáveis não estiverem definidas, o app não inicia.
if (!JWT_SECRET || !SESSION_SECRET) {
    console.error("ERRO FATAL DE SEGURANÇA: As variáveis de ambiente JWT_SECRET e SESSION_SECRET DEVEM ser definidas.");
    process.exit(1);
}


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

// Configuração da Sessão (USANDO VARIÁVEL DE AMBIENTE)
app.use(session({
    // 🚨 CORRIGIDO: Usa a variável de ambiente
    secret: SESSION_SECRET, 
    resave: false,
    saveUninitialized: false,
    cookie: { 
        secure: process.env.NODE_ENV === 'production', 
        httpOnly: true, 
        maxAge: 1000 * 60 * 60 * 24 * 7 // 1 semana
    }
}));

app.use(cookieParser());                          

// Servir arquivos estáticos (CSS, JS, etc.)
app.use(express.static(path.join(__dirname, 'public')));

// Servir arquivos de mídia
app.use('/media', express.static(path.join(__dirname, 'media')));


// 🚨 MIDDLEWARE GLOBAL: Decodifica o JWT e popula 'res.locals.user' para todas as views.
// JWT_SECRET agora é carregado de process.env no topo do arquivo

app.use((req, res, next) => {
    const token = req.cookies.jwt;
    
    // 1. Define um title padrão (mantido do seu upload)
    res.locals.title = 'Kimbundu Milongi';
    
    // 2. Garante que 'user' está disponível em todas as views (seja null ou o objeto)
    res.locals.user = null; 
    
    if (token) {
        try {
            const decoded = jwt.verify(token, JWT_SECRET); // 🚨 CORRIGIDO: Usa a variável de ambiente
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


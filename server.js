// ===========================================
// NOVO CÓDIGO PARA server.js
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

// 🚨 CARREGA CHAVES SECRETAS DE VARIÁVEIS DE AMBIENTE (BOA PRÁTICA)
const JWT_SECRET = process.env.JWT_SECRET; 
const SESSION_SECRET = process.env.SESSION_SECRET;

// VERIFICAÇÃO CRÍTICA: Não inicia se os segredos não estiverem definidos
if (!JWT_SECRET || !SESSION_SECRET) {
    console.error("ERRO FATAL DE SEGURANÇA: As variáveis de ambiente JWT_SECRET e SESSION_SECRET DEVEM ser definidas.");
    process.exit(1);
}


// Importa rotas E middlewares (mantido o seu código original)
const { 
    router: authRouter, 
    requireAuth, 
    requireAdmin 
} = require('./routes/auth'); 
// ... (restante das rotas) ...

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
    secret: SESSION_SECRET, // 🚨 AGORA LÊ DE process.env
    resave: false,
    saveUninitialized: false, 
    cookie: { 
        secure: process.env.NODE_ENV === 'production', // Boa prática: use secure em produção
        httpOnly: true, 
        maxAge: 1000 * 60 * 60 * 24 * 7 // 1 semana (ajustado para ser mais longo)
    }
}));
app.use(cookieParser());

// Servir arquivos estáticos (public)
app.use(express.static(path.join(__dirname, 'public')));
app.use('/media', express.static(path.join(__dirname, 'media')));


// 🚨 MIDDLEWARE GLOBAL: Decodifica o JWT (USANDO VARIÁVEL DE AMBIENTE)
app.use((req, res, next) => {
    const token = req.cookies.jwt;
    res.locals.title = 'Kimbundu Milongi';
    res.locals.user = null; 
    
    if (token) {
        try {
            const decoded = jwt.verify(token, JWT_SECRET); // 🚨 AGORA LÊ DE process.env
            res.locals.user = decoded; 
        } catch (err) {
            res.clearCookie('jwt');
        }
    }
    next();
});


// --- Rotas ---
app.use('/auth', authRouter); 
app.use('/admin', requireAuth, requireAdmin, adminRouter); 
app.use('/lessons', requireAuth, lessonRouter);
app.use('/comments', commentRouter);


// Rota Inicial
app.get('/', (req, res) => {
    // Redireciona para as aulas se já estiver logado
    if (res.locals.user) {
        return res.redirect('/lessons');
    }
    res.render('home', { title: 'Página Inicial', messages: null }); // Assume 'home' é a página inicial
});

// Inicia o Servidor
app.listen(PORT, () => {
    console.log(`\nServidor rodando na porta ${PORT}`);
    console.log(`Ambiente: ${process.env.NODE_ENV || 'development'}\n`);
});


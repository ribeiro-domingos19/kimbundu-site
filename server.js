// server.js (CÓDIGO COMPLETO E CORRIGIDO)
import { SpeedInsights } from "@vercel/speed-insights/next"
const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
const expressLayouts = require('express-ejs-layouts');
const session = require('express-session');

const app = express();
const PORT = process.env.PORT || 3000;            

// Importa rotas E middlewares usando DESESTRUTURAÇÃO para CLAREZA:
// De './routes/auth' precisamos de: requireAuth, requireAdmin e o router
const { 
    router: authRouter, 
    requireAuth, 
    requireAdmin 
} = require('./routes/auth'); 

// Desestrutura todos os routers para uso consistente:
const { router: adminRouter } = require('./routes/admin');
const { router: lessonRouter } = require('./routes/lessons'); // 🚨 CORRIGIDO o estilo de importação
const { router: commentRouter } = require('./routes/comments'); // 🚨 CORRIGIDO o estilo de importação
                                                                                                   
// Configuração EJS e Layouts
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(expressLayouts);                          

// Middlewares
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Configuração da Sessão
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


// 🚨 NOVO MIDDLEWARE: Define um title padrão (previne erros futuros)
app.use((req, res, next) => {
    // Se uma rota não definir um 'title', este será o fallback
    res.locals.title = 'Kimbundu Milongi'; 
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
    // title é opcional aqui por causa do middleware, mas mantido por boas práticas
    res.render('home', { title: 'Página Inicial' });
});

// Inicia o Servidor
app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}. Acesse http://localhost:${PORT}`);
});


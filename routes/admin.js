// ===========================================
// routes/admin.js (CÓDIGO COMPLETO E FINAL)
// Inclui todas as Rotas e o 'module.exports' no final.
// ===========================================

const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const multer = require('multer');

// 💡 Importa TODAS as funções ASSÍNCRONAS do Firebase, incluindo as novas de exclusão
const {
    getUsers, approveUser, deleteUser, updateUser, 
    getLessons, saveLessons, getLessonContent, 
    getComments, saveReplyToComment, deleteComment, deleteAllComments, // Funções de Comentários
    getMessages, saveNewMessage, deleteMessage, deleteAllMessages, // Funções de Mensagens
    getSubmissionLogs
} = require('../database');

const { requireAdmin } = require('./auth');
const { parseLessonContent } = require('../utils/parser');

// Configuração do Multer (Armazenamento em Disco)
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const contentDir = path.join(__dirname, '..', 'content');
        if (!fs.existsSync(contentDir)) {
             try {
                fs.mkdirSync(contentDir);
            } catch(e) {
                // Em ambientes como Vercel, isso irá falhar e o erro será capturado abaixo.
                console.warn("Não foi possível criar o diretório de conteúdo localmente. Verifique permissões.");
            }
        }
        cb(null, contentDir);
    },
    filename: (req, file, cb) => {
        const cleanName = file.originalname
            .toLowerCase()
            .replace(/\s+/g, '_');
        cb(null, cleanName);
    }
});

// Configuração de Multer (limites e filtro)
const upload = multer({ 
    storage: storage,
    limits: { fileSize: 1024 * 1024 * 5 }, // Limite de 5MB
    fileFilter: (req, file, cb) => {
        if (file.mimetype === 'text/plain') {
            cb(null, true);
        } else {
            cb(new Error('O arquivo deve ser do tipo .txt.'), false);
        }
    }
});

// Middleware que encapsula e trata os erros de upload
const uploadMiddleware = (req, res, next) => {
    upload.single('content_file')(req, res, (err) => {
        if (err) {
            console.error("Erro no Upload Multer:", err.message);
            const errorMessage = err.message || "Erro desconhecido no upload do arquivo.";
            return res.redirect(`/admin?error=${encodeURIComponent(errorMessage)}`);
        }
        next();
    });
};


// Aplica o middleware requireAdmin a todas as rotas do painel
router.use(requireAdmin);

// --- Rotas de Gerenciamento de Aulas ---

// Rota 1: Dashboard principal - AGORA MOSTRA MENSAGENS DE SUCESSO/ERRO
router.get('/', (req, res) => {
    const lessons = getLessons(); 
    res.render('admin/dashboard', {
        lessons,
        title: 'Painel Admin',
        user: req.user,
        successMessage: req.query.success || null,
        errorMessage: req.query.error || null
    });
});

// Rota 2: Adiciona uma nova aula (com upload do .txt)
router.post('/lessons', uploadMiddleware, (req, res) => {
    try {
        if (!req.file) {
            return res.redirect(`/admin?error=${encodeURIComponent("Erro: Arquivo não foi processado pelo servidor.")}`);
        }

        const lessons = getLessons();
        const newId = lessons.length > 0 ? Math.max(...lessons.map(l => l.id)) + 1 : 1; 

        const newLesson = {
            id: newId,
            title: req.body.title,
            description: req.body.description || '',
            module: req.body.module || 'Módulo 1',
            release_date: req.body.release_date || new Date().toISOString().split('T')[0],
            content_file: req.file.filename.replace('.txt', ''),
            quiz: req.body.quiz === 'on' 
        };

        if (newLesson.quiz) {
            // Lógica de quiz
            newLesson.questions = {
                q1: {
                    text: req.body.q1_text,
                    options: [req.body.q1_optA, req.body.q1_optB, req.body.q1_optC],
                    answer: parseInt(req.body.q1_answer)
                }
            };
        }

        lessons.push(newLesson);
        saveLessons(lessons); // Síncrona (PONTO DE FALHA DE PERMISSÃO)
        res.redirect('/admin?success=Aula%20adicionada%20com%20sucesso.');

    } catch (e) {
        // Captura falhas de escrita local (lessons.json)
        console.error("Erro fatal ao processar nova aula (falha de escrita local):", e);
        if (req.file && fs.existsSync(req.file.path)) {
             fs.unlinkSync(req.file.path);
        }
        res.redirect(`/admin?error=${encodeURIComponent("Falha grave: O servidor não conseguiu salvar os dados. (Erro de Permissão ou I/O)")}`);
    }
});

// Rota 3: Excluir uma aula (Exclui do JSON e o arquivo .txt)
router.post('/lessons/:id/delete', (req, res) => {
    const id = parseInt(req.params.id);
    let lessons = getLessons();
    const lessonToDelete = lessons.find(l => l.id === id);

    try {
        if (lessonToDelete) {
            const filePath = path.join(__dirname, '..', 'content', `${lessonToDelete.content_file}.txt`);
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
            }
            lessons = lessons.filter(l => l.id !== id);
            saveLessons(lessons); 
        }
        res.redirect('/admin?success=Aula%20eliminada%20com%20sucesso.');
    } catch (e) {
        console.error("Erro ao excluir aula:", e);
        res.redirect(`/admin?error=${encodeURIComponent("Erro ao excluir a aula. (Permissão de escrita)")}`);
    }
});

// Rota 4: Visualização de Conteúdo (para Admin)
router.get('/lessons/:id', (req, res) => {
    try {
        const lessonId = req.params.id;
        const lessons = getLessons();
        const lesson = lessons.find(l => l.id.toString() === lessonId.toString());
        
        if (!lesson) {
            return res.status(404).send('Aula não encontrada.');
        }

        const rawContent = getLessonContent(lesson.content_file); // Usa o nome do arquivo para ler
        const lessonHtml = parseLessonContent(rawContent);

        res.render('admin/lesson_content', {
            lesson,
            content: lessonHtml,
            title: `Conteúdo: ${lesson.title}`,
            user: req.user
        });
    } catch (e) {
        console.error("Erro ao carregar conteúdo da aula para admin:", e);
        res.status(500).send("Erro interno ao carregar o conteúdo da aula.");
    }
});


// --- Rotas de Gerenciamento de Usuários (ASYNC/AWAIT) ---

// Lista todos os usuários
router.get('/users', async (req, res) => {
    try {
        const users = await getUsers();
        const pendingUsers = users.filter(u => !u.approved);
        const approvedUsers = users.filter(u => u.approved);

        res.render('admin/users', {
            title: 'Gerenciamento de Usuários',
            pendingUsers,
            approvedUsers,
            user: req.user,
            successMessage: req.query.success
        });
    } catch (error) {
        console.error("Erro ao carregar usuários:", error);
        res.status(500).send("Erro interno ao carregar a lista de usuários.");
    }
});

// ROTA: Aprovar usuário pendente
router.post('/users/:id/approve', async (req, res) => {
    const userFirestoreId = req.params.id;
    try {
        await approveUser(userFirestoreId);
        res.redirect('/admin/users?success=Usuário aprovado com sucesso.');
    } catch (error) {
        console.error("Erro ao aprovar usuário:", error);
        res.status(500).send("Erro interno ao tentar aprovar o usuário.");
    }
});

// ROTA: Eliminar usuário
router.post('/users/:id/delete', async (req, res) => { 
    const userFirestoreId = req.params.id; 
    try {
        await deleteUser(userFirestoreId); 
        res.redirect('/admin/users?success=Usuário eliminado com sucesso.');
    } catch (error) {
        console.error("Erro ao eliminar usuário:", error);
        res.status(500).send("Erro interno ao tentar eliminar o usuário.");
    }
});


// --- Rotas de Gerenciamento de Feedback/Comentários (ASYNC/AWAIT) ---

// Lista todo o feedback
router.get('/feedback', async (req, res) => {
    try {
        const comments = await getComments(); 
        const pendingComments = comments.filter(c => c.status === 'pending').reverse();
        const respondedComments = comments.filter(c => c.status === 'responded').reverse();

        res.render('admin/feedback', {
            title: 'Gerenciamento de Feedback',
            pendingComments,
            respondedComments,
            user: req.user,
            successMessage: req.query.success
        });
    } catch (error) {
        console.error("Erro ao carregar feedback:", error);
        res.status(500).send("Erro interno ao carregar o feedback.");
    }
});

// ROTA DE POST PARA RESPOSTA
router.post('/feedback/reply/:id', async (req, res) => {
    const commentFirestoreId = req.params.id;
    const { adminResponse } = req.body;
    
    if (!adminResponse) {
        return res.status(400).send('A resposta do administrador é obrigatória.');
    }

    try {
        await saveReplyToComment(commentFirestoreId, adminResponse, req.user.username);
        return res.redirect('/admin/feedback');
    } catch (e) {
        console.error("Erro ao responder feedback no Firebase:", e);
        res.status(500).send('Erro ao salvar resposta no Firebase.');
    }
});

// ROTA NOVA: Excluir um único Comentário/Feedback
router.post('/feedback/:id/delete', async (req, res) => {
    const commentFirestoreId = req.params.id;
    try {
        await deleteComment(commentFirestoreId);
        res.redirect('/admin/feedback?success=Feedback%20excluído%20com%20sucesso.');
    } catch (error) {
        console.error("Erro ao excluir feedback:", error);
        res.status(500).send("Erro interno ao excluir feedback.");
    }
});

// ROTA NOVA: Excluir TODOS os Comentários/Feedback
router.post('/feedback/delete-all', async (req, res) => {
    try {
        const count = await deleteAllComments();
        const message = `Todos os ${count} itens de feedback/comentários foram eliminados com sucesso.`;
        res.redirect(`/admin/feedback?success=${encodeURIComponent(message)}`);
    } catch (error) {
        console.error("Erro ao excluir todo o feedback:", error);
        res.status(500).send("Erro interno ao excluir todo o feedback.");
    }
});


// --- Rotas de Mensagens Globais (ASYNC/AWAIT) ---

// Lista mensagens existentes e mostra formulário
router.get('/messages', async (req, res) => {
    try {
        const messages = await getMessages();
        res.render('admin/messages', {
            title: 'Mensagens Globais',
            messages,
            user: req.user,
            successMessage: req.query.success
        });
    } catch (error) {
        console.error("Erro ao carregar mensagens:", error);
        res.status(500).send("Erro interno ao carregar mensagens.");
    }
});

// Adicionar nova mensagem
router.post('/messages', async (req, res) => {
    if (!req.body.text) {
        return res.status(400).send('O texto da mensagem é obrigatório.');
    }
    try {
        await saveNewMessage(req.body.text);
        res.redirect('/admin/messages?success=Mensagem%20publicada%20com%20sucesso.');
    } catch (error) {
        console.error("Erro ao salvar mensagem:", error);
        res.status(500).send("Erro interno ao salvar mensagem.");
    }
});

// Excluir mensagem individual
router.post('/messages/:id/delete', async (req, res) => {
    const messageFirestoreId = req.params.id;
    try {
        await deleteMessage(messageFirestoreId);
        res.redirect('/admin/messages?success=Mensagem%20excluída%20com%20sucesso.');
    } catch (error) {
        console.error("Erro ao excluir mensagem:", error);
        res.status(500).send("Erro interno ao excluir mensagem.");
    }
});

// ROTA NOVA: Excluir TODAS as mensagens globais
router.post('/messages/delete-all', async (req, res) => {
    try {
        const count = await deleteAllMessages();
        const message = `Todas as ${count} mensagens globais foram eliminadas com sucesso.`;
        res.redirect(`/admin/messages?success=${encodeURIComponent(message)}`);
    } catch (error) {
        console.error("Erro ao excluir todas as mensagens:", error);
        res.status(500).send("Erro interno ao excluir todas as mensagens.");
    }
});


// --- Rotas de Logs de Quiz (ASYNC/AWAIT) ---

// Lista logs de submissão dos quizzes
router.get('/quiz-submissions', async (req, res) => {
    try {
        const submissionLogs = await getSubmissionLogs();
        const lessons = getLessons(); 

        const logsWithLessonInfo = submissionLogs.map(log => {
            const lesson = lessons.find(l => l.id.toString() === log.lessonId.toString());
            return {
                ...log,
                lessonTitle: lesson ? lesson.title : `Aula ID ${log.lessonId} (Não Encontrada)`
            };
        });

        res.render('admin/quiz_submissions', {
            logs: logsWithLessonInfo,
            title: 'Submissões de Quiz',
            user: req.user
        });
    } catch (error) {
        console.error("Erro ao carregar logs de quiz:", error);
        res.status(500).send("Erro interno ao carregar logs de quiz.");
    }
});

// 🚨 EXPORTAÇÃO FINAL
module.exports = { router };


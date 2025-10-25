// ===========================================
// routes/admin.js (CÓDIGO COMPLETO E CORRIGIDO)
// Inclui o tratamento de erro na Rota de Aulas e as Rotas de Exclusão
// ===========================================

const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const multer = require('multer');

// 💡 MUDANÇA: Importa as novas funções ASSÍNCRONAS do Firebase
const {
    getUsers, approveUser, deleteUser, updateUser, // Gerenciamento de Usuários
    getLessons, saveLessons, getLessonContent, 
    getComments, saveReplyToComment, deleteComment, deleteAllComments, // 💡 NOVAS FUNÇÕES PARA COMENTÁRIOS/FEEDBACK
    getMessages, saveNewMessage, deleteMessage, deleteAllMessages, // 💡 NOVAS FUNÇÕES PARA MENSAGENS
    getSubmissionLogs
} = require('../database');

const { requireAdmin } = require('./auth');
const { parseLessonContent } = require('../utils/parser');

// Configuração do Multer (Permanece igual, pois lida com arquivos locais)
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, path.join(__dirname, '..', 'content'));
    },
    filename: (req, file, cb) => {
        const cleanName = file.originalname
            .toLowerCase()
            .replace(/\s+/g, '_');
        cb(null, cleanName);
    }
});
const upload = multer({ storage });


// Aplica o middleware requireAdmin a todas as rotas do painel
router.use(requireAdmin);

// --- Rotas de Gerenciamento de Aulas (Mantidas como Síncronas - Leitura de Arquivo) ---

// Rota 1: Dashboard principal
router.get('/', (req, res) => {
    // getLessons é síncrona
    const lessons = getLessons(); 
    res.render('admin/dashboard', {
        lessons,
        title: 'Painel Admin',
        user: req.user
    });
});

// Rota 2: Adiciona uma nova aula (com upload do .txt) - SÍNCRONA
router.post('/lessons', upload.single('content_file'), (req, res) => {
    try {
        // 💡 VERIFICAÇÃO CRÍTICA: Checa se o arquivo foi realmente carregado (Causa provável do erro 500)
        if (!req.file) {
            return res.status(400).send("Erro: O arquivo de conteúdo (.txt) da aula é obrigatório.");
        }

        const lessons = getLessons();
        const newId = lessons.length > 0 ? Math.max(...lessons.map(l => l.id)) + 1 : 1; 

        const newLesson = {
            id: newId,
            title: req.body.title,
            content_file: req.file.filename.replace('.txt', ''),
            quiz: req.body.quiz === 'on' 
        };

        if (newLesson.quiz) {
            // Lógica de quiz (simples, ajuste se necessário)
            newLesson.questions = {
                q1: {
                    text: req.body.q1_text,
                    options: [req.body.q1_optA, req.body.q1_optB, req.body.q1_optC],
                    answer: parseInt(req.body.q1_answer) // 0, 1 ou 2
                }
            };
        }

        lessons.push(newLesson);
        saveLessons(lessons);
        res.redirect('/admin');

    } catch (e) {
        console.error("Erro ao adicionar nova aula:", e);
        // Trata o erro e informa o usuário
        res.status(500).send("Erro interno ao tentar adicionar a aula. Verifique se o arquivo .txt foi anexado e se o servidor tem permissão de escrita.");
    }
});

// Rota 3: Excluir uma aula (Exclui do JSON e o arquivo .txt) - SÍNCRONA
router.post('/lessons/:id/delete', (req, res) => {
    const id = parseInt(req.params.id);
    let lessons = getLessons();
    const lessonToDelete = lessons.find(l => l.id === id);

    if (lessonToDelete) {
        // 1. Excluir o arquivo de conteúdo
        const filePath = path.join(__dirname, '..', 'content', `${lessonToDelete.content_file}.txt`);
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }
        
        // 2. Excluir a entrada do JSON
        lessons = lessons.filter(l => l.id !== id);
        saveLessons(lessons); // Síncrona
    }
    res.redirect('/admin');
});

// --- Rota de Visualização de Conteúdo (para Admin) ---
router.get('/lessons/:id', (req, res) => {
    try {
        const lessonId = req.params.id;
        const lessons = getLessons();
        const lesson = lessons.find(l => l.id.toString() === lessonId.toString());
        
        if (!lesson) {
            return res.status(404).send('Aula não encontrada.');
        }

        const rawContent = getLessonContent(lessonId); // Síncrona
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


// --- Rotas de Gerenciamento de Usuários (MIGRADAS PARA ASYNC/AWAIT) ---

// Lista todos os usuários (pendentes e aprovados)
router.get('/users', async (req, res) => { // 💡 ASYNC
    try {
        const users = await getUsers(); // 💡 AWAIT
        
        // Separa os usuários pendentes e aprovados
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

// 💡 ROTA CORRIGIDA: Aprovar usuário pendente
router.post('/users/:id/approve', async (req, res) => { // 💡 ASYNC
    const userFirestoreId = req.params.id;
    
    try {
        await approveUser(userFirestoreId); // 💡 AWAIT
        res.redirect('/admin/users?success=Usuário aprovado com sucesso.');
    } catch (error) {
        console.error("Erro ao aprovar usuário:", error);
        res.status(500).send("Erro interno ao tentar aprovar o usuário.");
    }
});

// 💡 NOVA ROTA: Eliminar usuário
router.post('/users/:id/delete', async (req, res) => { 
    const userFirestoreId = req.params.id; 
    
    try {
        // NOTA: A função deleteUser em database.js espera userFirestoreId e userId interno.
        // Como o userId interno não está disponível na rota, chamamos apenas com o FirestoreId.
        await deleteUser(userFirestoreId); 
        res.redirect('/admin/users?success=Usuário eliminado com sucesso.');
    } catch (error) {
        console.error("Erro ao eliminar usuário:", error);
        res.status(500).send("Erro interno ao tentar eliminar o usuário.");
    }
});

// --- Rotas de Gerenciamento de Feedback (MIGRADAS PARA ASYNC/AWAIT) ---

// Lista todo o feedback
router.get('/feedback', async (req, res) => { // 💡 ASYNC
    try {
        const comments = await getComments(); // 💡 AWAIT (Retorna todos os comentários do Firebase)
        
        // Filtra e inverte a ordem para mostrar os mais recentes primeiro
        const pendingComments = comments.filter(c => c.status === 'pending').reverse();
        const respondedComments = comments.filter(c => c.status === 'responded').reverse();

        res.render('admin/feedback', {
            title: 'Gerenciamento de Feedback',
            pendingComments,
            respondedComments,
            user: req.user
        });
    } catch (error) {
        console.error("Erro ao carregar feedback:", error);
        res.status(500).send("Erro interno ao carregar o feedback.");
    }
});

// ROTA DE POST PARA RESPOSTA (Já estava correta no último envio, mas confirmando o uso de async/await)
router.post('/feedback/reply/:id', async (req, res) => { // 💡 ASYNC
    const commentFirestoreId = req.params.id;
    const { adminResponse } = req.body;
    
    if (!adminResponse) {
        return res.status(400).send('A resposta do administrador é obrigatória.');
    }

    try {
        // Assume que saveReplyToComment em database.js aceita (id, resposta, nomeAdmin)
        await saveReplyToComment(commentFirestoreId, adminResponse, req.user.username);
        
        return res.redirect('/admin/feedback');
    } catch (e) {
        console.error("Erro ao responder feedback no Firebase:", e);
        res.status(500).send('Erro ao salvar resposta no Firebase.');
    }
});

// 💡 NOVO: Rota para Excluir um único Comentário/Feedback
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

// 💡 NOVO: Rota para Excluir TODOS os Comentários/Feedback
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


// --- Rotas de Mensagens Globais (MIGRADAS PARA ASYNC/AWAIT) ---

// Lista mensagens existentes e mostra formulário
router.get('/messages', async (req, res) => { // 💡 ASYNC
    try {
        const messages = await getMessages(); // 💡 AWAIT
        res.render('admin/messages', {
            title: 'Mensagens Globais',
            messages,
            user: req.user
        });
    } catch (error) {
        console.error("Erro ao carregar mensagens:", error);
        res.status(500).send("Erro interno ao carregar mensagens.");
    }
});

// Adicionar nova mensagem
router.post('/messages', async (req, res) => { // 💡 ASYNC
    if (!req.body.text) {
        return res.status(400).send('O texto da mensagem é obrigatório.');
    }
    
    try {
        await saveNewMessage(req.body.text); // 💡 AWAIT
        res.redirect('/admin/messages');
    } catch (error) {
        console.error("Erro ao salvar mensagem:", error);
        res.status(500).send("Erro interno ao salvar mensagem.");
    }
});

// Excluir mensagem individual
router.post('/messages/:id/delete', async (req, res) => { // 💡 ASYNC
    const messageFirestoreId = req.params.id;
    
    try {
        await deleteMessage(messageFirestoreId); // 💡 AWAIT
        res.redirect('/admin/messages');
    } catch (error) {
        console.error("Erro ao excluir mensagem:", error);
        res.status(500).send("Erro interno ao excluir mensagem.");
    }
});

// 💡 NOVO: Rota para Excluir TODAS as mensagens globais
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


// --- Rotas de Logs de Quiz (MIGRADAS PARA ASYNC/AWAIT) ---

// Lista logs de submissão dos quizzes
router.get('/quiz-submissions', async (req, res) => { // 💡 ASYNC
    try {
        const submissionLogs = await getSubmissionLogs(); // 💡 AWAIT
        const lessons = getLessons(); // Síncrona, ok.

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


module.exports = { router };


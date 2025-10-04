// controllers/lessonController.js


// Função para exibir a lista de aulas (GET /lessons) - Exemplo
const lesson_index = async (req, res) => {
    try {
        // Lógica: buscar todas as lições e renderizar a lista
        res.render('lessons/index', { 
            title: 'Todas as Aulas'
        });
    } catch (err) {
        console.error("Erro ao carregar lista de lições:", err);
        res.redirect('/');
    }
};


// Função para exibir detalhes de uma aula (GET /lessons/:id) - Essencial
const lesson_details = async (req, res) => {
    try {
        const lessonId = req.params.id;
        // Lógica: buscar a lição pelo ID e renderizar
        
        res.render('lessons/show', { 
            title: 'Detalhes da Lição'
            // Passe o objeto lesson aqui: lesson: lesson 
        }); 

    } catch (err) {
        console.error("Erro ao buscar detalhes da lição:", err);
        res.status(404).render('404', { title: 'Lição Não Encontrada' });
    }
};
const startQuiz = async (req, res) => {
    const lessonId = req.params.id;
    try {
        // Lógica:
        // 1. Buscar a lição e as perguntas do Quiz pelo lessonId.
        // 2. Renderizar a nova view 'lessons/quiz'
        
        // Renderiza uma nova view que conterá o formulário do Quiz
        res.render('lessons/quiz', { 
            title: `Quiz da Lição ${lessonId}`,
            lessonId: lessonId
            // Você passará o objeto lesson aqui: lesson: lesson
        }); 

    } catch (err) {
        console.error("Erro ao iniciar o Quiz:", err);
        // Redireciona para a página da lição em caso de erro
        res.redirect(`/lessons/${lessonId}`); 
    }
};
const submitQuiz = async (req, res) => {
    const lessonId = req.params.id;
    const userAnswers = req.body; 
    const userId = req.user ? req.user.id : null; 

    if (!userId) {
        return res.redirect('/auth/login');
    }

    try {
        // FUTURO: Aqui entrará a lógica de cálculo de pontuação e salvamento.
        
        console.log(`[QUIZ OK] Submissão para Lição ${lessonId} processada com sucesso.`);
        
        // Redireciona de volta para a lição (ou para um resumo da pontuação)
        res.redirect(`/lessons/${lessonId}`);

    } catch (err) {
        console.error('Erro no processamento do Quiz:', err);
        res.redirect(`/lessons/${lessonId}`); 
    }
};


module.exports = {
    lesson_index,
    lesson_details, 
    submitQuiz 
};


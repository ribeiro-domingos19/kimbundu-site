// database.js (CÓDIGO COMPLETO E SIMPLIFICADO)

const fs = require('fs');
const path = require('path');

// --- Caminhos dos Arquivos JSON ---
const usersPath = path.join(__dirname, 'users.json');
const lessonsPath = path.join(__dirname, 'lessons.json');
const commentsPath = path.join(__dirname, 'comments.json');
const progressPath = path.join(__dirname, 'progress.json'); 
// 🚨 NOVO CAMINHO PARA O LOG DE SUBMISSÕES
const submissionsLogPath = path.join(__dirname, 'content', 'quiz_submissions.json'); 

const readJSONFile = (filePath) => {
    try {
        const data = fs.readFileSync(filePath, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        // Se o arquivo não existir ou estiver corrompido, cria vazio
        fs.writeFileSync(filePath, '[]', 'utf8');
        return [];
    }
};
const writeJSONFile = (filePath, data) => {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
};

// --- Funções Específicas para Usuários ---
const getUsers = () => readJSONFile(usersPath);
const saveUsers = (users) => writeJSONFile(usersPath, users);

// --- Funções Específicas para Aulas ---
const getLessons = () => readJSONFile(lessonsPath);
// 🚨 DEFINIÇÃO CORRETA: saveLessons
const saveLessons = (lessons) => writeJSONFile(lessonsPath, lessons); 

const getLessonContent = (lessonId) => {
    const lessons = getLessons();
    const lesson = lessons.find(l => l.id.toString() === lessonId.toString());
    if (!lesson) throw new Error('Aula não encontrada no JSON.');

    const txtFilePath = path.join(__dirname, 'content', `${lesson.content_file}.txt`);
    return fs.readFileSync(txtFilePath, 'utf8'); 
};

// --- Funções de Progresso e Comentários ---
const getComments = (lessonId = null) => {
    const comments = readJSONFile(commentsPath);
    if (lessonId) {
        return comments.filter(c => c.lessonId.toString() === lessonId.toString());
    }
    return comments;
};
const saveComments = (comments) => writeJSONFile(commentsPath, comments);

const getUserProgress = (userId) => {
    const progressData = readJSONFile(progressPath);
    const userEntry = progressData.find(p => p.userId.toString() === userId.toString());
    return userEntry ? userEntry.completedLessons : [];
};

const markLessonComplete = (userId, lessonId) => {
    const progressData = readJSONFile(progressPath);
    const id = parseInt(lessonId);

    let userEntry = progressData.find(p => p.userId.toString() === userId.toString());

    if (!userEntry) {
        userEntry = { userId: parseInt(userId), completedLessons: [] };
        progressData.push(userEntry);
    }

    if (!userEntry.completedLessons.includes(id)) {
        userEntry.completedLessons.push(id);
        writeJSONFile(progressPath, progressData);
        return true;
    }
    return false;
};
// --- Funções Específicas para Mensagens Globais ---
const messagesPath = path.join(__dirname, 'messages.json');

const getMessages = () => readJSONFile(messagesPath);
const saveMessages = (messages) => writeJSONFile(messagesPath, messages);

// 🚨 NOVA FUNÇÃO: Leitura do log de submissões
const getSubmissionLogs = () => readJSONFile(submissionsLogPath);


module.exports = {
    getUsers, saveUsers,
    getLessons, saveLessons, getLessonContent, // <-- saveLessons exportada!
    getComments, saveComments,
    getUserProgress, markLessonComplete,     
    getMessages, saveMessages,
    getSubmissionLogs // 🚨 EXPORTADO
};


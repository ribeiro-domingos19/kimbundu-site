// ===========================================
// database.js (CÓDIGO COMPLETO E FINAL)
// ===========================================

// Importa o objeto 'db' do Firestore que inicializamos
const db = require('./utils/firebase'); 
const admin = require('firebase-admin'); // Necessário para FieldValue
const fs = require('fs');
const path = require('path');

// --- Caminhos e Arquivos Locais (Preservados) ---
const contentPath = path.join(__dirname, 'content');
const lessonsPath = path.join(__dirname, 'lessons.json');

// --- Funções Auxiliares Comuns ---
const mapSnapshotToData = (snapshot) => {
    return snapshot.docs.map(doc => ({ 
        id: doc.id, // ID do Firestore
        ...doc.data() 
    }));
};

// --- Funções Específicas para Usuários ('users' Collection) ---
const getUsers = async () => {
    const snapshot = await db.collection('users').get();
    return mapSnapshotToData(snapshot);
};

const addNewUser = async (userData) => {
    delete userData.id; 
    await db.collection('users').add(userData);
};

const approveUser = async (userFirestoreId) => {
    const docRef = db.collection('users').doc(userFirestoreId);
    await docRef.update({
        approved: true
    });
};

const updateUser = async (userFirestoreId, newData) => {
    const docRef = db.collection('users').doc(userFirestoreId);
    await docRef.update(newData);
};

const deleteUser = async (userFirestoreId, userId) => {
    await db.collection('users').doc(userFirestoreId).delete();
    if (userId) {
       await db.collection('progress').doc(userId.toString()).delete(); 
    }
};

// --- Funções de Lições (Arquivos Locais) ---
const getLessons = () => {
    try {
        const data = fs.readFileSync(lessonsPath, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        return [];
    }
};

const saveLessons = (lessons) => {
    fs.writeFileSync(lessonsPath, JSON.stringify(lessons, null, 2), 'utf8');
};

const getLessonContent = (lessonFile) => {
    const filePath = path.join(contentPath, `${lessonFile}.txt`);
    if (fs.existsSync(filePath)) {
        return fs.readFileSync(filePath, 'utf8');
    }
    return 'Conteúdo da aula não encontrado.';
};


// --- Funções de Comentários ('comments' Collection) ---
const getComments = async (lessonId = null) => {
    let query = db.collection('comments').orderBy('timestamp', 'desc');
    if (lessonId) {
        query = query.where('lessonId', '==', parseInt(lessonId));
    }
    const snapshot = await query.get();
    return mapSnapshotToData(snapshot);
};

const saveNewComment = async (commentData) => {
    commentData.timestamp = new Date().toISOString();
    await db.collection('comments').add(commentData);
};

const saveReplyToComment = async (commentFirestoreId, adminResponse, adminName) => {
    const docRef = db.collection('comments').doc(commentFirestoreId);
    await docRef.update({
        adminResponse: adminResponse,
        adminName: adminName,
        status: 'responded', 
        respondedAt: new Date().toISOString()
    });
    return true; 
};

// 💡 NOVA FUNÇÃO: Apagar um único Comentário/Feedback
const deleteComment = async (commentFirestoreId) => {
    await db.collection('comments').doc(commentFirestoreId).delete();
};

// 💡 NOVA FUNÇÃO: Apagar todos os Comentários/Feedback
const deleteAllComments = async () => {
    const commentsRef = db.collection('comments');
    const snapshot = await commentsRef.get();
    const batch = db.batch();

    if (snapshot.empty) {
        return 0;
    }

    snapshot.docs.forEach((doc) => {
        batch.delete(doc.ref);
    });

    await batch.commit();
    return snapshot.size;
};


// --- Funções de Mensagens Globais ('messages' Collection) ---
const getMessages = async () => {
    const snapshot = await db.collection('messages').orderBy('createdAt', 'desc').get();
    return mapSnapshotToData(snapshot);
};

const saveNewMessage = async (text) => {
    const messageData = {
        text: text,
        createdAt: new Date().toISOString()
    };
    await db.collection('messages').add(messageData);
};

const deleteMessage = async (messageFirestoreId) => {
    await db.collection('messages').doc(messageFirestoreId).delete();
};

// 💡 NOVA FUNÇÃO: Apagar todas as Mensagens Globais
const deleteAllMessages = async () => {
    const messagesRef = db.collection('messages');
    const snapshot = await messagesRef.get();
    const batch = db.batch();

    if (snapshot.empty) {
        return 0;
    }

    snapshot.docs.forEach((doc) => {
        batch.delete(doc.ref);
    });

    await batch.commit();
    return snapshot.size; 
};

// --- Funções de Progresso e Submissões ---
const getUserProgress = async (userId) => {
    const doc = await db.collection('progress').doc(userId.toString()).get();
    if (doc.exists) {
        return doc.data().completedLessons || [];
    }
    return [];
};

const markLessonComplete = async (userId, lessonId) => {
    const lessonIdInt = parseInt(lessonId);
    const docRef = db.collection('progress').doc(userId.toString());
    await docRef.set({
        completedLessons: admin.firestore.FieldValue.arrayUnion(lessonIdInt)
    }, { merge: true }); 
    return true; 
};

const getSubmissionLogs = async () => {
    const snapshot = await db.collection('quiz_submissions').orderBy('timestamp', 'desc').get();
    return mapSnapshotToData(snapshot);
};

const logQuizSubmission = async (userId, username, lessonId, score, totalQuestions, passed) => {
    const submissionData = {
        userId: userId,
        username: username,
        lessonId: parseInt(lessonId),
        score: score,
        totalQuestions: totalQuestions,
        passed: passed,
        timestamp: new Date().toISOString()
    };
    await db.collection('quiz_submissions').add(submissionData);
};


// --- EXPORTAÇÕES GLOBAIS (FINAL) ---
module.exports = {
    // Usuários
    getUsers, addNewUser, approveUser, 
    updateUser, deleteUser,
    // Lições
    getLessons, saveLessons, getLessonContent,
    // Comentários/Feedback
    getComments, saveNewComment, saveReplyToComment,
    deleteComment, deleteAllComments, 
    // Mensagens Globais
    getMessages, saveNewMessage, deleteMessage,
    deleteAllMessages, 
    // Progresso
    getUserProgress, markLessonComplete, getSubmissionLogs, logQuizSubmission 
};


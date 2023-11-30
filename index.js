const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const fs = require('fs').promises;

const app = express();
const server = http.createServer(app);
const io = socketIO(server);

app.get('/', (req, res) => {
    res.sendFile(__dirname + '/index.html');
});

let rooms = {};

async function readMessagesFromFile(room) {
    try {
        const data = await fs.readFile(`messages_${room}.json`, 'utf-8');
        rooms[room] = JSON.parse(data);
        console.log(`Mensagens da sala ${room} lidas com sucesso:`, rooms[room]);
    } catch (error) {
        if (error.code === 'ENOENT') {
            console.log(`Arquivo de mensagens da sala ${room} não encontrado. Criando um novo.`);
            await saveMessagesToFile(room);
        } else {
            console.error(`Erro ao ler mensagens da sala ${room} do arquivo:`, error.message);
        }
    }
}


io.on('connection', (socket) => {
    console.log('Novo usuário conectado');

    socket.on('join room', (data) => {
        const { room, nickname } = data;
        socket.join(room);
    
        if (!rooms[room]) {
            rooms[room] = [];
            readMessagesFromFile(room);
        }
    
        // Notify all clients in the room about the new user
        io.to(room).emit('user joined', `${nickname} entrou na sala.`);
    
        // Send the existing messages in the room to the newly joined user
        io.to(room).emit('load more', rooms[room]);
    });
    

    socket.on('chat message', (data) => {
        const { room, nickname, message } = data;
        const currentTime = getCurrentTime();
        const messageData = { nickname, message, time: currentTime };
    
        if (!rooms[room]) {
            rooms[room] = [];
        }
    
        rooms[room].push(messageData);
    
        // Broadcast the message to all clients in the room
        io.to(room).emit('chat message', messageData);
    
        saveMessagesToFile(room); // Ensure room information is correctly passed
    });
    

    socket.on('disconnect', () => {
        console.log('Usuário desconectado');
    });
});


const PORT = process.env.PORT || 80;
server.listen(PORT, () => {
    console.log(`Servidor ouvindo na porta ${PORT}`);
});

function getCurrentTime() {
    const now = new Date();
    const hours = now.getHours().toString().padStart(2, '0');
    const minutes = now.getMinutes().toString().padStart(2, '0');
    return `${hours}:${minutes}`;
}

async function saveMessagesToFile(room) {
    try {
        await fs.writeFile(`messages_${room}.json`, JSON.stringify(rooms[room]));
        console.log(`Mensagens da sala ${room} salvas com sucesso.`);
    } catch (err) {
        console.error(`Erro ao salvar mensagens da sala ${room} no arquivo:`, err.message);
    }
}



// node src/socket.js   


const express = require('express');

// const http = require('http');
const http = require('https');
const socketIO = require('socket.io');
const fs = require('fs');

const app = express();


// https://blog.csdn.net/shaopengjie2/article/details/118759304
// 配置ssl证书
const options = {
    cert: fs.readFileSync('src/1.pem'),
    key: fs.readFileSync('src/1.key')
}


const server = http.createServer(options, app);

const io = socketIO(server, {
    cors: {
        origin: '*'
    }
});



io.on('connection', (socket) => {

    // 用户连接时，返回 唯一id
    socket.emit('msg', 'id=' + socket.id, () => { });

    //客户端发送的消息是msg频道时，则直接向所有客户端转发
    socket.on('msg', (data) => {
        // console.log("收到客户端的消息：",messageData); 
        io.emit('msg', data); 
    });

    //监听客户端加入游戏或切换房间
    socket.on('joinRoom', (data) => {
        let messageData = JSON.parse(data);
        messageData.id = socket.id;

        socket.join(messageData.roomName);
        socket.data.roomName = messageData.roomName;
        socket.data.id = messageData.id;
        socket.data.userId = messageData.id;
        socket.data.platform = messageData.platform;
        socket.data.userName = messageData.userName;


        console.log('user connected 加入房间 ', socket.id, messageData.roomName);


        // 新用户加入时，把其他在线的用户发送给新用户
        GetAllUserByRoomName(socket, messageData.id, messageData.roomName);


        // 新用户加入时，向所有客户端发送 新用户加入 的消息
        messageData.type = "用户加入";
        messageData.message = "";
        io.emit('msg', JSON.stringify(messageData));

    })

    // 心跳检测连接状态
    socket.on('heart', (data) => {
        socket.emit('msg', "心跳检测");
        // console.log("接收到心跳检测 ");
    })

    // 监听客户端断开
    socket.on('disconnect', () => {
        // console.log('==客户端断开===');
        console.log(' ==客户端 离开房间 ',socket.data.id, socket.data.roomName);

        // 用户离开房间时，向所有客户端发送 用户离开 的消息
        //广播 该id、房间的用户离开
        let messageData = {};
        messageData.type = "用户离开";
        messageData.roomName = socket.data.roomName;
        messageData.id = socket.data.id;
        io.emit('msg', JSON.stringify(messageData));


    })


});


async function GetAllUserByRoomName(socket, id, roomName) {
    let messageData = {};
    messageData.id = id;
    messageData.roomName = roomName;
    messageData.type = "刷新用户";

    let allsocketName = [];

    const sockets = await io.in(roomName).fetchSockets();

    for (let i = 0; i < sockets.length; i++) {
        const socketData = sockets[i].data;
        if (socketData.roomName == roomName) {
            allsocketName.push({
                id: socketData.id,
                userName: socketData.userName,
                platform: socketData.platform,
                roomName: socketData.roomName,
            });
        }
    }

    messageData.message = JSON.stringify(allsocketName);

    socket.emit('msg', JSON.stringify(messageData)); 

}


app.get('/', (request, response) => {
    /*在浏览器发送 http://127.0.0.1:24000 的请求，客户端定义了监听'message'的socket，所以可以接收消息，即使客户端有代码
        io.on('message',(data) => {
            console.log(data);
        });
    */
    io.emit('message', '服务端向客户端推送消息...');
    response.writeHead(200, { "Content-type": "text/plain" });
    response.end();
});


server.listen(3333, () => {
    console.log("server is up and running on port 3333");
});
 

// node src/socket.js   


const express = require('express');

const http = require('http');
// const http = require('https');
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


let mainUserTimes = 0;

io.on('connection', (socket) => {
    socket.emit('msg', 'id=' + socket.id, () => { });

    //
    socket.on('msg', (data) => {

        // var total=io.engine.clientsCount;
        // console.log(total);
        // console.log(io.in("3dfarm"));
        // io.in("room1");
        // console.log(sockets);
        // console.log(io.engine);
        // console.log(io.sockets);
        // console.log(io.sockets.sockets);
        // console.log(io.sockets.sockets[0].data);

        let messageData = JSON.parse(data);
        let params = JSON.parse(messageData.params);
        if (params.type == "更新角色状态") {
            if (params.message.user.cancelMainUser != undefined) {
                console.log(params.message.user.cancelMainUser);
                if (params.message.user.cancelMainUser == "交出主控权") {
                    mainUserTimes = 0;
                }
                if (params.message.user.cancelMainUser == "获取主控权") {
                    if (mainUserTimes == 0) {
                        mainUserTimes++;
                        if (mainUserTimes == 1) {
                            params.message.user.cancelMainUser = "指定主控权";
                            messageData.params = params;
                            io.emit('msg', JSON.stringify(messageData));
                        }
                    }
                    return;
                }
            }


        }

        if (params.type == "同步用户模型") {
            if (params.title == "添加") {
                AddUserModel(params.userModel);
            }
            if (params.title == "修改") {
                EditorUserModel(params.userModel);
            }
            if (params.title == "删除") {
                DelUserModel(params.userModelId);
            }
            // console.log("收到 同步用户模型 消息： ",params); 
        }

        if (params.type == "同步场景状态") {
            // 由第一个链接到该房间服务器的玩家上传场景数据
            if (params.title == "初始化") {
                AddRoomSceneState(params.message.roomName, params.sceneModels);
            }
            // 每个客户端对场景物体交互，都发送给服务器。再由服务器下发给其他客户端
            if (params.title == "更新single") {
                UpdateRoomSceneState(params.message.roomName, params.model);
            }
        }

        // console.log("收到客户端的消息：",messageData); 
        // 向所有用户转发信息
        io.emit('msg', data);
        // io.emit('msg', JSON.stringify(messageData));
        // io.in(messageData.roomName).emit('msg', JSON.stringify(messageData));
    })

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


        // 刷新房间内其他用户
        GetAllUserByRoomName(socket, messageData.id, messageData.roomName);


        // if (userModels.length > 0) {
        //     let messageData = {};
        //     messageData.type = "同步用户模型";
        //     messageData.fnName = "_SendUpdateUserModels";
        //     messageData.title = "刷新";
        //     messageData.roomName = socket.data.roomName;
        //     messageData.userModels = userModels;
        //     socket.emit('msg', JSON.stringify(messageData));
        //     // console.log("刷新用户模型 ", userModels);
        // }



        messageData.type = "用户加入";
        messageData.message = "";
        io.emit('msg', JSON.stringify(messageData));
    })

    socket.on('heart', (data) => {
        socket.emit('msg', "心跳检测");
        // console.log("接收到心跳检测 ");
    })

    // 监听客户端断开
    socket.on('disconnect', () => {
        // console.log('==客户端断开===');
        LeaveRoom(socket);
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


    //先刷新用户，再刷新场景状态
    setTimeout(() => {
        let sceneModels = GetRoomSceneState(messageData.roomName);
        if (sceneModels.length > 0) {
            let messageData = {};
            messageData.type = "获取场景状态";
            messageData.fnName = "_SendUpdateSceneModels";
            messageData.title = "刷新";
            messageData.roomName = socket.data.roomName;
            messageData.sceneModels = sceneModels;
            socket.emit('msg', JSON.stringify(messageData));
            // console.log("新用户加入，向其发送场景状态 ", sceneModels);
        }
    }, 500);




    // console.log(messageData);

    // return ( allsocketName);
    // return JSON.stringify( allsocketName);
    // return JSON.parse(JSON.stringify( allsocketName));
    // var total=io.engine.clientsCount;
    // console.log(total);
    // console.log(io.in("3dfarm"));
    // io.in("room1");

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

// 用户创建的模型
let userModels = [];
function AddUserModel(item) {
    userModels.push(item);
    // console.log("添加模型");
}
function EditorUserModel(item) {
    let has = false;
    for (let i = userModels.length - 1; i >= 0 && !has; i--) {
        let elment = userModels[i];
        if (elment.id == item.id) {
            elment = item;
            userModels[i] = item;
            // console.log("修改模型数据",elment);
            has = true;
        }
    }
}
function DelUserModel(id) {
    let find = false;
    for (let i = userModels.length - 1; i >= 0 && !find; i--) {
        const elment = userModels[i];
        if (elment.id == id) {
            userModels.splice(i, 1);
            find = true;
        }
    }
}



// 场景中同步的物体，在服务器中更新。用户每次连接或激活焦点，从服务器中读取物体状态
let roomsScene = [
    { roomName: '', sceneModels: [] },
];
function addDyncSceneModel(sceneModels, id, type, state) {
    sceneModels.push({ id: id, type: type, state: state });
}
function ClearRoomSceneState(roomName) {
    for (let i = roomsScene.length - 1; i >= 0; i--) {
        if (roomsScene[i].roomName == roomName) {
            roomsScene.splice(i, 1);
        }
    }
}
function AddRoomSceneState(roomName, sceneModels) {
    // 由服务器端同一设置起始和偏移时间
    addDyncSceneModel(sceneModels, "offsetTime", "offsetTime", { offsetTime: 0, startTime: 1675586194683, });
    roomsScene.push({ roomName: roomName, sceneModels: sceneModels });
    console.log("初始化场景状态", roomName, sceneModels);
}
function UpdateRoomSceneState(roomName, _model) {
    roomsScene.forEach(room => {
        if (room.roomName == roomName) {
            room.sceneModels.forEach(model => {
                if (model.id == _model.id) {
                    model.state = _model.state;
                    if (_model.state.health == 0) {
                        setTimeout(() => {
                            model.state.health = model.state.maxHealth;
                            model.state.display = true;
                            SendMsgToRoom(roomName, "", { id: model.id, modelType: model.modelType, state: { display: true, title: "重新生成" } });
                        }, 12000);
                    }
                }
            });
        }
    });
}

async function SendMsgToRoom(roomName, title, model) {
    let messageData = {};
    messageData.type = "服务器下发";
    messageData.fnName = "ReceiveFromServer";
    messageData.model = model;
    const sockets = await io.in(roomName).fetchSockets();
    for (let i = 0; i < sockets.length; i++) {
        const socketData = sockets[i].data;
        if (socketData.roomName == roomName) {
            sockets[i].emit('msg', JSON.stringify(messageData));
        }
    }
}
async function LeaveRoom(socket) {
    console.log(' ==客户端 离开房间 ', socket.data.id, socket.data.roomName);

    let roomName = socket.data.roomName;
    let messageData = {};
    messageData.type = "用户离开";
    messageData.roomName = socket.data.roomName;
    messageData.id = socket.data.id;
    const sockets = await io.in(roomName).fetchSockets();

    let has = false;
    for (let i = 0; i < sockets.length; i++) {
        const socketData = sockets[i].data;
        if (socketData.roomName == roomName) {
            sockets[i].emit('msg', JSON.stringify(messageData));
            // console.log(" 还在房间中 ",socketData.id);
            has = true;
        }
    }

    // 房间内没人后，清除房间内的场景数据
    if (!has) {
        ClearRoomSceneState(roomName);
    }
}


function GetRoomSceneState(roomName) {
    // roomsScene.forEach(room => {
    //     if (room.roomName == roomName) {
    //         return room.sceneModels;
    //     }
    // });  
    for (let i = 0; i < roomsScene.length; i++) {
        const room = roomsScene[i];
        if (room.roomName == roomName) {
            return room.sceneModels;
        }
    }
    return [];
}

// setInterval(() => {
//     let messageData = {};
//     messageData.type = "同步场景模型";
//     messageData.fnName = "_DyncSceneFromServer";
//     messageData.params = sceneModels;
//     io.emit('msg', JSON.stringify(messageData));
// }, 1000);

setInterval(() => {
    for (let i = 0; i < roomsScene.length; i++) {
        const room = roomsScene[i];
        for (let j = 0; j < room.sceneModels.length; j++) {
            const item = room.sceneModels[j];
            if (item.type == "offsetTime") {
                const state = item.state;
                var g = new Date().getTime(); //1675586194683
                let offsetTime = g - state.startTime;
                state.offsetTime = offsetTime;
            }
        }
    }
}, 20); 

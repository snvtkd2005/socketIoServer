
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

            // if (params.title == "添加") {
            //     AddUserModel(params.userModel);
            // }
            // if (params.title == "修改") {
            //     EditorUserModel(params.userModel);
            // }
            // if (params.title == "删除") {
            //     DelUserModel(params.userModelId);
            // }

            // console.log("收到 同步用户模型 消息： ",params); 

        }
        // console.log("收到客户端的消息：",messageData); 

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


        GetAllUserByRoomName(socket, messageData.id, messageData.roomName);

        messageData.type = "用户加入";
        messageData.message = "";
        io.emit('msg', JSON.stringify(messageData));



        if (userModels.length > 0) {
            let messageData = {};
            messageData.type = "同步用户模型";
            messageData.fnName = "_SendUpdateUserModels";
            messageData.title = "刷新";
            messageData.roomName = socket.data.roomName;
            messageData.userModels = userModels;
            socket.emit('msg', JSON.stringify(messageData));
            // console.log("刷新用户模型 ", userModels);
        }

    })

    socket.on('heart', (data) => {
        socket.emit('msg', "心跳检测");
        // console.log("接收到心跳检测 ");
    })

    // 监听客户端断开
    socket.on('disconnect', () => {
        // console.log('==客户端断开===');
        console.log(' ==客户端 离开房间 ', socket.data.id, socket.data.roomName);

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
let sceneModels = [];
function addDyncSceneModel(id, type, state) {
    sceneModels.push({ id: id, type: type, state: state });
}
addDyncSceneModel("", "offsetTime",
    {
        offsetTime: 0,
        times: 0
    });
let time = 0;

setInterval(() => {
    let messageData = {};
    messageData.type = "同步场景模型";
    messageData.fnName = "_DyncSceneFromServer";
    messageData.params = sceneModels;
    io.emit('msg', JSON.stringify(messageData));

}, 1000);
setInterval(() => {

    // time++;
    for (let i = 0; i < sceneModels.length; i++) {
        const item = sceneModels[i];
        var g = new Date().getTime(); //1675586194683
        let offsetTime = g - 1675586194683;
        if (item.type == "platform") {
            const state = item.state;
            state.offsetTime = offsetTime;

            // state.timeNum++;
            // if (state.timeNum >= state.timecount) {
            //     state.timeNum = 0;
            //     if (state.direction == "inStart") {
            //         state.direction = "inStartToEnd";
            //         state.timecount = state.inStartToEndCount;
            //         continue;
            //     }
            //     if (state.direction == "inStartToEnd") {
            //         state.direction = "inEnd";
            //         state.timecount = state.inEndCount;
            //         continue;
            //     }
            //     if (state.direction == "inEnd") {
            //         state.direction = "inEndToStart";
            //         state.timecount = state.inEndToStartCount;
            //         continue;
            //     }
            //     if (state.direction == "inEndToStart") {
            //         state.direction = "inStart";
            //         state.timecount = state.inStartCount;
            //         continue;
            //     }
            // }
            // console.log(state.timeNum);
        }
        if (item.type == "offsetTime") {
            const state = item.state;
            state.offsetTime = offsetTime;
            // state.times ++;
            // if(state.times >10){
            //     state.times = 0;
            // } 
        }
    }
}, 20); 

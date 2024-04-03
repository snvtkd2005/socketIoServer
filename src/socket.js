
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

const request = require('request');
function getLocationByIP(ip) {
    ip = ip.split("f:")[1];

    const apiKey = 'vBLzcIDbdZL5n8RLkh7CDdZes3dMo3li';
    const url = `https://api.map.baidu.com/location/ip?ip=${ip}&coor=bd09ll&ak=${apiKey}`;
    // const url = `https://api.map.baidu.com/location/ip?ak=${apiKey}&ip=${ip}&coor=bd09ll`;
   
    return new Promise((resolve, reject) => {
        
        if(ip == "127.0.0.1"){
            resolve("local");
            return;
        }
        if(ip == "192.168.71.108"){
            resolve("local");
            return;
        }
        request(url, (error, response, body) => {
        if (error) {
          reject(error);
        } else {
            let content = JSON.parse(body).content;
            if(content){
                const location = content.address;
                resolve(location);
            }
        }
      });
    });
}


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
        if (params.type == "更新角色位置") {
            // console.log(" 更新角色状态 ",params.message.user.userData);
            socket.data.userData = params.message.user.userData;
        }

        if (params.type == "同步用户模型") {
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

            if (params.title == "添加") {
                AddUserModel(params.message.roomName, params.model);
            }
            if (params.title == "修改") {
                EditorUserModel(params.message.roomName, params.model);
            }
            if (params.title == "删除") {
                DelUserModel(params.message.roomName, params.model);
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

        getLocationByIP(socket.handshake.address).then((location) => {
            console.log(location);
            console.log(' ==客户端 加入房间 ', socket.id,location, messageData.roomName, FormatDate());
          }).catch((error) => {
            console.log(' ==客户端 加入房间 ', socket.id, messageData.roomName, FormatDate());
            console.error(error);
        });

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
            // console.log("刷新用户状态", socketData);
            allsocketName.push({
                id: socketData.id,
                userName: socketData.userName,
                platform: socketData.platform,
                roomName: socketData.roomName,
                userData: socketData.userData,
            });
        }
    }

    messageData.message = JSON.stringify(allsocketName);
    socket.emit('msg', JSON.stringify(messageData));


    //先刷新用户，再刷新场景状态
    setTimeout(() => {
        let { sceneModels, userModels } = GetRoomSceneState(messageData.roomName);
        if (sceneModels.length > 0) {
            let messageData = {};
            messageData.type = "获取场景状态";
            messageData.fnName = "_SendUpdateSceneModels";
            messageData.title = "刷新";
            messageData.roomName = socket.data.roomName;
            messageData.sceneModels = sceneModels;
            messageData.userModels = userModels;
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
function AddUserModel(roomName, item) {
    SendMsgToRoom(roomName, "添加", item);
    // console.log("添加模型", item);
    roomsScene.forEach(room => {
        if (room.roomName == roomName) {
            room.userModels.push(JSON.parse(JSON.stringify(item)));
            room.sceneModels.push(item);
            return;
        }
    });
}
function EditorUserModel(roomName, item) {

    roomsScene.forEach(room => {
        if (room.roomName == roomName) {
            for (let i = room.userModels.length - 1; i >= 0; i--) {
                const elment = room.userModels[i];
                if (elment.id == item.id) {
                    
                }
            }
            return;
        }
    });
 
}
function DelUserModel(roomName, model) {
    SendMsgToRoom(roomName, "删除", model);
    // console.log(" 删除 ", model);
    let {id, type,modelType } = model;
    if (type == "玩家镜像") {
        let { npcId, playerId } = model;
        id = npcId;
    }
    roomsScene.forEach(room => {
        if (room.roomName == roomName) {
            for (let i = room.sceneModels.length - 1; i >= 0; i--) {
                const elment = room.sceneModels[i];
                if (elment.id == id) {
                    room.sceneModels.splice(i, 1);
                    for (let ii = room.userModels.length - 1; ii >= 0; ii--) {
                        const elment2 = room.userModels[ii];
                        if (elment2.id == id) {
                            room.userModels.splice(ii, 1);
                            return;
                        }
                    }
                    return;
                }
            }
            return;
        }
    });
}



// 场景中同步的物体，在服务器中更新。用户每次连接或激活焦点，从服务器中读取物体状态
let roomsScene = [
    { roomName: '', sceneModels: [], userModels: [] },
];
function addDyncSceneModel(sceneModels, id, type, state) {
    sceneModels.push({ id: id, modelType: type, state: state });
}
function ClearRoomSceneState(roomName) {
    for (let i = roomsScene.length - 1; i >= 0; i--) {
        if (roomsScene[i].roomName == roomName) {
            roomsScene.splice(i, 1);
        }
    }
    for (let i = laterFn.length - 1; i >= 0; i--) {
        const element = laterFn[i];
        if (element.roomName == roomName) {
            for (let j = 0; j < element.laterFn.length; j++) {
                const fn = element.laterFn[j];
                clearTimeout(fn);
            }
            laterFn.splice(i, 1);
        }
    }
}
let laterFn = [];

// 初始化场景中同步数据
function AddRoomSceneState(roomName, sceneModels) {
    roomsScene.push({ roomName: roomName, sceneModels: sceneModels, userModels: [] });
    laterFn.push({ roomName: roomName, laterFn: [] });
    // console.log("初始化场景状态", roomName, sceneModels);
}
function AddRoomLaterFn(roomName, fn) {
    for (let i = 0; i < laterFn.length; i++) {
        const element = laterFn[i];
        if (element.roomName == roomName) {
            element.laterFn.push(fn);
        }
    }
}
function UpdateRoomSceneState(roomName, _model) {
    roomsScene.forEach(room => {
        if (room.roomName == roomName) {
            room.sceneModels.forEach(model => {
                if (model.id == _model.id) {
                    if (model.modelType == "装备模型") {
                        model.state = _model.state;
                    }

                    if (model.modelType == "NPC模型") {
                        let relifeTime = model.state.relifeTime;
                        model.state = _model.state;
                        model.state.relifeTime = relifeTime;
                        if (_model.state.health == 0 && model.state.relifeTime > 0) {
                            AddRoomLaterFn(roomName, setTimeout(() => {
                                model.state.health = model.state.maxHealth;
                                model.state.display = true;
                                SendMsgToRoom(roomName, "生成NPC", { id: model.id, modelType: model.modelType, state: { display: true, title: "重新生成" } });
                            }, model.state.relifeTime * 1000));
                        }
                    }
                    if (model.modelType == "交互模型") {
                        if (_model.state.display != undefined) {
                            if (model.state.relifeTime > 0) {
                                AddRoomLaterFn(roomName, setTimeout(() => {
                                    model.state.display = true;
                                    SendMsgToRoom(roomName, "生成道具", { id: model.id, modelType: model.modelType, state: { display: true, title: "重新生成" } });
                                }, model.state.relifeTime * 1000));
                            }
                            model.state.display = _model.state.display;
                        } else {
                            model.state.value = _model.state.value;
                            if (_model.state.type == "add") {
                                model.state.count++;
                            }
                            if (_model.state.type == "redius") {
                                model.state.count--;
                                if (model.state.count < 0) {
                                    model.state.count = 0;
                                }
                            }
                            //向房间内所有人广播
                            SendMsgToRoom(roomName, "更新道具数量", model);
                        }
                    }

                    // console.log("更新场景物体", model);
                }
            });
        }
    });
}

async function SendMsgToRoom(roomName, title, model) {
    let messageData = {};
    messageData.type = "服务器下发";
    messageData.fnName = "ReceiveFromServer";
    messageData.title = title;
    messageData.model = model;
    const sockets = await io.in(roomName).fetchSockets();
    for (let i = 0; i < sockets.length; i++) {
        const socketData = sockets[i].data;
        if (socketData.roomName == roomName) {
            sockets[i].emit('msg', JSON.stringify(messageData));
        }
    }
}

function FormatDate() {
    var g = new Date().getTime(); //1637120820767
    var now = new Date(g); //创建一个指定的日期对象
    var year = now.getFullYear(); //取得4位数的年份
    var month = now.getMonth() + 1; //取得日期中的月份，其中0表示1月，11表示12月
    var date = now.getDate(); //返回日期月份中的天数（1到31）
    var hour = now.getHours(); //返回日期中的小时数（0到23）
    var minute = now.getMinutes(); //返回日期中的分钟数（0到59）
    var second = now.getSeconds(); //返回日期中的秒数（0到59）
    return (
        year +
        "-" +
        month +
        "-" +
        date +
        " " +
        hour +
        ":" +
        minute
        + ":" + second
    );
}

async function LeaveRoom(socket) {
    console.log(' ==客户端 离开房间 ', socket.data.id, socket.data.roomName, FormatDate());

    let roomName = socket.data.roomName;
    let messageData = {};
    messageData.type = "用户离开";
    messageData.roomName = socket.data.roomName;
    messageData.id = socket.data.id;

    let transId = "";
    let pos = "";
    if (socket.data.userData && socket.data.userData.weaponData) {
        transId = socket.data.userData.weaponData.transId;
        pos = socket.data.userData.pos;
        // 如果下线玩家拿了武器，则把该武器重新显示
        if (transId != "") {
            pos.y += 1;
            let model = {};
            model.id = transId;
            model.modelType = "装备模型";
            let state = {};
            state.display = true;
            state.pos = pos;
            model.state = state;
            // 更新服务器中状态
            UpdateRoomSceneState(roomName, model);
            // 向房间中其他玩家下发
            SendMsgToRoom(roomName, "还原装备", model);

        }
    }

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
            return {
                sceneModels: room.sceneModels,
                userModels: room.userModels
            };
        }
    }
    return { sceneModels: [], userModels: [] };
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
        if (room.sceneModels.length > 0) {
            const item = room.sceneModels[0];
            const state = item.state;
            var g = new Date().getTime(); //1675586194683
            let offsetTime = g - state.startTime;
            state.offsetTime = offsetTime;
        }
        // for (let j = 0; j < room.sceneModels.length; j++) {
        //     const item = room.sceneModels[j];
        //     if (item.type == "offsetTime") {
        //         const state = item.state;
        //         var g = new Date().getTime(); //1675586194683
        //         let offsetTime = g - state.startTime;
        //         state.offsetTime = offsetTime;
        //     }
        // }
    }
}, 20); 

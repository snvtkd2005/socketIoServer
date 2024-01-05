// const http = require('http');
const http = require('https');
const formidable = require('formidable');
const fs = require('fs');
const path = require('path');

const unzipper = require('unzipper'); // 解压缩模块
// 保存文件的目录
const UPLOAD_DIR = './uploads/';

const UPLOAD_DIR_GROUP = './uploadsGroup/';
const UPLOAD_DIR_SCENE = './uploadsScene/';
const UPLOAD_DIR_HDR = './uploadsHDR/';
const UPLOAD_DIR_UVANIM = './uploadsUVAnim/';
const UPLOAD_DIR_SKILL = './uploadsSkill/';
const UPLOAD_DIR_PLAYER = './uploadsPlayer/';
const METAWORLD_DIR = './';

// https://blog.csdn.net/shaopengjie2/article/details/118759304
// 配置ssl证书
const options = {
    cert: fs.readFileSync('src/1.pem'),
    key: fs.readFileSync('src/1.key')
}

// 开放世界地图对应场景或单品资源
// 同一地图id，只允许有一个场景
// 同一地图id，允许有一个或多个单品，单品时需要指定单品的transform数据

let mapToScene = [
    // { id: "10000-10000-9998", folderBase: "1691113201129" },
    // { id: "10000-10000-10000", folderBase: "1691284139097" },
];

function LoadMapMetaWorld() {
    fs.readFile(METAWORLD_DIR + "/metaworld.txt", 'utf8', (err, data) => {
        if (err) throw err;

        mapToScene = JSON.parse(data);
        console.log(mapToScene);
    });
}
LoadMapMetaWorld();

function SaveMapMetaWorld() {
    let message = JSON.stringify(mapToScene);
    fs.writeFile(METAWORLD_DIR + "/metaworld.txt", message, function (err) {
        if (err) {
            return console.log(err);
        }
        console.log("The file was saved!");
    });
}
function CheckMapId(id, folderBase, msg) {
    console.log(id,folderBase,msg);

    if (msg.type == "查找") {
        let folderBaseList = [];
        for (let i = 0; i < mapToScene.length; i++) {
            const element = mapToScene[i];
            if (element.id == id) {
                folderBaseList.push(element);
            }
        }
        return folderBaseList;
    }
    if (msg.type == "添加") {
        for (let i = 0; i < mapToScene.length; i++) {
            const element = mapToScene[i];
            if (element.id == id) {
                return false;
            }
        }
        mapToScene.push({ id: id, folderBase: folderBase });
        SaveMapMetaWorld();
        return true;
    }
    if (msg.type == "删除") {
        for (let i = 0; i < mapToScene.length; i++) {
            const element = mapToScene[i];
            if (element.id == id) {
                mapToScene.splice(i, 1);
                SaveMapMetaWorld();
                return true;
            }
        }
        return false;
    }

}


http.createServer(options, function (req, res) {

    // res.setHeader("Access-Control-Allow-Origin", "https://snvtkd2005.com");
    res.setHeader("Access-Control-Allow-Origin", "*");


    // 删除单品文件夹
    if (req.url === '/removeFolderBase' && req.method.toLowerCase() === 'post') {
        const form = new formidable.IncomingForm(
            {
                encoding: 'utf-8'
            }
        );
        form.parse(req, function (err, fields) {
            if (err) throw err;
            let dir = "";
            if (fields.type == "scene") {
                dir = UPLOAD_DIR_SCENE;
            } else {
                dir = UPLOAD_DIR;
            }
            fs.rmdir(dir + fields.folderBase, { recursive: true }, (e) => {
                res.write('SUCCESS'+e);
                return res.end();
             });
            
        });
        return;

    }


    if (req.url === '/metaWorld' && req.method.toLowerCase() === 'post') {
        const form = new formidable.IncomingForm(
            {
                encoding: 'utf-8'
            }
        );
        form.parse(req, function (err, fields) {
            if (err) throw err;
            // console.log(fields);
            let resData = {};
            resData.data = CheckMapId(fields.mapId, fields.folderBase, JSON.parse(fields.msg));
            res.write(JSON.stringify(resData));
            return res.end();
        });
        return;

    }

    // 单品模型文件贴图文件上传
    if (req.url === '/upload' && req.method.toLowerCase() === 'post') { //上传文件 

        // console.log("req ",req);
        const form = new formidable.IncomingForm(
            {
                encoding: 'utf-8'
            }
        );
        form.uploadDir = UPLOAD_DIR;
        // form.multiples = true; // enable multiple file upload

        form.parse(req, function (err, fields, files) {
            if (err) throw err; // 将上传的文件保存到叫做 "uploads" 的文件夹中 

            // console.log("files,",files);
            const oldPath = files.fileToUpload.filepath;

            let folderBase = UPLOAD_DIR + fields.folderBase;
            if (!fs.existsSync(folderBase)) {
                fs.mkdirSync(folderBase);
            }


            let foldPath = "";
            let fileName = "";
            if (fields.folderName != undefined) {
                if (fields.isBase == "true") {

                    // 去掉根目录
                    let sp = files.fileToUpload.originalFilename.split('/');
                    // console.log(" 去掉根目录 ",files.fileToUpload.originalFilename,sp);
                    if (sp.length > 2) {
                        foldPath = folderBase;
                        for (let i = 1; i < sp.length - 1; i++) {
                            const element = sp[i];
                            foldPath += "/" + element;
                        }
                        // console.log("多层目录",foldPath);
                    } else {
                        foldPath = folderBase;
                    }
                    fileName = files.fileToUpload.originalFilename.replace(fields.folderName + '/', "");
                } else {
                    foldPath = folderBase + "/" + fields.folderName;
                    fileName = files.fileToUpload.originalFilename.replace(fields.folderName + '/', "");
                }
            } else {
                foldPath = folderBase;
                fileName = files.fileToUpload.originalFilename;
            }
            // console.log(" 获取文件存储的文件夹名 ,",foldPath);

            if (!fs.existsSync(foldPath)) {
                fs.mkdirSync(foldPath);
            }
            const newPath = foldPath + "/" + fileName;
            fs.rename(oldPath, newPath, function (err) {
                if (err) {
                    res.write('FAILD' + err);
                    return res.end();
                };
                // res.writeHead(200, {'Content-Type': 'text/html'}); 
                res.write('SUCCESS');
                console.log("文件上传成功！", newPath);
                return res.end();
            });
        });


        // form.parse(req, (err, fields, files) => { 
        //     if (err) { console.error(err); res.writeHead(500, { 'Content-Type': 'text/plain' }); res.end('Internal Server Error'); return; } // handle each uploaded file 
        //     console.log(files); 
        //     return;
        //     const uploadedFiles = Array.isArray(files.fileToUpload) ? files.fileToUpload : [files.fileToUpload]; 
        //     console.log(uploadedFiles); 

        //     uploadedFiles.forEach(file => { 

        //         const oldPath = file.path; 
        //         const newPath =  UPLOAD_DIR + file.name; 
        //         fs.rename(oldPath, newPath, err => { 
        //             if (err) { console.error(err); res.writeHead(500, { 'Content-Type': 'text/plain' }); res.end('Internal Server Error'); return; } 
        //             console.log(`File ${file.name} uploaded and moved to ${newPath}`); 
        //         }); 
        //     });
        // });

        // form.parse(req, function (err, fields, files) { 
        //     if (err) { console.error(err); res.statusCode = 500; res.end('Internal Server Error'); return; } 
        //     // console.log(files); 
        //     console.log(files.fileToUpload); 

        //     // console.log(`Received ${files.fileToUpload.length} files`); 
        //     for (let i = 0; i < files.fileToUpload.length; i++) { 
        //         const oldPath = files.fileToUpload[i].filepath; 
        //         const newPath = './uploads/' + files.fileToUpload[i].originalFilename; 
        //         fs.rename(oldPath, newPath, function (err) { 
        //             if (err) { console.error(err); } 
        //         }); 
        //     } 
        //     // res.writeHead(200, { 'Content-Type': 'text/plain' }); 
        //     // res.end(`Received ${files.fileToUpload.length} files`); 
        // }); 

        return;

    }

    if (req.url === '/uploadScene' && req.method.toLowerCase() === 'post') { //上传文件 

        // console.log("req ",req);
        const form = new formidable.IncomingForm(
            {
                encoding: 'utf-8'
            }
        );
        form.uploadDir = UPLOAD_DIR_SCENE;
        // form.multiples = true; // enable multiple file upload

        form.parse(req, function (err, fields, files) {
            if (err) throw err; // 将上传的文件保存到叫做 "uploads" 的文件夹中 

            // console.log("files,",files);
            const oldPath = files.fileToUpload.filepath;

            let folderBase = UPLOAD_DIR_SCENE + fields.folderBase;
            if (!fs.existsSync(folderBase)) {
                fs.mkdirSync(folderBase);
            }

            let foldPath = "";
            let fileName = "";

            foldPath = folderBase;
            if(fields.fileName){
                fileName = fields.fileName;
            }else{
                fileName = files.fileToUpload.originalFilename;
            }
            // console.log(" 获取文件存储的文件夹名 ,",foldPath);

            if (!fs.existsSync(foldPath)) {
                fs.mkdirSync(foldPath);
            }
            const newPath = foldPath + "/" + fileName;
            fs.rename(oldPath, newPath, function (err) {
                if (err) {
                    res.write('FAILD' + err);
                    return res.end();
                };
                // res.writeHead(200, {'Content-Type': 'text/html'}); 
                res.write('SUCCESS');
                console.log("文件上传成功！", newPath);
                return res.end();
            });
        });

        return;

    }
    if (req.url === '/uploadGroup' && req.method.toLowerCase() === 'post') { //上传文件 

        // console.log("req ",req);
        const form = new formidable.IncomingForm(
            {
                encoding: 'utf-8'
            }
        );
        form.uploadDir = UPLOAD_DIR_GROUP;
        // form.multiples = true; // enable multiple file upload

        form.parse(req, function (err, fields, files) {
            if (err) throw err; // 将上传的文件保存到叫做 "uploads" 的文件夹中 

            // console.log("files,",files);
            const oldPath = files.fileToUpload.filepath;

            let folderBase = UPLOAD_DIR_GROUP + fields.folderBase;
            if (!fs.existsSync(folderBase)) {
                fs.mkdirSync(folderBase);
            }

            let foldPath = "";
            let fileName = "";

            foldPath = folderBase;
            if(fields.fileName){
                fileName = fields.fileName;
            }else{
                fileName = files.fileToUpload.originalFilename;
            }
            // console.log(" 获取文件存储的文件夹名 ,",foldPath);

            if (!fs.existsSync(foldPath)) {
                fs.mkdirSync(foldPath);
            }
            const newPath = foldPath + "/" + fileName;
            fs.rename(oldPath, newPath, function (err) {
                if (err) {
                    res.write('FAILD' + err);
                    return res.end();
                };
                // res.writeHead(200, {'Content-Type': 'text/html'}); 
                res.write('SUCCESS');
                console.log("文件上传成功！", newPath);
                return res.end();
            });
        });

        return;

    }

    if (req.url === '/uploadHDR' && req.method.toLowerCase() === 'post') { //上传文件 

        // console.log("req ",req);
        const form = new formidable.IncomingForm(
            {
                encoding: 'utf-8'
            }
        );
        form.uploadDir = UPLOAD_DIR_HDR;
        // form.multiples = true; // enable multiple file upload

        form.parse(req, function (err, fields, files) {
            if (err) throw err; // 将上传的文件保存到叫做 "uploads" 的文件夹中 

            // console.log("files,",files);
            const oldPath = files.fileToUpload.filepath;

            let folderBase = UPLOAD_DIR_HDR + fields.folderBase;
            if (!fs.existsSync(folderBase)) {
                fs.mkdirSync(folderBase);
            }

            let foldPath = "";
            let fileName = "";

            foldPath = folderBase;
            fileName = files.fileToUpload.originalFilename;
            // console.log(" 获取文件存储的文件夹名 ,",foldPath);

            if (!fs.existsSync(foldPath)) {
                fs.mkdirSync(foldPath);
            }
            const newPath = foldPath + "/" + fileName;
            fs.rename(oldPath, newPath, function (err) {
                if (err) {
                    res.write('FAILD' + err);
                    return res.end();
                };
                // res.writeHead(200, {'Content-Type': 'text/html'}); 
                res.write('SUCCESS');
                console.log("文件上传成功！", newPath);
                return res.end();
            });
        });

        return;

    }


    if (req.url === '/uploadUVAnim' && req.method.toLowerCase() === 'post') { //上传文件 

        // console.log("req ",req);
        const form = new formidable.IncomingForm(
            {
                encoding: 'utf-8'
            }
        );
        form.uploadDir = UPLOAD_DIR_UVANIM;
        // form.multiples = true; // enable multiple file upload

        form.parse(req, function (err, fields, files) {
            if (err) throw err; // 将上传的文件保存到叫做 "uploads" 的文件夹中 

            // console.log("files,",files);
            const oldPath = files.fileToUpload.filepath;

            let folderBase = UPLOAD_DIR_UVANIM + fields.folderBase;
            if (!fs.existsSync(folderBase)) {
                fs.mkdirSync(folderBase);
            }

            let foldPath = "";
            let fileName = "";

            foldPath = folderBase;
            fileName = files.fileToUpload.originalFilename;
            // console.log(" 获取文件存储的文件夹名 ,",foldPath);

            if (!fs.existsSync(foldPath)) {
                fs.mkdirSync(foldPath);
            }
            const newPath = foldPath + "/" + fileName;
            fs.rename(oldPath, newPath, function (err) {
                if (err) {
                    res.write('FAILD' + err);
                    return res.end();
                };
                // res.writeHead(200, {'Content-Type': 'text/html'}); 
                res.write('SUCCESS');
                console.log("文件上传成功！", newPath);
                return res.end();
            });
        });

        return;

    }


    if (req.url === '/uploadSkill' && req.method.toLowerCase() === 'post') { //上传文件 

        // console.log("req ",req);
        const form = new formidable.IncomingForm(
            {
                encoding: 'utf-8'
            }
        );
        form.uploadDir = UPLOAD_DIR_SKILL;
        // form.multiples = true; // enable multiple file upload

        form.parse(req, function (err, fields, files) {
            if (err) throw err; // 将上传的文件保存到叫做 "uploads" 的文件夹中 

            // console.log("files,",files);
            const oldPath = files.fileToUpload.filepath;

            let folderBase = UPLOAD_DIR_SKILL + fields.folderBase;
            if (!fs.existsSync(folderBase)) {
                fs.mkdirSync(folderBase);
            }

            let foldPath = "";
            let fileName = fields.fileName;

            foldPath = folderBase;
            // console.log(" 获取文件存储的文件夹名 ,",foldPath);

            if (!fs.existsSync(foldPath)) {
                fs.mkdirSync(foldPath);
            }
            const newPath = foldPath + "/" + fileName;
            fs.rename(oldPath, newPath, function (err) {
                if (err) {
                    res.write('FAILD' + err);
                    return res.end();
                };

                let resData = {};
                resData.state = 'SUCCESS';
                resData.data = {
                    filePath: fileName
                }
                res.write(JSON.stringify(resData));
                console.log("文件上传成功！", newPath);
                return res.end();
            });
        });

        return;

    }


    if (req.url === '/uploadPlayer' && req.method.toLowerCase() === 'post') { //上传文件 

        // console.log("req ",req);
        const form = new formidable.IncomingForm(
            {
                encoding: 'utf-8'
            }
        );
        form.uploadDir = UPLOAD_DIR_PLAYER;

        form.parse(req, function (err, fields, files) {
            if (err) throw err; // 将上传的文件保存到叫做 "uploads" 的文件夹中 

            // console.log("files,",files);
            const oldPath = files.fileToUpload.filepath;

            let folderBase = UPLOAD_DIR_PLAYER + fields.folderBase;
            if (!fs.existsSync(folderBase)) {
                fs.mkdirSync(folderBase);
            }


            let foldPath = "";
            let fileName = "";
            if (fields.folderName != undefined) {
                if (fields.isBase == "true") {

                    // 去掉根目录
                    let sp = files.fileToUpload.originalFilename.split('/');
                    // console.log(" 去掉根目录 ",files.fileToUpload.originalFilename,sp);
                    if (sp.length > 2) {
                        foldPath = folderBase;
                        for (let i = 1; i < sp.length - 1; i++) {
                            const element = sp[i];
                            foldPath += "/" + element;
                        }
                        // console.log("多层目录",foldPath);
                    } else {
                        foldPath = folderBase;
                    }
                    fileName = files.fileToUpload.originalFilename.replace(fields.folderName + '/', "");
                } else {
                    foldPath = folderBase + "/" + fields.folderName;
                    fileName = files.fileToUpload.originalFilename.replace(fields.folderName + '/', "");
                }
            } else {
                foldPath = folderBase;
                fileName = files.fileToUpload.originalFilename;
            }
            // console.log(" 获取文件存储的文件夹名 ,",foldPath);

            if (!fs.existsSync(foldPath)) {
                fs.mkdirSync(foldPath);
            }
            const newPath = foldPath + "/" + fileName;
            fs.rename(oldPath, newPath, function (err) {
                if (err) {
                    res.write('FAILD' + err);
                    return res.end();
                };
                // res.writeHead(200, {'Content-Type': 'text/html'}); 
                res.write('SUCCESS');
                console.log("文件上传成功！", newPath);
                return res.end();
            });
        });

        return;

    }

    if (req.url === '/getAllScene' && req.method.toLowerCase() === 'get') {
        //获取所有文件夹内的data.txt
        const folderPath = UPLOAD_DIR_SCENE;

        let txtList = [];
        fs.readdir(folderPath, (err, files) => {
            if (err) throw err;
            // console.log(files);
            files.forEach(file => {
                const filePath = path.join(folderPath, file);
                const stats = fs.statSync(filePath);
                if (stats.isFile) {
                    txtList.push(file + "/"  + "data.txt");
                }
            });

            // console.log(txtList);

            let txtDataList = [];
            for (let i = 0; i < txtList.length; i++) {
                const element = txtList[i];
                fs.readFile(folderPath + element, 'utf8', (err, data) => {
                    if (err) throw err;
                    // console.log(data);
                    let scene = JSON.parse(data);
                    scene.folderBase = element.split('/')[0];
                    // console.log(" scene.folderBase ",scene.folderBase);
                    txtDataList.push(scene);
                });
            }

            setTimeout(() => {
                let resData = {};
                resData.txtDataList = txtDataList;
                res.write(JSON.stringify(resData));
                return res.end();
            }, 1000);


        });




        return;
    }
    if (req.url === '/getAllGroup' && req.method.toLowerCase() === 'get') {
        //获取所有文件夹内的data.txt
        const folderPath = UPLOAD_DIR_GROUP;

        let txtList = [];
        fs.readdir(folderPath, (err, files) => {
            if (err) throw err;
            // console.log(files);
            files.forEach(file => {
                const filePath = path.join(folderPath, file);
                const stats = fs.statSync(filePath);
                if (stats.isFile) {
                    txtList.push(file + "/"  + "data.txt");
                }
            });

            // console.log(txtList);

            let txtDataList = [];
            for (let i = 0; i < txtList.length; i++) {
                const element = txtList[i];
                fs.readFile(folderPath + element, 'utf8', (err, data) => {
                    if (err) throw err;
                    // console.log(data);
                    let scene = JSON.parse(data);
                    scene.folderBase = element.split('/')[0];
                    // console.log(" scene.folderBase ",scene.folderBase);
                    txtDataList.push(scene);
                });
            }

            setTimeout(() => {
                let resData = {};
                resData.txtDataList = txtDataList;
                res.write(JSON.stringify(resData));
                return res.end();
            }, 1000);


        });




        return;
    }


    if (req.url === '/getAllModel' && req.method.toLowerCase() === 'get') {
        //获取所有文件夹内的data.txt
        const folderPath = UPLOAD_DIR;


        let txtList = [];
        fs.readdir(folderPath, (err, files) => {
            if (err) throw err;
            // console.log(files);
            files.forEach(file => {
                const filePath = path.join(folderPath, file);
                const stats = fs.statSync(filePath);
                if (stats.isFile) {

                }
                // console.log(file);
                if (stats.isDirectory) {
                    txtList.push(file + "/" + file + "_data.txt");
                }
            });

            // console.log(txtList);

            let txtDataList = [];
            for (let i = 0; i < txtList.length; i++) {
                const element = txtList[i];
                fs.readFile(folderPath + element, 'utf8', (err, data) => {
                    if (err) throw err;
                    // console.log(data);
                    txtDataList.push(data);
                });
            }

            setTimeout(() => {
                let resData = {};
                resData.txtDataList = txtDataList;
                res.write(JSON.stringify(resData));
                return res.end();
            }, 1000);


        });




        return;
    }


    if (req.url === '/getAllHDR' && req.method.toLowerCase() === 'get') {
        //获取所有文件夹内的data.txt
        const folderPath = UPLOAD_DIR_HDR;


        let txtList = [];
        fs.readdir(folderPath, (err, files) => {
            if (err) throw err;
            // console.log(files);
            files.forEach(file => {
                const filePath = path.join(folderPath, file);
                const stats = fs.statSync(filePath);
                if (stats.isFile) {
                }
                // console.log(file);
                if (stats.isDirectory) {
                    txtList.push(file);
                }
            });

            // console.log(txtList);

            let txtDataList = [];
            for (let i = 0; i < txtList.length; i++) {
                const element = txtList[i];
                fs.readdir(folderPath + element, (err, files) => {
                    if (err) throw err;
                    files.forEach(file => {
                        const filePath = path.join(folderPath + element, file);
                        const stats = fs.statSync(filePath);
                        if (stats.isFile) {
                            txtDataList.push(element + "/" + file);
                        }
                        // console.log(file);
                        if (stats.isDirectory) {
                        }
                    });
                });
            }

            setTimeout(() => {
                let resData = {};
                resData.txtDataList = txtDataList;
                res.write(JSON.stringify(resData));
                return res.end();
            }, 1000);


        });




        return;
    }


    if (req.url === '/getAllUVAnim' && req.method.toLowerCase() === 'get') {
        //获取所有文件夹内的data.txt
        const folderPath = UPLOAD_DIR_UVANIM;


        let txtList = [];
        fs.readdir(folderPath, (err, files) => {
            if (err) throw err;
            // console.log(files);
            files.forEach(file => {
                const filePath = path.join(folderPath, file);
                const stats = fs.statSync(filePath);
                if (stats.isFile) {
                }
                // console.log(file);
                if (stats.isDirectory) {
                    txtList.push(file);
                }
            });

            // console.log(txtList);

            let txtDataList = [];
            for (let i = 0; i < txtList.length; i++) {
                const element = txtList[i];
                fs.readdir(folderPath + element, (err, files) => {
                    if (err) throw err;
                    files.forEach(file => {
                        const filePath = path.join(folderPath + element, file);
                        const stats = fs.statSync(filePath);
                        if (stats.isFile) {
                            txtDataList.push(element + "/" + file);
                        }
                        // console.log(file);
                        if (stats.isDirectory) {
                        }
                    });
                });
            }

            setTimeout(() => {
                let resData = {};
                resData.txtDataList = txtDataList;
                res.write(JSON.stringify(resData));
                return res.end();
            }, 1000);


        });




        return;
    }
    //其他请求 
    {
        res.writeHead(200, { 'Content-Type': 'text/html;charset:utf-8' });
        res.write('<head><meta charset="utf-8"/></head>');
        res.write('<form action="/upload" method="post" enctype="multipart/form-data">');
        res.write('<input type="file" name="fileToUpload" multiple><br>');
        res.write('<input type="text" name="folderName" ><br>');
        res.write('<input type="submit">');
        res.write('</form>');
        return res.end();
    }




}).listen(3335);

